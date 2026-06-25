import type { Metadata } from "next";

import { CollectionMarketPage } from "@/components/marketplace/collection-market-page";

export const metadata: Metadata = {
  title: "Cosmic Signature",
  description:
    "Browse Cosmic Signature NFTs, floor listings, and highest bids with zero platform fees.",
};

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
