import { describe, expect, it } from "vitest";

import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  contractsForLlms,
  faqPageJsonLd,
  jsonLdScript,
  organizationJsonLd,
  tokenArtworkJsonLd,
  websiteJsonLd,
} from "@/lib/seo/json-ld";
import { collections } from "@/config/collections";

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

  it("serializes schemas into a script-injectable payload", () => {
    expect(jsonLdScript({ "@type": "Thing" })).toEqual({
      __html: '{"@type":"Thing"}',
    });
    expect(jsonLdScript([{ "@type": "A" }, { "@type": "B" }]).__html).toBe(
      '[{"@type":"A"},{"@type":"B"}]',
    );
  });

  it("builds website and collection page schemas", () => {
    expect(websiteJsonLd()).toMatchObject({
      "@type": "WebSite",
      potentialAction: {
        "@type": "SearchAction",
        "query-input": "required name=search_term_string",
      },
    });

    expect(
      collectionPageJsonLd({
        name: "Random Walk NFTs",
        description: "Collection",
        path: "/random-walk",
        itemCount: 100,
      }),
    ).toMatchObject({
      "@type": "CollectionPage",
      mainEntity: { numberOfItems: 100 },
    });
  });

  it("omits the offer block for unlisted artwork and honors custom currencies", () => {
    const unlisted = tokenArtworkJsonLd({
      name: "Random Walk #000002",
      description: "Token",
      path: "/token/random-walk/2",
      image: "https://example.com/art2.png",
      collectionName: "Random Walk NFTs",
    });
    expect(unlisted).not.toHaveProperty("offers");

    const priced = tokenArtworkJsonLd({
      name: "Random Walk #000003",
      description: "Token",
      path: "/token/random-walk/3",
      image: "https://example.com/art3.png",
      collectionName: "Random Walk NFTs",
      priceEth: 2,
      priceCurrency: "WETH",
    }) as { offers: { priceCurrency: string } };
    expect(priced.offers.priceCurrency).toBe("WETH");
  });

  it("lists verified contracts for LLM discovery", () => {
    const contracts = contractsForLlms();

    expect(contracts).toHaveLength(collections.length);
    expect(contracts[0]).toEqual({
      collection: collections[0].shortName,
      nftContract: collections[0].nftAddress,
      marketplaceContract: collections[0].marketplaceAddress,
      externalSite: collections[0].externalUrl,
    });
  });

  it("builds faq schema from a custom item subset", () => {
    const schema = faqPageJsonLd([
      { question: "What is a seed?", answer: "The generative input." },
    ]) as {
      "@type": string;
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    };

    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(1);
    expect(schema.mainEntity[0]).toMatchObject({
      name: "What is a seed?",
      acceptedAnswer: { text: "The generative input." },
    });
  });
});
