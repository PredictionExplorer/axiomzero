import { describe, expect, it } from "vitest";

import { collections, getCollection, requireCollection } from "@/config/collections";

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

  it("throws for impossible collection ids", () => {
    expect(() => requireCollection("missing" as never)).toThrow(
      "Unknown collection",
    );
  });
});
