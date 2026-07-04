import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  normalizeRandomWalkHistory,
  type RandomWalkHistoryEntry,
} from "@/lib/marketplace/random-walk-live";
import {
  normalizeCosmicSignatureHistory,
  type CosmicSignatureTransfer,
} from "@/lib/marketplace/cosmic-signature-live";
import { fetchGoApiJson, GoApiError } from "@/lib/marketplace/go-api";
import { coerceAddress, participantAddress } from "@/lib/marketplace/eth";
import type { TokenHistoryEventKind } from "@/lib/marketplace/types";
import { fuzzParams } from "../helpers/fuzz";

const HISTORY_KINDS: TokenHistoryEventKind[] = [
  "mint",
  "transfer",
  "listing",
  "bid",
  "sale",
  "offer-canceled",
  "named",
  "other",
];

const ETH_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ZERO = "0x0000000000000000000000000000000000000000";

const hexChar = fc.constantFrom(..."0123456789abcdef");

/** Well-formed, zero, and hostile address inputs. */
const addressArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(ZERO),
  fc
    .string({ unit: hexChar, minLength: 40, maxLength: 40 })
    .map((hex) => `0x${hex}`),
  fc.string({ maxLength: 60 }),
);

const optionalNumberArb = fc.option(
  fc.double({ noDefaultInfinity: false, noNaN: false }),
  { nil: undefined },
);

const randomWalkEntryArb: fc.Arbitrary<RandomWalkHistoryEntry> = fc.record({
  RecordType: fc.integer({ min: -5, max: 40 }),
  Record: fc.record(
    {
      BlockNum: fc.option(fc.integer({ min: 0, max: 1_000_000_000 }), {
        nil: undefined,
      }),
      TimeStamp: fc.integer({ min: 0, max: 4_102_444_800 }),
      DateTime: fc.oneof(
        fc.constant("2021-11-12T00:00:17Z"),
        fc.string({ maxLength: 40 }),
      ),
      OwnerAddr: addressArb,
      SellerAddr: addressArb,
      BuyerAddr: addressArb,
      FromAddr: addressArb,
      ToAddr: addressArb,
      Price: optionalNumberArb,
      OfferId: fc.option(fc.integer(), { nil: undefined }),
      OfferType: fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }),
      TokenName: fc.option(fc.string({ maxLength: 40 }), { nil: undefined }),
    },
    {
      requiredKeys: ["TimeStamp", "DateTime"],
    },
  ),
});

const cosmicTransferArb: fc.Arbitrary<CosmicSignatureTransfer> = fc.record(
  {
    TransferType: fc.integer({ min: -2, max: 5 }),
    FromAddr: addressArb,
    ToAddr: addressArb,
    Tx: fc.record(
      {
        BlockNum: fc.option(fc.integer({ min: 0, max: 1_000_000_000 }), {
          nil: undefined,
        }),
        TimeStamp: fc.option(fc.integer({ min: 0, max: 4_102_444_800 }), {
          nil: undefined,
        }),
        DateTime: fc.option(fc.string({ maxLength: 40 }), { nil: undefined }),
      },
      { requiredKeys: [] },
    ),
  },
  { requiredKeys: ["TransferType", "Tx"] },
);

function isValidParticipant(value: `0x${string}` | undefined) {
  return (
    value === undefined ||
    (ETH_ADDRESS_PATTERN.test(value) && value.toLowerCase() !== ZERO)
  );
}

