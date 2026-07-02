import type { Metadata } from "next";

import { CollectionMarketPage } from "@/components/marketplace/collection-market-page";
import { requireCollection } from "@/config/collections";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { collectionPath } from "@/lib/marketplace/routes";

const collection = requireCollection("random-walk");

export const metadata: Metadata = buildPageMetadata({
  title: collection.shortName,
  description: `Browse ${collection.name}, floor listings, and highest bids with zero platform fees on Axiom Zero.`,
  path: collectionPath("random-walk"),
  keywords: [
    "Random Walk NFT",
    "generative art",
    "Arbitrum NFT marketplace",
    "zero fee NFT",
  ],
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function RandomWalkPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <CollectionMarketPage
      collectionId="random-walk"
      searchParams={searchParams}
    />
  );
}
