import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { parseMarketplaceSearchParams } from "@/lib/marketplace/queries";
import { parseTokenDetailState } from "@/lib/marketplace/token-detail";
import { fuzzParams } from "../helpers/fuzz";

/**
 * Next.js hands searchParams over as Record<string, string | string[] |
 * undefined> straight from the URL, so parsers face fully attacker-controlled
 * input.
 */
const searchParamsArb = fc.dictionary(
  fc.oneof(
    fc.constantFrom(
      "collection",
      "kind",
      "view",
      "query",
      "min",
      "max",
      "sort",
      "page",
      "pageSize",
      "listedOnly",
      "anchor",
      "filter",
      "theme",
      "media",
      "tab",
    ),
    fc.string({ maxLength: 12 }),
  ),
  fc.oneof(
    fc.string({ maxLength: 24 }),
    fc.array(fc.string({ maxLength: 24 }), { maxLength: 3 }),
    fc.constant(undefined),
  ),
  { maxKeys: 12 },
);

describe("search param parsing fuzzing", () => {
  it("always produces bounded, valid marketplace search state", () => {
    fc.assert(
      fc.property(searchParamsArb, (params) => {
        const parsed = parseMarketplaceSearchParams(params);

        expect(["all", "random-walk", "cosmic-signature"]).toContain(
          parsed.collection,
        );
        expect(["sell", "buy", "all"]).toContain(parsed.kind);
        expect(["discover", "listings", "top-bids"]).toContain(parsed.view);
        expect(["price-asc", "price-desc", "recent"]).toContain(parsed.sort);
        expect([undefined, "never", "anchored"]).toContain(parsed.anchor);

        expect(Number.isInteger(parsed.page)).toBe(true);
        expect(parsed.page).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(parsed.pageSize)).toBe(true);
        expect(parsed.pageSize).toBeGreaterThanOrEqual(1);
        expect(parsed.pageSize).toBeLessThanOrEqual(24);

        for (const bound of [parsed.min, parsed.max]) {
          if (bound !== undefined) {
            expect(Number.isFinite(bound)).toBe(true);
            expect(bound).toBeGreaterThanOrEqual(0);
          }
        }

        if (parsed.query !== undefined) {
          expect(parsed.query.length).toBeGreaterThan(0);
        }

        expect(typeof parsed.listedOnly).toBe("boolean");
      }),
      fuzzParams(500),
    );
  });

  it("always produces a valid token detail state", () => {
    fc.assert(
      fc.property(searchParamsArb, (params) => {
        const state = parseTokenDetailState(params);

        expect(["black", "white"]).toContain(state.theme);
        expect(["image", "single", "triple"]).toContain(state.media);
        expect(["market", "history", "notes"]).toContain(state.tab);
      }),
      fuzzParams(500),
    );
  });
});
