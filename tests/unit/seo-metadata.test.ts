import { describe, expect, it } from "vitest";

import { absoluteUrl, buildPageMetadata } from "@/lib/seo/metadata";

describe("seo metadata", () => {
  it("builds absolute urls from paths", () => {
    expect(absoluteUrl("/random-walk")).toBe(
      "https://axiomzero.market/random-walk",
    );
  });

  it("builds canonical and social metadata", () => {
    const metadata = buildPageMetadata({
      title: "Random Walk",
      description: "Browse Random Walk NFTs.",
      path: "/random-walk",
    });

    expect(metadata.alternates?.canonical).toBe(
      "https://axiomzero.market/random-walk",
    );

    const ogImages = metadata.openGraph?.images;
    const firstImage = Array.isArray(ogImages) ? ogImages[0] : ogImages;
    expect(firstImage).toMatchObject({ width: 1200, height: 630 });

    const twitter = metadata.twitter as { card?: string } | undefined;
    expect(twitter?.card).toBe("summary_large_image");
    expect(metadata.keywords).toContain("Axiom Zero");
  });

  it("uses a custom image when provided", () => {
    const metadata = buildPageMetadata({
      title: "Token",
      path: "/token/random-walk/1",
      image: "https://example.com/art.png",
    });

    const ogImages = metadata.openGraph?.images;
    const firstImage = Array.isArray(ogImages) ? ogImages[0] : ogImages;
    expect(firstImage).toMatchObject({ url: "https://example.com/art.png" });
  });
});