describe("Go API normalizer fuzzing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes arbitrary Random Walk history without ever throwing", () => {
    fc.assert(
      fc.property(fc.array(randomWalkEntryArb, { maxLength: 40 }), (entries) => {
        const normalized = normalizeRandomWalkHistory(entries);

        expect(normalized).toHaveLength(entries.length);

        for (const [index, record] of normalized.entries()) {
          expect(HISTORY_KINDS).toContain(record.kind);
          expect(record.recordType).toBe(entries[index].RecordType);
          expect(
            record.price === undefined || Number.isFinite(record.price),
          ).toBe(true);
          expect(isValidParticipant(record.owner)).toBe(true);
          expect(isValidParticipant(record.seller)).toBe(true);
          expect(isValidParticipant(record.buyer)).toBe(true);
          expect(isValidParticipant(record.from)).toBe(true);
          expect(isValidParticipant(record.to)).toBe(true);
        }
      }),
      fuzzParams(200),
    );
  });

  it("maps Random Walk record types to kinds totally and consistently", () => {
    fc.assert(
      fc.property(randomWalkEntryArb, (entry) => {
        const [record] = normalizeRandomWalkHistory([entry]);
        const expected =
          entry.RecordType === 1
            ? "mint"
            : entry.RecordType === 2
              ? entry.Record.OfferType === 1
                ? "listing"
                : "bid"
              : entry.RecordType === 3
                ? "offer-canceled"
                : entry.RecordType === 4
                  ? "sale"
                  : entry.RecordType === 5
                    ? "named"
                    : entry.RecordType === 6
                      ? "transfer"
                      : "other";

        expect(record.kind).toBe(expected);
      }),
      fuzzParams(200),
    );
  });

  it("normalizes arbitrary Cosmic Signature transfers into ordered history", () => {
    fc.assert(
      fc.property(
        fc.array(cosmicTransferArb, { maxLength: 40 }),
        (transfers) => {
          const normalized = normalizeCosmicSignatureHistory(transfers);

          expect(normalized).toHaveLength(transfers.length);

          for (let index = 1; index < normalized.length; index += 1) {
            expect(normalized[index].timestamp).toBeGreaterThanOrEqual(
              normalized[index - 1].timestamp,
            );
          }

          for (const record of normalized) {
            expect(["mint", "transfer"]).toContain(record.kind);
            expect(isValidParticipant(record.from)).toBe(true);
            expect(isValidParticipant(record.to)).toBe(true);
            expect(record.kind === "mint" || record.owner === undefined).toBe(
              true,
            );
          }
        },
      ),
      fuzzParams(200),
    );
  });

  it("either parses or rejects arbitrary HTTP payloads, mirroring the envelope rules", async () => {
    const envelopeSchema = z.object({
      status: z.number(),
      error: z.string().optional(),
    });

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.json(), fc.string({ maxLength: 200 })),
        fc
          .integer({ min: 200, max: 599 })
          .filter((status) => ![204, 205, 304].includes(status)),
        async (body, status) => {
          vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(body, { status })),
          );

          const outcome = await fetchGoApiJson(
            "https://backend.test/api/fuzz",
            z.unknown(),
          ).then(
            (value) => ({ ok: true as const, value }),
            (error: unknown) => ({ ok: false as const, error }),
          );

          const httpOk = status >= 200 && status < 300;
          let payload: unknown;
          try {
            payload = JSON.parse(body);
          } catch {
            payload = undefined;
          }
          const envelope = envelopeSchema.safeParse(payload);
          const envelopeRejects = envelope.success && envelope.data.status !== 1;

          expect(outcome.ok).toBe(httpOk && !envelopeRejects);

          if (!outcome.ok) {
            expect(outcome.error).toBeInstanceOf(GoApiError);
          }

          vi.unstubAllGlobals();
        },
      ),
      fuzzParams(60),
    );
  });

  it("coerces arbitrary strings into addresses or nothing", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string({ maxLength: 80 }), addressArb),
        (value) => {
          const coerced = coerceAddress(value);
          const participant = participantAddress(value);

          expect(
            coerced === undefined || ETH_ADDRESS_PATTERN.test(coerced),
          ).toBe(true);
          expect(isValidParticipant(participant)).toBe(true);

          // participantAddress is coerceAddress minus the zero sentinel.
          if (participant !== undefined) {
            expect(participant).toBe(coerced);
          }
          if (coerced !== undefined && coerced.toLowerCase() !== ZERO) {
            expect(participant).toBe(coerced);
          }
        },
      ),
      fuzzParams(300),
    );
  });
});
