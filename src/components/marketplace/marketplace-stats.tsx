import Link from "next/link";

import type { MarketplaceStats } from "@/lib/marketplace/types";
import { tokenPath } from "@/lib/marketplace/routes";
import { formatEth } from "@/lib/utils";

const statLabel = (value: number | undefined) =>
  value === undefined ? "N/A" : formatEth(value);

const tokenHref = (
  offer: MarketplaceStats["floorOffer"] | MarketplaceStats["topBidOffer"],
) => (offer ? tokenPath(offer.collectionId, offer.tokenId) : undefined);

export function MarketplaceStatsGrid({ stats }: { stats: MarketplaceStats }) {
  const items = [
    {
      label: "Platform fee",
      value: "0%",
      detail:
        "No cuts — the full amount goes directly between buyer and seller.",
    },
    {
      label: "Sale listings",
      value: stats.sellListings.toString(),
      detail: `${stats.buyOffers} active bid${stats.buyOffers === 1 ? "" : "s"}.`,
    },
    {
      label: "Floor Price",
      value: statLabel(stats.floorOffer?.priceEth),
      detail: "Cheapest NFT listed for sale.",
      href: tokenHref(stats.floorOffer),
    },
    {
      label: "Top Bid",
      value: statLabel(stats.topBidOffer?.priceEth),
      detail: "Highest active bid.",
      href: tokenHref(stats.topBidOffer),
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const cardClass =
          "rounded-[1.6rem] border border-ivory/10 bg-ivory/[0.04] p-5 transition";
        const content = (
          <>
            <p className="text-xs uppercase tracking-[0.24em] text-bone/75">
              {item.label}
            </p>
            <p className="mt-3 text-2xl font-semibold text-ivory">
              {item.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-bone/75">{item.detail}</p>
          </>
        );

        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={`${cardClass} hover:border-copper/35 hover:bg-ivory/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse`}
          >
            {content}
          </Link>
        ) : (
          <div key={item.label} className={cardClass}>
            {content}
          </div>
        );
      })}
    </section>
  );
}
