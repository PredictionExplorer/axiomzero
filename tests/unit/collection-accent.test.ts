import { describe, expect, it } from "vitest";

import {
  accentDataAttribute,
  getCollectionAccent,
} from "@/lib/collection-accent";
import { requireCollection } from "@/config/collections";

describe("getCollectionAccent", () => {
  it("resolves collection ids through the registry", () => {
    expect(getCollectionAccent("random-walk")).toBe("copper");
    expect(getCollectionAccent("cosmic-signature")).toBe("chartreuse");
  });

  it("accepts full collection objects without a lookup", () => {
    expect(getCollectionAccent(requireCollection("cosmic-signature"))).toBe(
      "chartreuse",
    );
  });

  it("falls back to copper for unknown accent values", () => {
    const collection = {
      ...requireCollection("random-walk"),
      accent: "magenta",
    };

    expect(getCollectionAccent(collection)).toBe("copper");
  });
});

describe("accentDataAttribute", () => {
  it("produces the data attribute used by accent-scoped styles", () => {
    expect(accentDataAttribute("cosmic-signature")).toEqual({
      "data-accent": "chartreuse",
    });
  });
});
