import Image from "next/image";

import { requireCollection } from "@/config/collections";
import type { MarketOffer } from "@/lib/marketplace/types";
import {
  formatDate,
  formatEth,
  formatTokenId,
  shortenAddress,
} from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";

export function MarketplaceCard({ offer }: { offer: MarketOffer }) {
  const collection = requireCollection(offer.collectionId);
  const tokenName = `${collection.shortName} ${formatTokenId(offer.tokenId)}`;

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-copper/35 hover:bg-ivory/[0.07]">
      <div className="relative aspect-square overflow-hidden bg-carbon">
        {offer.artwork ? (
          <Image
            src={offer.artwork.image}
            alt={offer.artwork.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="grid h-full place-items-center text-bone/75">
            Awaiting artwork
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full border border-ivory/15 bg-ink/72 px-3 py-1 text-xs uppercase tracking-[0.22em] text-ivory backdrop-blur">
          {offer.kind === "sell" ? "Sell listing" : "Buy offer"}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-copper">
            {collection.shortName}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-ivory">{tokenName}</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-ink/48 p-3">
            <p className="text-bone/75">Price</p>
            <p className="mt-1 font-semibold text-chartreuse">
              {formatEth(offer.priceEth)}
            </p>
          </div>
          <div className="rounded-2xl bg-ink/48 p-3">
            <p className="text-bone/75">Maker</p>
            <p className="mt-1 font-semibold text-ivory">
              {offer.maker === "0x0000000000000000000000000000000000000000"
                ? "On-chain"
                : shortenAddress(offer.maker)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-bone/75">
            {offer.createdAt === "1970-01-01T00:00:00.000Z"
              ? "Live Random Walk order"
              : formatDate(offer.createdAt)}
          </p>
          <ButtonLink
            href={`/token/${offer.collectionId}/${offer.tokenId}`}
            variant="secondary"
          >
            View token
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
