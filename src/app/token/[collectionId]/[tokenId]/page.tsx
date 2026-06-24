import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireCollection } from "@/config/collections";
import { TokenActions } from "@/components/marketplace/token-actions";
import type { CollectionId } from "@/lib/marketplace/types";
import { getOffersForToken, getToken } from "@/lib/marketplace/queries";
import { formatDate, formatEth, formatTokenId, shortenAddress } from "@/lib/utils";

type Params = Promise<{ collectionId: CollectionId; tokenId: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { collectionId, tokenId } = await params;
  const parsedTokenId = Number(tokenId);
  const token = Number.isFinite(parsedTokenId)
    ? getToken(collectionId, parsedTokenId)
    : undefined;

  return {
    title: token?.name ?? "Token",
    description: token
      ? `${token.name} on Axiom Zero.`
      : "NFT detail on Axiom Zero.",
  };
}

export default async function TokenPage({ params }: { params: Params }) {
  const { collectionId, tokenId } = await params;
  const parsedTokenId = Number(tokenId);

  if (!Number.isFinite(parsedTokenId)) {
    notFound();
  }

  const collection = requireCollection(collectionId);
  const token = getToken(collectionId, parsedTokenId);

  if (!token) {
    notFound();
  }

  const tokenOffers = getOffersForToken(collectionId, parsedTokenId);
  const activeSellOffer = tokenOffers
    .filter((offer) => offer.kind === "sell")
    .sort((left, right) => left.priceEth - right.priceEth)[0];

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-5">
        <div className="overflow-hidden rounded-[2.5rem] border border-ivory/10 bg-carbon p-4 shadow-[0_40px_140px_rgba(0,0,0,0.32)]">
          <div className="relative aspect-square overflow-hidden rounded-[2rem]">
            <Image
              src={token.artwork.image}
              alt={token.artwork.alt}
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        <TokenActions
          collection={collection}
          tokenId={token.tokenId}
          activeSellOffer={activeSellOffer}
        />
      </section>

      <section>
        <p className="text-sm uppercase tracking-[0.42em] text-copper">
          {collection.shortName}
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-ivory sm:text-7xl">
          {token.name}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-bone/70">
          {collection.description}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-ivory/10 bg-ivory/[0.045] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-bone/75">
              Token
            </p>
            <p className="mt-2 font-semibold text-ivory">
              {formatTokenId(token.tokenId)}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-ivory/10 bg-ivory/[0.045] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-bone/75">
              Owner
            </p>
            <p className="mt-2 font-semibold text-ivory">
              {shortenAddress(token.owner)}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-ivory/10 bg-ivory/[0.045] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-bone/75">
              Best listing
            </p>
            <p className="mt-2 font-semibold text-chartreuse">
              {activeSellOffer ? formatEth(activeSellOffer.priceEth) : "Unlisted"}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
            <h2 className="text-xl font-semibold text-ivory">Generative notes</h2>
            <dl className="mt-5 space-y-3">
              {token.traits.map((trait) => (
                <div key={trait.label} className="flex justify-between gap-4">
                  <dt className="text-bone/75">{trait.label}</dt>
                  <dd className="text-right font-medium text-ivory">
                    {trait.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 break-all rounded-2xl bg-ink/55 p-4 font-mono text-xs leading-6 text-bone/78">
              {token.seed}
            </p>
          </section>

          <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
            <h2 className="text-xl font-semibold text-ivory">Order book</h2>
            <div className="mt-5 space-y-3">
              {tokenOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-ink/55 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-ivory">
                      {offer.kind === "sell" ? "Listing" : "Bid"}
                    </p>
                    <p className="mt-1 text-xs text-bone/75">
                      {formatDate(offer.createdAt)}
                    </p>
                  </div>
                  <p className="font-semibold text-chartreuse">
                    {formatEth(offer.priceEth)}
                  </p>
                </div>
              ))}
              {!tokenOffers.length ? (
                <p className="rounded-2xl bg-ink/55 p-4 text-sm text-bone/78">
                  No active listings or bids yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
