import Image from "next/image";

import { requireCollection } from "@/config/collections";
import { MarketplaceCard } from "@/components/marketplace/marketplace-card";
import { MarketplaceControls } from "@/components/marketplace/marketplace-controls";
import { MarketplacePagination } from "@/components/marketplace/marketplace-pagination";
import { MarketplaceStatsGrid } from "@/components/marketplace/marketplace-stats";
import { MarketplaceTokenCard } from "@/components/marketplace/marketplace-token-card";
import { JsonLd } from "@/components/seo/json-ld";
import { Reveal } from "@/components/ui/reveal";
import {
  getMarketplaceOffers,
  getMarketplaceStats,
  getMarketplaceTokenPage,
  parseMarketplaceSearchParams,
} from "@/lib/marketplace/queries";
import { getCollectionSupply } from "@/lib/marketplace/collection-index-live";
import { formatCollectionSupplyLabel } from "@/lib/marketplace/collection-supply";
import { collectionMarketHref, collectionPath } from "@/lib/marketplace/routes";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
} from "@/lib/seo/json-ld";
import type {
  CollectionId,
  MarketplaceSearchParams,
} from "@/lib/marketplace/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CollectionMarketPageProps = {
  collectionId: CollectionId;
  searchParams: SearchParams;
};

export async function CollectionMarketPage({
  collectionId,
  searchParams,
}: CollectionMarketPageProps) {
  const collection = requireCollection(collectionId);
  const resolvedSearchParams = await searchParams;
  const search = {
    ...parseMarketplaceSearchParams(resolvedSearchParams),
    collection: collectionId,
  } satisfies MarketplaceSearchParams;
  const activeView = search.view ?? "discover";
  const offerSearch =
    activeView === "top-bids"
      ? { ...search, kind: "buy" as const, sort: "price-desc" as const }
      : activeView === "listings"
        ? { ...search, kind: "sell" as const }
        : { ...search, kind: "all" as const };
  const statsSearch = {
    collection: collectionId,
    kind: "all" as const,
    view: "discover" as const,
    sort: "price-asc" as const,
  } satisfies MarketplaceSearchParams;
  const canReuseVisibleOffers =
    offerSearch.kind === "all" &&
    search.query === undefined &&
    search.min === undefined &&
    search.max === undefined;
  const [visibleOffers, statsOffers, tokenPage, supply] = await Promise.all([
    getMarketplaceOffers(offerSearch).catch(() => []),
    canReuseVisibleOffers
      ? Promise.resolve(undefined)
      : getMarketplaceOffers(statsSearch).catch(() => []),
    activeView === "discover"
      ? getMarketplaceTokenPage(search).catch(() => undefined)
      : Promise.resolve(undefined),
    getCollectionSupply(collectionId).catch(() => undefined),
  ]);
  const stats = getMarketplaceStats(statsOffers ?? visibleOffers);
  const heroArtwork =
    tokenPage?.items[0]?.token.artwork ??
    visibleOffers.find((offer) => offer.artwork)?.artwork;
  const path = collectionPath(collectionId);

  return (
    <div
      data-accent={collection.accent}
      className="mx-auto max-w-7xl px-5 py-14 sm:px-8"
    >
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: collection.shortName, path },
          ]),
          collectionPageJsonLd({
            name: collection.name,
            description: collection.description,
            path,
            itemCount: supply ?? collection.tokenRange.end,
          }),
        ]}
      />

      <section className="relative overflow-hidden rounded-[2.5rem] border border-accent bg-accent-muted">
        {heroArtwork ? (
          <div className="absolute inset-0">
            <Image
              src={heroArtwork.image}
              alt={heroArtwork.alt}
              fill
              sizes="100vw"
              className="object-cover opacity-20"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/70" />
          </div>
        ) : null}

        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_0.72fr] lg:items-end">
          <Reveal>
            <p className="text-sm uppercase tracking-[0.42em] text-accent">
              Zero-fee collection market
            </p>
            <h1 className="font-display mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-ivory sm:text-7xl">
              {collection.shortName}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-bone/70">
              {collection.description} Browse the floor, strongest bids, and
              focused discovery pages without leaving the collection.
            </p>
          </Reveal>

          <Reveal delayMs={100}>
            <div className="rounded-[2rem] border border-ivory/10 bg-ink/55 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.26em] text-accent">
                {formatCollectionSupplyLabel(collection, supply)}
              </p>
              <p className="font-display mt-3 text-2xl font-semibold tracking-[-0.03em] text-ivory">
                {collection.artSystem}
              </p>
              <p className="mt-4 text-sm leading-6 text-bone/75">
                View live listings, highest bids, and token detail pages for a
                clean collection-specific market.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mt-10">
        <MarketplaceControls
          collectionId={collectionId}
          search={search}
          totalOffers={visibleOffers.length}
        />
      </div>

      <div className="mt-6">
        <MarketplaceStatsGrid stats={stats} />
      </div>

      {activeView === "discover" && tokenPage ? (
        <section className="mt-12">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-accent">
                  Discover
                </p>
                <h2 className="font-display mt-2 text-3xl font-semibold tracking-[-0.04em] text-ivory">
                  Browse {collection.shortName} NFTs
                </h2>
              </div>
              <p className="rounded-full border border-ivory/10 bg-ivory/[0.045] px-4 py-2 text-sm text-bone/75">
                {tokenPage.totalItems.toLocaleString("en-US")} tokens
              </p>
            </div>
          </Reveal>

          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {tokenPage.items.map((item) => (
              <MarketplaceTokenCard
                key={`${item.token.collectionId}-${item.token.tokenId}`}
                item={item}
              />
            ))}
          </div>

          <MarketplacePagination
            collectionId={collectionId}
            search={search}
            page={tokenPage.page}
            totalPages={tokenPage.totalPages}
          />
        </section>
      ) : null}

      {activeView === "listings" || activeView === "top-bids" ? (
        <section className="mt-12">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-accent">
                  {activeView === "top-bids" ? "Top bids" : "Listings"}
                </p>
                <h2 className="font-display mt-2 text-3xl font-semibold tracking-[-0.04em] text-ivory">
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
          </Reveal>

          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleOffers.map((offer) => (
              <MarketplaceCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>
      ) : null}

      {!visibleOffers.length && !tokenPage?.items.length ? (
        <div className="relative mt-12 overflow-hidden rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-10 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
          >
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-copper/30" />
            <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full border border-chartreuse/20" />
          </div>
          <div className="relative">
            <h2 className="font-display text-2xl font-semibold text-ivory">
              Nothing matched this view
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-bone/78">
              Try widening the price range, clearing the token filter, or
              switching to another marketplace view.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href={path}
                className="inline-flex h-11 items-center justify-center rounded-full bg-copper px-5 text-sm font-semibold text-ink transition hover:bg-ember"
              >
                Reset filters
              </a>
              <a
                href={collectionMarketHref({
                  collectionId,
                  search: { collection: collectionId },
                  view: "listings",
                })}
                className="inline-flex h-11 items-center justify-center rounded-full border border-ivory/15 bg-ivory/[0.04] px-5 text-sm font-semibold text-ivory transition hover:bg-ivory/[0.09]"
              >
                View listings
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
