import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/ui/reveal";
import { GlossaryTip } from "@/components/ui/tooltip";
import type { GlossaryKey } from "@/lib/glossary";
import type { HomeActivity } from "@/lib/marketplace/home-data";
import { tokenPath } from "@/lib/marketplace/routes";
import { formatEthWithUsd } from "@/lib/pricing/eth-usd";
import { formatEth, formatRelativeTime, formatTokenId } from "@/lib/utils";

function splitByCollection(
  activity: HomeActivity,
  value: (entry: HomeActivity["perCollection"][number]) => string,
) {
  return activity.perCollection
    .map((entry) => `${value(entry)} ${entry.shortName}`)
    .join(" · ");
}

function ActivityStat({
  label,
  value,
  detail,
  termKey,
}: {
  label: string;
  value: string;
  detail?: string;
  termKey?: GlossaryKey;
}) {
  return (
    <div className="rounded-[2rem] border border-ivory/10 bg-ink/55 p-6">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.28em] text-bone/70">
        {label}
        {termKey ? <GlossaryTip termKey={termKey} align="start" /> : null}
      </p>
      <p className="font-display mt-4 text-5xl font-semibold tracking-[-0.05em] text-ivory">
        {value}
      </p>
      {detail ? (
        <p className="mt-3 text-sm leading-6 text-bone/72">{detail}</p>
      ) : null}
    </div>
  );
}

/**
 * On-chain activity band: headline sale totals plus a rail of the latest
 * sales. Hidden entirely until the sales scan returns at least one sale, so
 * the page never brags about an empty market.
 */
export function MarketActivitySection({
  activity,
  usdPerEth,
}: {
  activity?: HomeActivity;
  usdPerEth?: number;
}) {
  if (!activity || activity.totalSales === 0) {
    return null;
  }

  const volumeUsd = formatEthWithUsd(activity.totalVolumeEth, usdPerEth);

  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-copper">
              Proof of activity
            </p>
            <h2 className="font-display mt-4 text-4xl font-semibold tracking-[-0.05em] text-ivory sm:text-5xl">
              Real trades, settled on-chain.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-bone/72">
            Every number here is read live from the verified marketplace
            contract on Arbitrum — no curation, no off-chain edits.
          </p>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Reveal>
          <ActivityStat
            label="NFTs sold"
            termKey="sold"
            value={activity.totalSales.toLocaleString("en-US")}
            detail={splitByCollection(activity, (entry) =>
              entry.sales.count.toLocaleString("en-US"),
            )}
          />
        </Reveal>
        <Reveal delayMs={80}>
          <ActivityStat
            label="ETH traded"
            termKey="volume"
            value={formatEth(activity.totalVolumeEth)}
            detail={
              volumeUsd
                ? `≈ ${volumeUsd} · ${splitByCollection(activity, (entry) =>
                    formatEth(entry.sales.volumeEth),
                  )}`
                : splitByCollection(activity, (entry) =>
                    formatEth(entry.sales.volumeEth),
                  )
            }
          />
        </Reveal>
        <Reveal delayMs={160}>
          <ActivityStat
            label="Active orders"
            termKey="orderBook"
            value={activity.activeOrders.toLocaleString("en-US")}
            detail="Live listings and bids open on the order book right now."
          />
        </Reveal>
      </div>

      {activity.recentSales.length ? (
        <div className="mt-10">
          <Reveal>
            <h3 className="text-xl font-semibold text-ivory">Latest sales</h3>
          </Reveal>
          <div className="mt-5 flex gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activity.recentSales.map((sale, index) => {
              const soldAgo = sale.soldAt
                ? formatRelativeTime(sale.soldAt)
                : undefined;

              return (
                <Reveal
                  key={`${sale.collectionId}-${sale.offerId}`}
                  delayMs={index * 60}
                >
                  <Link
                    href={tokenPath(sale.collectionId, sale.tokenId)}
                    className="group block w-[13.5rem] shrink-0 overflow-hidden rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] transition hover:-translate-y-1 hover:border-copper/35"
                  >
                    <div className="relative aspect-square bg-carbon">
                      {sale.artwork ? (
                        <Image
                          src={sale.artwork.image}
                          alt={sale.artwork.alt}
                          fill
                          sizes="13.5rem"
                          className="object-contain p-4 transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="grid h-full place-items-center px-4 text-center text-sm text-bone/70">
                          {formatTokenId(sale.tokenId)}
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-full border border-chartreuse/25 bg-ink/80 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-chartreuse backdrop-blur">
                        Sold
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="truncate text-xs uppercase tracking-[0.22em] text-bone/70">
                        {sale.name}
                      </p>
                      <p className="font-display mt-2 text-xl font-semibold text-chartreuse">
                        {formatEth(sale.priceEth)}
                      </p>
                      <p className="mt-1 text-xs text-bone/70">
                        {soldAgo ?? "Settled on-chain"}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
