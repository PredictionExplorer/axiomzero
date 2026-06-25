import { describe, expect, it } from "vitest";

import {
  collections,
  getCollection,
  requireCollection,
} from "@/config/collections";

describe("collections config", () => {
  it("defines Random Walk and Cosmic Signature equally", () => {
    expect(collections.map((collection) => collection.id)).toEqual([
      "random-walk",
      "cosmic-signature",
    ]);
  });

  it("returns collections by id", () => {
    expect(getCollection("random-walk")?.shortName).toBe("Random Walk");
    expect(requireCollection("cosmic-signature").shortName).toBe(
      "Cosmic Signature",
    );
  });

  it("defines collection supply nouns without hard-coded counts", () => {
    expect(requireCollection("random-walk").supplyNoun).toEqual({
      singular: "walk",
      plural: "walks",
    });
    expect(requireCollection("cosmic-signature").supplyNoun).toEqual({
      singular: "signature",
      plural: "signatures",
    });
  });

  it("defines fallback token ranges for discovery and wallet scans", () => {
    expect(requireCollection("random-walk").tokenRange).toEqual({
      start: 0,
      end: 4085,
    });
    expect(requireCollection("cosmic-signature").tokenRange).toEqual({
      start: 0,
      end: 23,
    });
  });

  it("throws for impossible collection ids", () => {
    expect(() => requireCollection("missing" as never)).toThrow(
      "Unknown collection",
    );
  });
});
