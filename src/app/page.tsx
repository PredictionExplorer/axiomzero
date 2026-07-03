import Link from "next/link";
import { ArrowUpRight, Equal, Percent, Sparkles } from "lucide-react";
import type { Metadata } from "next";

import { requireCollection } from "@/config/collections";
import { ArtSystemsSection } from "@/components/home/art-systems-section";
import { FeaturedArtworksRail } from "@/components/home/featured-artworks-rail";
import { HomeFaqSection } from "@/components/home/home-faq-section";
import { HomeHero } from "@/components/home/home-hero";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { MarketActivitySection } from "@/components/home/market-activity-section";
import { MarketPulseStrip } from "@/components/home/market-pulse-strip";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import {
  BRAND_NAME,
  FOUNDATION_STATEMENT,
  ZERO_PROMISES,
} from "@/lib/brand";
import {
  getHomeHeroArtworks,
  getHomeMarketOverview,
  pickArtSystemShowcases,
  type HomeCollectionPulse,
} from "@/lib/marketplace/home-data";
import { formatCollectionSupplyLabel } from "@/lib/marketplace/collection-supply";
import {
  collectionPath,
  MY_NFTS_PATH,
  tokenPath,
} from "@/lib/marketplace/routes";
import type { Collection, MarketOffer } from "@/lib/marketplace/types";
import { getEthUsdPrice } from "@/lib/pricing/eth-usd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { formatEth, formatTokenId } from "@/lib/utils";

export const metadata: Metadata = buildPageMetadata({
  title: "Generative NFT Marketplace",
  path: "/",
});

