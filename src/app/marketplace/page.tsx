import type { Metadata } from "next";

import { collections } from "@/config/collections";
import { MarketplaceCard } from "@/components/marketplace/marketplace-card";
import { MarketplaceControls } from "@/components/marketplace/marketplace-controls";
import { MarketplaceStatsGrid } from "@/components/marketplace/marketplace-stats";
import { BRAND_NAME, FOUNDATION_STATEMENT, ZERO_PROMISES } from "@/lib/brand";
import {
  getMarketplaceOffers,
  getMarketplaceStats,
  parseMarketplaceSearchParams,
} from "@/lib/marketplace/queries";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Browse fair-launch generative NFT listings and offers on Axiom Zero, a 0% fee marketplace with zero founder privilege.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const search = parseMarketplaceSearchParams(resolvedSearchParams);
  const visibleOffers = getMarketplaceOffers(search);
  const stats = getMarketplaceStats(visibleOffers);

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <section className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.42em] text-copper">
            {BRAND_NAME} Marketplace
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-ivory sm:text-7xl">
            0% fees. Zero founder privilege. Pure generative art.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-bone/70">
            Browse listings and offers across procedural NFT systems grounded in
            mathematics, code, algorithms, and transparent rules. No collection,
            founder, creator, or insider gets a privileged lane.
          </p>
        </div>

        <div className="rounded-[2rem] border border-copper/20 bg-copper/10 p-5">
          <p className="text-xs uppercase tracking-[0.26em] text-copper">
            Fair launch principle
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ivory">
            No allowlists. No reserved founder mints. No preferential access.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <MarketplaceControls search={search} />
      </div>

      <div className="mt-6">
        <MarketplaceStatsGrid stats={stats} />
      </div>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        {ZERO_PROMISES.slice(1, 4).map((promise) => (
          <div
            key={promise.label}
            className="rounded-[1.5rem] border border-ivory/10 bg-ivory/[0.04] p-5"
          >
            <p className="font-semibold text-ivory">{promise.label}</p>
            <p className="mt-2 text-sm leading-6 text-bone/78">
              {promise.detail}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {visibleOffers.map((offer) => (
          <MarketplaceCard key={offer.id} offer={offer} />
        ))}
      </section>

      {!visibleOffers.length ? (
        <div className="mt-12 rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-8 text-center">
          <h2 className="text-2xl font-semibold text-ivory">No matching orders</h2>
          <p className="mt-3 text-bone/78">
            Try widening the price range, clearing the token filter, or viewing
            all collections.
          </p>
        </div>
      ) : null}

      <section className="mt-16 grid gap-4 lg:grid-cols-2">
        {collections.map((collection) => (
          <div
            key={collection.id}
            className="rounded-[2rem] border border-ivory/10 bg-carbon p-6"
          >
            <p className="text-xs uppercase tracking-[0.26em] text-copper">
              {collection.supplyLabel}
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-ivory">
              {collection.name}
            </h2>
            <p className="mt-3 leading-7 text-bone/78">
              {collection.description}
            </p>
            <p className="mt-4 font-mono text-sm text-bone/75">
              {FOUNDATION_STATEMENT}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
