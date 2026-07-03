import { describe, expect, it } from "vitest";

import { requireCollection } from "@/config/collections";
import {
  fallbackCollectionSupply,
  formatCollectionSupplyLabel,
} from "@/lib/marketplace/collection-supply";

describe("collection supply labels", () => {
  it("formats live supply with collection-specific nouns", () => {
    expect(
      formatCollectionSupplyLabel(requireCollection("random-walk"), 4086),
    ).toBe("4,086 walks");
    expect(
      formatCollectionSupplyLabel(requireCollection("cosmic-signature"), 24),
    ).toBe("24 signatures");
  });

  it("uses the singular noun for one-token collections", () => {
    expect(
      formatCollectionSupplyLabel(requireCollection("cosmic-signature"), 1),
    ).toBe("1 signature");
  });

  it("does not show a guessed count when live supply is unavailable", () => {
    expect(
      formatCollectionSupplyLabel(requireCollection("random-walk"), undefined),
    ).toBe("Live supply unavailable");
  });

  it("derives the fallback supply from the inclusive token id range", () => {
    expect(fallbackCollectionSupply(requireCollection("random-walk"))).toBe(
      4086,
    );
    expect(
      fallbackCollectionSupply(requireCollection("cosmic-signature")),
    ).toBe(24);
    expect(fallbackCollectionSupply({ tokenRange: { start: 5, end: 5 } })).toBe(
      1,
    );
  });
});
