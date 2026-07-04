import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { formatHistoryRecords } from "@/lib/marketplace/token-detail";
import type {
  TokenHistoryEventKind,
  TokenHistoryRecord,
} from "@/lib/marketplace/types";
import { fuzzParams } from "../helpers/fuzz";

const kindArb = fc.constantFrom<TokenHistoryEventKind>(
  "mint",
  "transfer",
  "listing",
  "bid",
  "sale",
  "offer-canceled",
  "named",
  "other",
);

const addressArb = fc
  .string({
    unit: fc.constantFrom(..."0123456789abcdef"),
    minLength: 40,
    maxLength: 40,
  })
  .map((hex) => `0x${hex}` as `0x${string}`);

const recordArb: fc.Arbitrary<TokenHistoryRecord> = fc.record(
  {
    kind: kindArb,
    recordType: fc.integer({ min: -10, max: 100 }),
    blockNumber: fc.integer({ min: 0, max: 2_000_000_000 }),
    timestamp: fc.integer({ min: 0, max: 4_102_444_800 }),
    // Arbitrary strings cover malformed upstream timestamps.
    dateTime: fc.oneof(
      fc.constant("2021-11-12T00:00:17Z"),
      fc.string({ maxLength: 30 }),
    ),
    owner: fc.option(addressArb, { nil: undefined }),
    seller: fc.option(addressArb, { nil: undefined }),
    buyer: fc.option(addressArb, { nil: undefined }),
    from: fc.option(addressArb, { nil: undefined }),
    to: fc.option(addressArb, { nil: undefined }),
    price: fc.option(fc.double({ noDefaultInfinity: false, noNaN: false }), {
      nil: undefined,
    }),
    offerId: fc.option(fc.integer(), { nil: undefined }),
    name: fc.option(fc.string({ maxLength: 40 }), { nil: undefined }),
  },
  {
    requiredKeys: ["kind", "recordType", "blockNumber", "timestamp", "dateTime"],
  },
);

describe("history formatting fuzzing", () => {
  it("formats arbitrary history records without throwing and keeps invariants", () => {
    fc.assert(
      fc.property(fc.array(recordArb, { maxLength: 60 }), (records) => {
        const formatted = formatHistoryRecords(records);

        expect(formatted).toHaveLength(records.length);

        const keys = new Set(formatted.map((record) => record.key));
        expect(keys.size).toBe(formatted.length);

        for (const [index, viewRecord] of formatted.entries()) {
          const source = records[records.length - 1 - index];

          expect(viewRecord.title.length).toBeGreaterThan(0);
          expect(viewRecord.subtitle.length).toBeGreaterThan(0);
          expect(viewRecord.date.length).toBeGreaterThan(0);

          // Prices only render for truthy finite-ish values, never as "NaN".
          if (viewRecord.price !== undefined) {
            expect(viewRecord.price.endsWith(" ETH")).toBe(true);
            expect(viewRecord.price).not.toContain("NaN");
          }

          // Newest-first ordering: view record i mirrors input n-1-i.
          expect(viewRecord.key).toContain(String(source.blockNumber));
        }
      }),
      fuzzParams(300),
    );
  });

  it("labels known kinds with human titles, never raw record ids", () => {
    fc.assert(
      fc.property(recordArb, (record) => {
        const [formatted] = formatHistoryRecords([record]);

        if (record.kind !== "other") {
          expect(formatted.title).not.toMatch(/^Record /);
        } else {
          expect(formatted.title).toBe(`Record ${record.recordType}`);
        }
      }),
      fuzzParams(300),
    );
  });
});
