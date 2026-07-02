import { describe, expect, it } from "vitest";

import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  tokenArtworkJsonLd,
} from "@/lib/seo/json-ld";

describe("seo json-ld", () => {
  it("builds organization and breadcrumb schemas", () => {
    expect(organizationJsonLd()).toMatchObject({
      "@type": "Organization",
      name: "Axiom Zero",
    });

    expect(breadcrumbJsonLd([{ name: "Home", path: "/" }])).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [{ position: 1, name: "Home" }],
    });
  });

  it("builds token artwork offers and faq schemas", () => {
    expect(
      tokenArtworkJsonLd({
        name: "Random Walk #000001",
        description: "Token",
        path: "/token/random-walk/1",
        image: "https://example.com/art.png",
        collectionName: "Random Walk NFTs",
        priceEth: 1.5,
      }),
    ).toMatchObject({
      "@type": "VisualArtwork",
      offers: {
        "@type": "Offer",
        price: 1.5,
        priceCurrency: "ETH",
      },
    });

    expect((faqPageJsonLd() as { mainEntity: unknown[] }).mainEntity.length).toBeGreaterThan(0);
  });
});
