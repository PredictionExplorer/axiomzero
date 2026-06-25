import type { Metadata } from "next";

import { collections } from "@/config/collections";
import { MarketplaceCard } from "@/components/marketplace/marketplace-card";
import { MarketplaceControls } from "@/components/marketplace/marketplace-controls";
import { MarketplaceStatsGrid } from "@/components/marketplace/marketplace-stats";
import { MarketplaceTokenCard } from "@/components/marketplace/marketplace-token-card";
import { MyNftsPanel } from "@/components/marketplace/my-nfts-panel";
import {
  getMarketplaceOffers,
  getMarketplaceStats,
  getMarketplaceTokenPage,
  parseMarketplaceSearchParams,
} from "@/lib/marketplace/queries";
import type { MarketplaceSearchParams } from "@/lib/marketplace/types";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Buy and sell Random Walk and Cosmic Signature NFTs with zero platform fees. Filter by collection, price, token ID, or offer type.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function marketplaceHref(search: MarketplaceSearchParams, page: number) {
  const params = new URLSearchParams();

  params.set("view", search.view ?? "discover");
  params.set("page", String(page));
  if (search.pageSize) {
    params.set("pageSize", String(search.pageSize));
  }
  if (search.collection && search.collection !== "all") {
    params.set("collection", search.collection);
  }
  if (search.query) {
    params.set("query", search.query);
  }
  if (search.min !== undefined) {
    params.set("min", String(search.min));
  }
  if (search.max !== undefined) {
    params.set("max", String(search.max));
  }
  if (search.sort) {
    params.set("sort", search.sort);
  }

  return `/marketplace?${params.toString()}`;
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const search = parseMarketplaceSearchParams(resolvedSearchParams);
  const activeView = search.view ?? "discover";
  const offerSearch =
    activeView === "top-bids"
      ? { ...search, kind: "buy" as const, sort: "price-desc" as const }
      : activeView === "listings"
        ? { ...search, kind: "sell" as const }
        : activeView === "discover"
          ? { ...search, kind: "all" as const }
          : { ...search, kind: "buy" as const, sort: "price-desc" as const };
  const [visibleOffers, tokenPage] = await Promise.all([
    getMarketplaceOffers(offerSearch),
    activeView === "discover"
      ? getMarketplaceTokenPage(search)
      : Promise.resolve(undefined),
  ]);
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
            Discover NFTs in focused pages, browse the strongest bids, place
            bids from token detail, and list owned work without leaving the
            marketplace.
          </p>
        </div>

        <div className="rounded-[2rem] border border-copper/20 bg-copper/10 p-5">
          <p className="text-xs uppercase tracking-[0.26em] text-copper">
            Live collection markets
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ivory">
            A calmer surface for thousands of tokens: search, page, and act
            with wallet-aware controls instead of scrolling forever.
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

      {activeView === "discover" && tokenPage ? (
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-copper">
                Discover
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ivory">
                Browse a focused page of NFTs
              </h2>
            </div>
            <p className="rounded-full border border-ivory/10 bg-ivory/[0.045] px-4 py-2 text-sm text-bone/75">
              Page {tokenPage.page} of {tokenPage.totalPages}
            </p>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {tokenPage.items.map((item) => (
              <MarketplaceTokenCard
                key={`${item.token.collectionId}-${item.token.tokenId}`}
                item={item}
              />
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={marketplaceHref(search, Math.max(1, tokenPage.page - 1))}
              aria-disabled={tokenPage.page <= 1}
              className="inline-flex h-11 items-center justify-center rounded-full border border-ivory/15 bg-ivory/[0.04] px-5 text-sm font-semibold text-ivory transition hover:bg-ivory/[0.09] aria-disabled:pointer-events-none aria-disabled:opacity-45"
            >
              Previous page
            </a>
            <a
              href={marketplaceHref(
                search,
                Math.min(tokenPage.totalPages, tokenPage.page + 1),
              )}
              aria-disabled={tokenPage.page >= tokenPage.totalPages}
              className="inline-flex h-11 items-center justify-center rounded-full bg-copper px-5 text-sm font-semibold text-ink transition hover:bg-ember aria-disabled:pointer-events-none aria-disabled:opacity-45"
            >
              Next page
            </a>
          </div>
        </section>
      ) : null}

      {activeView === "listings" || activeView === "top-bids" ? (
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-copper">
                {activeView === "top-bids" ? "Top bids" : "Listings"}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ivory">
                {activeView === "top-bids"
                  ? "Active bids sorted highest first"
                  : "NFTs currently listed for sale"}
              </h2>
            </div>
            <p className="rounded-full border border-ivory/10 bg-ivory/[0.045] px-4 py-2 text-sm text-bone/75">
              {visibleOffers.length} active order
              {visibleOffers.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleOffers.map((offer) => (
              <MarketplaceCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>
      ) : null}

      {activeView === "my-nfts" ? (
        <div className="mt-12">
          <MyNftsPanel collections={collections} />
        </div>
      ) : null}

      {activeView !== "my-nfts" &&
      !visibleOffers.length &&
      !tokenPage?.items.length ? (
        <div className="mt-12 rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-8 text-center">
          <h2 className="text-2xl font-semibold text-ivory">
            Nothing matched this view
          </h2>
          <p className="mt-3 text-bone/78">
            Try widening the price range, clearing the token filter, or switching
            to another marketplace view.
          </p>
        </div>
      ) : null}
    </div>
  );
}
