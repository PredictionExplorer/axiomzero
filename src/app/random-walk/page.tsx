import type { Metadata } from "next";

import { CollectionMarketPage } from "@/components/marketplace/collection-market-page";

export const metadata: Metadata = {
  title: "Random Walk",
  description:
    "Browse Random Walk NFTs, floor listings, and highest bids with zero platform fees.",
};

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
