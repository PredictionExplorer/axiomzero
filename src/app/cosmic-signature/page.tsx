import type { Metadata } from "next";

import { CollectionMarketPage } from "@/components/marketplace/collection-market-page";
import { requireCollection } from "@/config/collections";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { collectionPath } from "@/lib/marketplace/routes";

const collection = requireCollection("cosmic-signature");

export const metadata: Metadata = buildPageMetadata({
  title: collection.shortName,
  description: `Browse ${collection.name}, floor listings, and highest bids with zero platform fees on Axiom Zero.`,
  path: collectionPath("cosmic-signature"),
  keywords: [
    "Cosmic Signature NFT",
    "three-body physics art",
    "Arbitrum NFT marketplace",
    "zero fee NFT",
  ],
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function CosmicSignaturePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <CollectionMarketPage
      collectionId="cosmic-signature"
      searchParams={searchParams}
    />
  );
}
