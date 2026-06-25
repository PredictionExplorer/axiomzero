import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getCollection } from "@/config/collections";
import { TokenActions } from "@/components/marketplace/token-actions";
import type { CollectionId, MarketToken } from "@/lib/marketplace/types";
import {
  getToken,
  getTokenMarket,
  isTokenNotFoundError,
} from "@/lib/marketplace/queries";
import { getCollectionTokenIds } from "@/lib/marketplace/collection-index-live";
import { tokenPath } from "@/lib/marketplace/routes";
import {
  formatDate,
  formatEth,
  formatTokenId,
  shortenAddress,
} from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";

type Params = Promise<{ collectionId: string; tokenId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mediaHref(
  collectionId: CollectionId,
  tokenId: number,
  theme: "black" | "white",
  media: "image" | "single" | "triple",
) {
  return `/token/${collectionId}/${tokenId}?theme=${theme}&media=${media}`;
}

function resolveMedia(
  token: MarketToken,
  theme: "black" | "white",
  media: "image" | "single" | "triple",
) {
  const assets = token.assets;

  if (theme === "white") {
    if (media === "single" && assets?.whiteSingleVideo) {
      return { type: "video" as const, src: assets.whiteSingleVideo };
    }
    if (media === "triple" && assets?.whiteTripleVideo) {
      return { type: "video" as const, src: assets.whiteTripleVideo };
    }

    return {
      type: "image" as const,
      src: assets?.whiteImage ?? token.artwork.image,
    };
  }

  if (media === "single" && assets?.blackSingleVideo) {
    return { type: "video" as const, src: assets.blackSingleVideo };
  }
  if (media === "triple" && assets?.blackTripleVideo) {
    return { type: "video" as const, src: assets.blackTripleVideo };
  }

  return {
    type: "image" as const,
    src: assets?.blackImage ?? token.artwork.image,
  };
}

function formatFullDate(value: string | undefined) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function collectorSnapshotTrait(token: MarketToken) {
  if (token.rating !== undefined) {
    return {
      label: "Beauty score",
      value: token.rating.toFixed(2),
    };
  }

  const primaryTrait = token.traits.find(
    (trait) => trait.label.toLowerCase() !== "seed",
  );

  return {
    label: primaryTrait?.label ?? "Primary trait",
    value: primaryTrait?.value ?? "Not available",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { collectionId, tokenId } = await params;
  const parsedTokenId = Number(tokenId);
  const collection = getCollection(collectionId as CollectionId);
  const token =
    collection && Number.isFinite(parsedTokenId)
      ? await getToken(collection.id, parsedTokenId).catch(() => undefined)
      : undefined;

  return {
    title: token?.name ?? "Token",
    description: token
      ? `${token.name} on Axiom Zero.`
      : "NFT detail on Axiom Zero.",
  };
}

export default async function TokenPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { collectionId, tokenId } = await params;
  const resolvedSearchParams = await searchParams;
  const parsedTokenId = Number(tokenId);

  if (!Number.isFinite(parsedTokenId)) {
    notFound();
  }

  const collection = getCollection(collectionId as CollectionId);

  if (!collection) {
    notFound();
  }

  let market;

  try {
    market = await getTokenMarket(collection.id, parsedTokenId);
  } catch (error) {
    if (isTokenNotFoundError(error)) {
      notFound();
    }

    throw error;
  }

  const token = market.token;
  const tokenOffers = market.offers;
  const activeSellOffer = tokenOffers
    .filter((offer) => offer.kind === "sell")
    .sort((left, right) => left.priceEth - right.priceEth)[0];
  const highestBid = tokenOffers
    .filter((offer) => offer.kind === "buy")
    .sort((left, right) => right.priceEth - left.priceEth)[0];
  const theme =
    firstValue(resolvedSearchParams.theme) === "white" ? "white" : "black";
  const mediaParam = firstValue(resolvedSearchParams.media);
  const media =
    mediaParam === "single" || mediaParam === "triple" ? mediaParam : "image";
  const selectedMedia = resolveMedia(token, theme, media);
  const snapshotTrait = collectorSnapshotTrait(token);
  const tokenIds = await getCollectionTokenIds(collection.id);
  const tokenIndex = tokenIds.indexOf(token.tokenId);
  const previousTokenId = tokenIndex > 0 ? tokenIds[tokenIndex - 1] : undefined;
  const nextTokenId =
    tokenIndex >= 0 && tokenIndex < tokenIds.length - 1
      ? tokenIds[tokenIndex + 1]
      : undefined;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-5">
        <div className="overflow-hidden rounded-[2.5rem] border border-ivory/10 bg-carbon p-4 shadow-[0_40px_140px_rgba(0,0,0,0.32)]">
          <div className="relative aspect-square overflow-hidden rounded-[2rem]">
            {selectedMedia.type === "image" ? (
              <Image
                src={selectedMedia.src}
                alt={token.artwork.alt}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-contain p-4"
              />
            ) : (
              <video
                src={selectedMedia.src}
                className="h-full w-full object-contain p-4"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["black", "white"] as const).map((option) => (
              <ButtonLink
                key={option}
                href={mediaHref(collection.id, token.tokenId, option, media)}
                variant={theme === option ? "primary" : "secondary"}
                className="h-9 px-4"
              >
                {option === "black" ? "Dark" : "Light"}
              </ButtonLink>
            ))}
            {(["image", "single", "triple"] as const).map((option) => (
              <ButtonLink
                key={option}
                href={mediaHref(collection.id, token.tokenId, theme, option)}
                variant={media === option ? "primary" : "secondary"}
                className="h-9 px-4"
              >
                {option === "image"
                  ? "Image"
                  : option === "single"
                    ? "Single video"
                    : "Triple video"}
              </ButtonLink>
            ))}
          </div>
          <div className="mt-4 flex justify-between gap-3">
            {previousTokenId === undefined ? (
              <Button type="button" variant="secondary" disabled>
                Prev token
              </Button>
            ) : (
              <ButtonLink
                href={tokenPath(collection.id, previousTokenId)}
                variant="secondary"
              >
                Prev token
              </ButtonLink>
            )}
            {nextTokenId === undefined ? (
              <Button type="button" variant="secondary" disabled>
                Next token
              </Button>
            ) : (
              <ButtonLink
                href={tokenPath(collection.id, nextTokenId)}
                variant="secondary"
              >
                Next token
              </ButtonLink>
            )}
          </div>
        </div>

        <TokenActions
          collection={collection}
          tokenId={token.tokenId}
          activeSellOffer={activeSellOffer}
          offers={tokenOffers}
        />
      </section>

      <section>
        <p className="text-sm uppercase tracking-[0.42em] text-copper">
          NFT detail
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-ivory sm:text-7xl">
          {formatTokenId(token.tokenId)}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-bone/70">
          View artwork, check the order book, and buy, bid, list, or transfer
          this token.
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
              Current listing
            </p>
            <p className="mt-2 font-semibold text-chartreuse">
              {activeSellOffer
                ? formatEth(activeSellOffer.priceEth)
                : "Unlisted"}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
            <h2 className="text-xl font-semibold text-ivory">
              Collector snapshot
            </h2>
            <dl className="mt-5 space-y-3">
              <div className="flex justify-between gap-4">
                <dt className="text-bone/75">Owner</dt>
                <dd className="text-right font-medium text-ivory">
                  {shortenAddress(token.owner, 6)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-bone/75">{snapshotTrait.label}</dt>
                <dd className="text-right font-medium text-ivory">
                  {snapshotTrait.value}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-bone/75">Minted</dt>
                <dd className="text-right font-medium text-ivory">
                  {formatFullDate(token.mintedAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-bone/75">Highest bid</dt>
                <dd className="text-right font-medium text-ivory">
                  {highestBid ? formatEth(highestBid.priceEth) : "No bids yet"}
                </dd>
              </div>
            </dl>
            <p className="mt-5 break-all rounded-2xl bg-ink/55 p-4 font-mono text-xs leading-6 text-bone/78">
              {token.seed}
            </p>
          </section>

          <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
            <h2 className="text-xl font-semibold text-ivory">
              Share and provenance
            </h2>
            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink
                href={tokenPath(collection.id, token.tokenId)}
                variant="secondary"
              >
                Copy detail link
              </ButtonLink>
              <ButtonLink href={token.artwork.image} variant="secondary">
                Copy image link
              </ButtonLink>
              {selectedMedia.type === "video" ? (
                <ButtonLink href={selectedMedia.src} variant="secondary">
                  Copy video link
                </ButtonLink>
              ) : null}
            </div>
          </section>
        </div>

        <section className="mt-8">
          <div className="grid grid-cols-3 rounded-full border border-ivory/10 bg-ivory/[0.045] p-1 text-center text-sm font-semibold text-bone">
            <span className="rounded-full bg-copper px-4 py-2 text-ink">
              Market
            </span>
            <span className="px-4 py-2">History</span>
            <span className="px-4 py-2">Collector notes</span>
          </div>

          <div className="mt-6 rounded-[2rem] border border-ivory/10 bg-ivory/[0.045]">
            <div className="border-b border-ivory/10 p-5">
              <h2 className="text-xl font-semibold text-ivory">Order book</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ivory/10 text-left text-xs uppercase tracking-[0.2em] text-bone/75">
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenOffers
                    .filter((offer) => offer.kind === "buy")
                    .sort((left, right) => right.priceEth - left.priceEth)
                    .map((offer) => (
                      <tr key={offer.id} className="border-b border-ivory/10">
                        <td className="px-4 py-4">
                          {offer.maker ===
                          "0x0000000000000000000000000000000000000000"
                            ? "Unknown"
                            : shortenAddress(offer.maker)}
                        </td>
                        <td className="px-4 py-4">
                          {formatEth(offer.priceEth)}
                        </td>
                        <td className="px-4 py-4">
                          {formatDate(offer.createdAt)}
                        </td>
                      </tr>
                    ))}
                  {!tokenOffers.some((offer) => offer.kind === "buy") ? (
                    <tr>
                      <td className="px-4 py-4 text-bone/75" colSpan={3}>
                        No active bids yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
            <h2 className="text-xl font-semibold text-ivory">History</h2>
            <div className="mt-5 space-y-3">
              {(token.tokenHistory ?? [])
                .slice()
                .reverse()
                .map((record) => (
                  <div
                    key={`${record.blockNumber}-${record.timestamp}-${record.offerId ?? "mint"}`}
                    className="grid gap-2 rounded-2xl bg-ink/55 p-4 text-sm sm:grid-cols-[1fr_auto]"
                  >
                    <p className="text-ivory">
                      Record {record.recordType}
                      {record.price ? ` · ${formatEth(record.price)}` : ""}
                    </p>
                    <p className="text-bone/75">
                      {formatFullDate(record.dateTime)}
                    </p>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
            <h2 className="text-xl font-semibold text-ivory">
              Collector notes
            </h2>
            <p className="mt-3 text-sm leading-6 text-bone/78">
              {collection.shortName} metadata and market data are sourced from
              public endpoints and verified Arbitrum contracts. Wallet actions
              still require a connected wallet and on-chain confirmation on
              Arbitrum.
            </p>
          </div>
        </section>
      </section>
    </div>
  );
}
