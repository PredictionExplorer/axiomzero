import { afterEach, describe, expect, it, vi } from "vitest";

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

  describe("with malformed token range env overrides", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("falls back to the built-in token ranges", async () => {
      vi.stubEnv("NEXT_PUBLIC_RANDOM_WALK_MAX_TOKEN_ID", "not-a-number");
      vi.stubEnv("NEXT_PUBLIC_COSMIC_SIGNATURE_MIN_TOKEN_ID", "also-bad");
      vi.stubEnv("NEXT_PUBLIC_COSMIC_SIGNATURE_MAX_TOKEN_ID", "still-bad");
      vi.resetModules();

      const fresh = await import("@/config/collections");

      expect(fresh.requireCollection("random-walk").tokenRange).toEqual({
        start: 0,
        end: 4095,
      });
      expect(fresh.requireCollection("cosmic-signature").tokenRange).toEqual({
        start: 0,
        end: 23,
      });
    });
  });
});
