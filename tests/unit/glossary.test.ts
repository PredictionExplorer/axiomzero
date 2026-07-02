import { describe, expect, it } from "vitest";

import { GLOSSARY, GLOSSARY_TERMS } from "@/lib/glossary";

describe("glossary", () => {
  it("defines every term with a readable definition", () => {
    for (const entry of Object.values(GLOSSARY)) {
      expect(entry.term.length).toBeGreaterThan(2);
      expect(entry.definition.length).toBeGreaterThan(30);
      // Tooltips stay scannable when definitions remain short.
      expect(entry.definition.length).toBeLessThan(220);
      expect(entry.definition.endsWith(".")).toBe(true);
    }
  });

  it("keeps display terms unique", () => {
    const terms = GLOSSARY_TERMS.map((entry) => entry.term);

    expect(new Set(terms).size).toBe(terms.length);
    expect(GLOSSARY_TERMS).toHaveLength(Object.keys(GLOSSARY).length);
  });

  it("covers the jargon surfaced in the marketplace UI", () => {
    for (const key of [
      "floorPrice",
      "topBid",
      "listing",
      "bid",
      "seed",
      "provenance",
      "beautyScore",
      "gas",
      "orderBook",
      "marketplaceApproval",
    ] as const) {
      expect(GLOSSARY[key]).toBeDefined();
    }
  });
});
