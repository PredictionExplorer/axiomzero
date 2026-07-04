import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  randomWalkArtwork,
  randomWalkAssets,
  randomWalkTokenPreview,
} from "@/lib/marketplace/random-walk-live";
import {
  cosmicSignatureImageUrl,
  cosmicSignatureThumbUrl,
} from "@/lib/marketplace/cosmic-signature-live";

const tokenIdArb = fc.integer({ min: 0, max: 9_999_999 });

describe("asset URL fuzzing", () => {
  it("builds well-formed, padded Random Walk asset URLs for any token id", () => {
    fc.assert(
      fc.property(tokenIdArb, (tokenId) => {
        const assets = randomWalkAssets(tokenId);
        const padded = String(tokenId).padStart(6, "0");

        for (const url of Object.values(assets)) {
          // Throws for malformed URLs.
          const parsed = new URL(url);

          expect(parsed.protocol).toBe("https:");
          expect(parsed.pathname).toContain(`/images/randomwalk/${padded}_`);
        }

        expect(assets.blackThumb.endsWith("_black_thumb.jpg")).toBe(true);
        expect(assets.whiteTripleVideo.endsWith("_white_triple.mp4")).toBe(
          true,
        );
      }),
      { numRuns: 200 },
    );
  });

  it("keeps artwork and preview tokens consistent with the asset set", () => {
    fc.assert(
      fc.property(tokenIdArb, (tokenId) => {
        const assets = randomWalkAssets(tokenId);
        const artwork = randomWalkArtwork(tokenId);
        const preview = randomWalkTokenPreview(tokenId);

        expect(artwork.image).toBe(assets.blackThumb);
        expect(preview.tokenId).toBe(tokenId);
        expect(preview.artwork.image).toBe(assets.blackThumb);
        expect(preview.owner).toBe(
          "0x0000000000000000000000000000000000000000",
        );
      }),
      { numRuns: 200 },
    );
  });

  it("builds parseable Cosmic Signature media URLs for arbitrary seeds", () => {
    const hexString = fc.string({
      unit: fc.constantFrom(..."0123456789abcdef"),
      minLength: 1,
      maxLength: 64,
    });
    const seedArb = fc.oneof(
      hexString,
      hexString.map((hex) => `0x${hex}`),
    );

    fc.assert(
      fc.property(seedArb, (seed) => {
        const image = new URL(cosmicSignatureImageUrl(seed));
        const thumb = new URL(cosmicSignatureThumbUrl(seed, "white"));
        const normalized = seed.replace(/^0x/i, "");

        expect(image.pathname.endsWith(`0x${normalized}.png`)).toBe(true);
        expect(thumb.pathname.endsWith(`0x${normalized}/thumb_white.webp`)).toBe(
          true,
        );
        // The 0x prefix must never be doubled.
        expect(image.pathname).not.toContain("0x0x");
      }),
      { numRuns: 200 },
    );
  });
});
