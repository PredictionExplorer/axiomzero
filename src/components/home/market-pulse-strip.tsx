import Link from "next/link";

import { Reveal } from "@/components/ui/reveal";
import { GlossaryTip } from "@/components/ui/tooltip";
import type { GlossaryKey } from "@/lib/glossary";
import type { HomeCollectionPulse } from "@/lib/marketplace/home-data";
import { collectionPath, tokenPath } from "@/lib/marketplace/routes";
import { formatCollectionSupplyLabel } from "@/lib/marketplace/collection-supply";
import { requireCollection } from "@/config/collections";
import { formatEth } from "@/lib/utils";

export function MarketPulseStrip({
  pulses,
}: {
  pulses: HomeCollectionPulse[];
}) {
  return (
    <section className="border-y border-ivory/10 bg-ivory/[0.03]">
      <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:px-8 lg:grid-cols-2">
        {pulses.map((pulse, index) => {
          const collection = requireCollection(pulse.collectionId);

          return (
            <Reveal key={pulse.collectionId} delayMs={index * 80}>
              <article
                data-accent={collection.accent}
                className="rounded-[2rem] border border-accent bg-accent-muted p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-accent">
                      {pulse.shortName} market pulse
                    </p>
                    <h2 className="font-display mt-2 text-3xl font-semibold text-ivory">
                      {formatCollectionSupplyLabel(collection, pulse.supply)}
                    </h2>
                  </div>
                  <Link
                    href={collectionPath(pulse.collectionId)}
                    className="rounded-full border border-ivory/15 px-4 py-2 text-sm text-ivory transition hover:bg-ivory/[0.08]"
                  >
                    Explore
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <PulseStat
                    label="Floor"
                    termKey="floorPrice"
                    value={
                      pulse.stats.floorOffer
                        ? formatEth(pulse.stats.floorOffer.priceEth)
                        : "N/A"
                    }
                    href={
                      pulse.stats.floorOffer
                        ? tokenPath(
                            pulse.stats.floorOffer.collectionId,
                            pulse.stats.floorOffer.tokenId,
                          )
                        : undefined
                    }
                  />
                  <PulseStat
                    label="Top bid"
                    termKey="topBid"
                    value={
                      pulse.stats.topBidOffer
                        ? formatEth(pulse.stats.topBidOffer.priceEth)
                        : "N/A"
                    }
                    href={
                      pulse.stats.topBidOffer
                        ? tokenPath(
                            pulse.stats.topBidOffer.collectionId,
                            pulse.stats.topBidOffer.tokenId,
                          )
                        : undefined
                    }
                  />
                  <PulseStat
                    label="Listings"
                    termKey="listing"
                    tooltipAlign="end"
                    value={String(pulse.stats.sellListings)}
                  />
                  <PulseStat
                    label="Bids"
                    termKey="bid"
                    tooltipAlign="end"
                    value={String(pulse.stats.buyOffers)}
                  />
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function PulseStat({
  label,
  value,
  href,
  termKey,
  tooltipAlign = "start",
}: {
  label: string;
  value: string;
  href?: string;
  termKey: GlossaryKey;
  tooltipAlign?: "start" | "end";
}) {
  return (
    <div className="rounded-2xl border border-ivory/10 bg-ink/45 p-4">
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-bone/65">
        {label}
        <GlossaryTip termKey={termKey} align={tooltipAlign} side="bottom" />
      </span>
      {href ? (
        <Link
          href={href}
          aria-label={`${label} ${value} — view the token behind this price`}
          className="font-display mt-2 block text-xl font-semibold text-ivory underline decoration-ivory/25 decoration-2 underline-offset-4 transition hover:text-copper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse"
        >
          {value}
        </Link>
      ) : (
        <span className="font-display mt-2 block text-xl font-semibold text-ivory">
          {value}
        </span>
      )}
    </div>
  );
}
