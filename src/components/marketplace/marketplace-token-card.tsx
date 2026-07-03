import Image from "next/image";
import Link from "next/link";

import { requireCollection } from "@/config/collections";
import type { TokenMarketSummary } from "@/lib/marketplace/types";
import { AnchorStatusPill } from "@/components/marketplace/anchor-status-pill";
import { WatchButton } from "@/components/marketplace/watch-button";
import { ButtonLink } from "@/components/ui/button";
import { tokenPath } from "@/lib/marketplace/routes";
import { formatEthWithUsd } from "@/lib/pricing/eth-usd";
import {
  formatEth,
  formatFloorDelta,
  formatTokenId,
  shortenAddress,
} from "@/lib/utils";
import { sameAddress } from "@/lib/marketplace/trading-actions";

export function MarketplaceTokenCard({
  item,
  usdPerEth,
  floorPriceEth,
}: {
  item: TokenMarketSummary;
  usdPerEth?: number;
  floorPriceEth?: number;
}) {
  const collection = requireCollection(item.token.collectionId);
  const listingUsd = item.activeSellOffer
    ? formatEthWithUsd(item.activeSellOffer.priceEth, usdPerEth)
    : undefined;
  const floorDelta = item.activeSellOffer
    ? formatFloorDelta(item.activeSellOffer.priceEth, floorPriceEth)
    : undefined;
  const listingContext = [
    listingUsd ? `≈ ${listingUsd}` : undefined,
    floorDelta,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      data-accent={collection.accent}
      className="group overflow-hidden rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-1 hover:border-accent hover:bg-ivory/[0.07]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-carbon">
        <Image
          src={item.token.artwork.image}
          alt={item.token.artwork.alt}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
          className="object-contain p-3 transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute left-4 top-4 rounded-full border border-ivory/15 bg-ink/72 px-3 py-1 text-xs uppercase tracking-[0.22em] text-ivory backdrop-blur">
          {collection.shortName}
        </div>
        {item.token.rating !== undefined ? (
          <div className="absolute right-4 top-4 rounded-full border border-olive/30 bg-olive/15 px-3 py-1 text-xs font-semibold text-chartreuse backdrop-blur">
            <span>Beauty {item.token.rating.toFixed(1)}</span>
            <span className="sr-only">
              , the aesthetic score from collection metadata
            </span>
          </div>
        ) : null}
        {item.highestBid ? (
          <div className="absolute bottom-4 left-4 rounded-full border border-chartreuse/25 bg-chartreuse/12 px-3 py-1 text-xs font-semibold text-chartreuse backdrop-blur">
            <span>Bid {formatEth(item.highestBid.priceEth)}</span>
            <span className="sr-only">, the highest active bid</span>
          </div>
        ) : null}
        <AnchorStatusPill
          anchored={item.token.anchored}
          inVault={sameAddress(item.token.owner, collection.anchoringWalletAddress)}
          className="absolute bottom-4 right-4"
        />
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-accent">
            {item.token.name}
          </p>
          <h3 className="font-display mt-2 text-2xl font-semibold text-ivory">
            {formatTokenId(item.token.tokenId)}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-ink/48 p-3">
            <p className="text-bone/75">Listing</p>
            <p className="font-display mt-1 text-lg font-semibold text-chartreuse">
              {item.activeSellOffer
                ? formatEth(item.activeSellOffer.priceEth)
                : "Unlisted"}
            </p>
            {listingContext ? (
              <p
                className={`mt-1 text-xs ${
                  floorDelta === "At floor"
                    ? "font-semibold text-chartreuse"
                    : "text-bone/70"
                }`}
              >
                {listingContext}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl bg-ink/48 p-3">
            <p className="text-bone/75">Owner</p>
            <p className="mt-1 font-semibold text-ivory">
              {shortenAddress(item.token.owner)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-ivory/10 bg-ink/35 p-3 text-sm text-bone/75 opacity-0 transition duration-300 group-hover:opacity-100">
          <p>
            {item.offers.length
              ? `${item.offers.length} active order${
                  item.offers.length === 1 ? "" : "s"
                }`
              : "No active orders"}
          </p>
          {item.token.mintedAt ? (
            <p className="mt-1 text-xs text-bone/60">
              Minted {new Date(item.token.mintedAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link
            href={tokenPath(item.token.collectionId, item.token.tokenId)}
            className="text-xs text-bone/75 transition hover:text-ivory"
          >
            View details
          </Link>
          <div className="flex items-center gap-2">
            <WatchButton
              collectionId={item.token.collectionId}
              tokenId={item.token.tokenId}
            />
            <ButtonLink
              href={tokenPath(item.token.collectionId, item.token.tokenId)}
              variant="secondary"
            >
              View and bid
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}
