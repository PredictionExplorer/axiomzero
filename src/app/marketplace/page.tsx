import type { Metadata } from "next";

import { MarketplaceCard } from "@/components/marketplace/marketplace-card";
import { MarketplaceControls } from "@/components/marketplace/marketplace-controls";
import { MarketplaceStatsGrid } from "@/components/marketplace/marketplace-stats";
import {
  getMarketplaceOffers,
  getMarketplaceStats,
  parseMarketplaceSearchParams,
} from "@/lib/marketplace/queries";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Buy and sell Random Walk and Cosmic Signature NFTs with zero platform fees. Filter by collection, price, token ID, or offer type.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const search = parseMarketplaceSearchParams(resolvedSearchParams);
  const visibleOffers = await getMarketplaceOffers(search);
  const stats = getMarketplaceStats(visibleOffers);

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <section className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.42em] text-copper">
            Zero-fee marketplace
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-ivory sm:text-7xl">
            Generative NFT Marketplace
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-bone/70">
            Buy and sell Random Walk and Cosmic Signature NFTs with zero
            platform fees. Filter by collection, price, token ID, or offer type.
          </p>
        </div>

        <div className="rounded-[2rem] border border-copper/20 bg-copper/10 p-5">
          <p className="text-xs uppercase tracking-[0.26em] text-copper">
            Live collection markets
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ivory">
            Real listings, real offers, and collection artwork from public
            endpoints and verified Arbitrum contracts.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <MarketplaceControls
          search={search}
          totalOffers={visibleOffers.length}
        />
      </div>

      <div className="mt-6">
        <MarketplaceStatsGrid stats={stats} />
      </div>

      <section className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {visibleOffers.map((offer) => (
          <MarketplaceCard key={offer.id} offer={offer} />
        ))}
      </section>

      {!visibleOffers.length ? (
        <div className="mt-12 rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-8 text-center">
          <h2 className="text-2xl font-semibold text-ivory">
            No matching orders
          </h2>
          <p className="mt-3 text-bone/78">
            Try widening the price range, clearing the token filter, or viewing
            the other offer type.
          </p>
        </div>
      ) : null}
    </div>
  );
}