function MarketMetric({
  label,
  offer,
  emptyLabel,
  collection,
}: {
  label: string;
  offer: MarketOffer | undefined;
  emptyLabel: string;
  collection: Collection;
}) {
  const content = (
    <>
      <span className="text-xs uppercase tracking-[0.24em] text-bone/70">
        {label}
      </span>
      <span className="font-display mt-3 block text-2xl font-semibold text-ivory">
        {offer ? formatEth(offer.priceEth) : "N/A"}
      </span>
      <span className="mt-2 block text-xs leading-5 text-bone/72">
        {offer
          ? `${collection.shortName} ${formatTokenId(offer.tokenId)}`
          : emptyLabel}
      </span>
    </>
  );
  const className =
    "rounded-[1.35rem] border border-ivory/10 bg-ink/50 p-4 text-left transition";

  return offer ? (
    <Link
      href={tokenPath(offer.collectionId, offer.tokenId)}
      aria-label={`${collection.shortName} ${label} ${formatEth(
        offer.priceEth,
      )}`}
      className={`${className} hover:border-copper/35 hover:bg-ivory/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse`}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function CollectionCard({ pulse }: { pulse: HomeCollectionPulse }) {
  const collection = requireCollection(pulse.collectionId);

  return (
    <article
      data-accent={collection.accent}
      className="rounded-[2rem] border border-accent bg-accent-muted p-6 transition hover:-translate-y-1 hover:bg-ivory/[0.07]"
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-accent">
            {formatCollectionSupplyLabel(collection, pulse.supply)}
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-ivory">
            {collection.shortName}
          </h2>
        </div>
        <ArrowUpRight className="text-bone/75 transition" />
      </div>
      <p className="mt-5 max-w-xl leading-7 text-bone/78">
        {collection.description}
      </p>
      <p className="mt-5 font-mono text-sm text-bone/75">
        {collection.artSystem}
      </p>

      <div className="mt-6 grid gap-3">
        <MarketMetric
          label="Floor price"
          offer={pulse.stats.floorOffer}
          emptyLabel="No active listings"
          collection={collection}
        />
        <MarketMetric
          label="Highest bid"
          offer={pulse.stats.topBidOffer}
          emptyLabel="No active bids"
          collection={collection}
        />
      </div>

      <ButtonLink
        href={collectionPath(collection.id)}
        className="mt-6"
        variant="secondary"
      >
        Explore {collection.shortName}
      </ButtonLink>
    </article>
  );
}

export default async function Home() {
  const [heroArtworks, overview, usdPerEth] = await Promise.all([
    getHomeHeroArtworks(),
    getHomeMarketOverview(),
    getEthUsdPrice().catch(() => undefined),
  ]);
  const showcases = pickArtSystemShowcases(heroArtworks);

  return (
    <div className="overflow-hidden">
      <HomeHero artworks={heroArtworks} />
      <MarketPulseStrip pulses={overview.pulses} />
      <MarketActivitySection activity={overview.activity} usdPerEth={usdPerEth} />
      <HowItWorksSection />

      <section
        id="collections"
        className="mx-auto grid max-w-7xl gap-4 px-5 py-20 sm:px-8 lg:grid-cols-3"
      >
        <Reveal>
          <article className="rounded-[2rem] border border-copper/20 bg-copper/10 p-6">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-copper">
                  wallet workspace
                </p>
                <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-ivory">
                  My NFTs
                </h2>
              </div>
              <ArrowUpRight className="text-bone/75" />
            </div>
            <p className="mt-5 leading-7 text-bone/78">
              Connect your wallet to see owned NFTs, review bids, and manage
              listings across both Axiom Zero collections.
            </p>
            <ButtonLink href={MY_NFTS_PATH} className="mt-6" variant="secondary">
              Open My NFTs
            </ButtonLink>
          </article>
        </Reveal>

        {overview.pulses.map((pulse, index) => (
          <Reveal key={pulse.collectionId} delayMs={(index + 1) * 80}>
            <CollectionCard pulse={pulse} />
          </Reveal>
        ))}
      </section>

      <ArtSystemsSection showcases={showcases} />
      <FeaturedArtworksRail items={overview.featured} />

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <Reveal>
          <div className="rounded-[2.5rem] border border-copper/20 bg-copper/10 p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <p className="text-sm uppercase tracking-[0.34em] text-copper">
                  Zero means zero
                </p>
                <h2 className="font-display mt-4 text-4xl font-semibold tracking-[-0.05em] text-ivory sm:text-5xl">
                  Founders get no special privilege.
                </h2>
                <p className="mt-5 max-w-xl leading-7 text-bone/78">
                  {BRAND_NAME} exists for collections with fair-launch energy:
                  equal market access, transparent rules, and no reserved
                  founder advantage.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {ZERO_PROMISES.map((promise) => (
                  <div
                    key={promise.label}
                    className="rounded-[1.5rem] border border-ivory/10 bg-ink/55 p-4"
                  >
                    <p className="font-semibold text-ivory">{promise.label}</p>
                    <p className="mt-2 text-sm leading-6 text-bone/78">
                      {promise.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-20 sm:px-8 md:grid-cols-3">
        {[
          [Sparkles, "Math, code, algorithms", FOUNDATION_STATEMENT],
          [
            Equal,
            "Fair launch, no founder privilege",
            "No reserved founder mints, no insider allocations, and no creator advantage.",
          ],
          [
            Percent,
            "0% marketplace fees",
            "Axiom Zero adds no platform fee to the trade.",
          ],
        ].map(([Icon, title, copy], index) => {
          const TypedIcon = Icon as typeof Sparkles;

          return (
            <Reveal key={title as string} delayMs={index * 80}>
              <div className="rounded-[2rem] border border-ivory/10 bg-carbon p-6">
                <TypedIcon className="text-chartreuse" />
                <h3 className="mt-5 text-xl font-semibold text-ivory">
                  {title as string}
                </h3>
                <p className="mt-3 text-sm leading-6 text-bone/78">
                  {copy as string}
                </p>
              </div>
            </Reveal>
          );
        })}
      </section>

      <HomeFaqSection />
    </div>
  );
}
