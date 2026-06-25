import Image from "next/image";

import { requireCollection } from "@/config/collections";
import type { TokenMarketSummary } from "@/lib/marketplace/types";
import { ButtonLink } from "@/components/ui/button";
import { formatEth, formatTokenId, shortenAddress } from "@/lib/utils";

export function MarketplaceTokenCard({
  item,
}: {
  item: TokenMarketSummary;
}) {
  const collection = requireCollection(item.token.collectionId);

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-1 hover:border-copper/35 hover:bg-ivory/[0.07]">
      <div className="relative aspect-square overflow-hidden bg-carbon">
        <Image
          src={item.token.artwork.image}
          alt={item.token.artwork.alt}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
          className="object-contain p-4 transition duration-500 group-hover:scale-[1.025]"
        />
        <div className="absolute left-4 top-4 rounded-full border border-ivory/15 bg-ink/72 px-3 py-1 text-xs uppercase tracking-[0.22em] text-ivory backdrop-blur">
          {collection.shortName}
        </div>
        {item.highestBid ? (
          <div className="absolute bottom-4 left-4 rounded-full border border-chartreuse/25 bg-chartreuse/12 px-3 py-1 text-xs font-semibold text-chartreuse backdrop-blur">
            Bid {formatEth(item.highestBid.priceEth)}
          </div>
        ) : null}
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-copper">
            {item.token.name}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-ivory">
            {formatTokenId(item.token.tokenId)}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-ink/48 p-3">
            <p className="text-bone/75">Listing</p>
            <p className="mt-1 font-semibold text-chartreuse">
              {item.activeSellOffer
                ? formatEth(item.activeSellOffer.priceEth)
                : "Unlisted"}
            </p>
          </div>
          <div className="rounded-2xl bg-ink/48 p-3">
            <p className="text-bone/75">Owner</p>
            <p className="mt-1 font-semibold text-ivory">
              {shortenAddress(item.token.owner)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-bone/75">
            {item.offers.length
              ? `${item.offers.length} active order${
                  item.offers.length === 1 ? "" : "s"
                }`
              : "No active orders"}
          </p>
          <ButtonLink
            href={`/token/${item.token.collectionId}/${item.token.tokenId}`}
            variant="secondary"
          >
            View and bid
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
