import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getCollection } from "@/config/collections";
import { TokenDetailTabs } from "@/components/marketplace/token-detail-tabs";
import {
  TokenCollectorNotesPanel,
  TokenHistoryPanel,
  TokenMarketPanel,
} from "@/components/marketplace/token-detail-panels";
import { TokenMediaViewer } from "@/components/marketplace/token-media-viewer";
import type { CollectionId } from "@/lib/marketplace/types";
import {
  getToken,
  getTokenMarket,
  isTokenNotFoundError,
} from "@/lib/marketplace/queries";
import { getCollectionTokenIds } from "@/lib/marketplace/collection-index-live";
import {
  buildTokenMediaModel,
  formatFullDate,
  parseTokenDetailState,
  primaryTokenTrait,
  sortOffersForDisplay,
  tokenDetailHref,
} from "@/lib/marketplace/token-detail";
import { formatEth, formatTokenId, shortenAddress } from "@/lib/utils";

type Params = Promise<{ collectionId: string; tokenId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
  const activeSellOffer = sortOffersForDisplay(tokenOffers, "sell")[0];
  const highestBid = sortOffersForDisplay(tokenOffers, "buy")[0];
  const requestedState = parseTokenDetailState(resolvedSearchParams);
  const mediaModel = buildTokenMediaModel(collection.id, token, requestedState);
  const snapshotTrait = primaryTokenTrait(token);
  const tokenIds = await getCollectionTokenIds(collection.id);
  const tokenIndex = tokenIds.indexOf(token.tokenId);
  const previousTokenId = tokenIndex > 0 ? tokenIds[tokenIndex - 1] : undefined;
  const nextTokenId =
    tokenIndex >= 0 && tokenIndex < tokenIds.length - 1
      ? tokenIds[tokenIndex + 1]
      : undefined;
  const previousHref =
    previousTokenId === undefined
      ? undefined
      : tokenDetailHref(collection.id, previousTokenId, mediaModel.state);
  const nextHref =
    nextTokenId === undefined
      ? undefined
      : tokenDetailHref(collection.id, nextTokenId, mediaModel.state);
  const detailHref = tokenDetailHref(
    collection.id,
    token.tokenId,
    mediaModel.state,
  );
  const stillImageHref =
    mediaModel.selectedMedia.type === "image"
      ? mediaModel.selectedMedia.src
      : (token.assets?.blackImage ?? token.artwork.image);
  const videoHref =
    mediaModel.selectedMedia.type === "video"
      ? mediaModel.selectedMedia.src
      : undefined;
  const tabs = [
    {
      id: "market" as const,
      label: "Market",
      href: tokenDetailHref(collection.id, token.tokenId, mediaModel.state, {
        tab: "market",
      }),
    },
    {
      id: "history" as const,
      label: "History",
      href: tokenDetailHref(collection.id, token.tokenId, mediaModel.state, {
        tab: "history",
      }),
    },
    {
      id: "notes" as const,
      label: "Collector notes",
      href: tokenDetailHref(collection.id, token.tokenId, mediaModel.state, {
        tab: "notes",
      }),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <TokenMediaViewer
          token={token}
          selectedMedia={mediaModel.selectedMedia}
          themeOptions={mediaModel.themeOptions}
          mediaOptions={mediaModel.mediaOptions}
          previousHref={previousHref}
          nextHref={nextHref}
        />

        <section className="rounded-[2.5rem] border border-ivory/10 bg-ivory/[0.045] p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.42em] text-copper">
            {collection.shortName} detail
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-ivory/10 bg-ink/45 px-3 py-1 text-sm font-semibold text-bone">
              {formatTokenId(token.tokenId)}
            </span>
            <span className="rounded-full border border-chartreuse/20 bg-chartreuse/10 px-3 py-1 text-sm font-semibold text-chartreuse">
              {activeSellOffer
                ? `Listed at ${formatEth(activeSellOffer.priceEth)}`
                : "Unlisted"}
            </span>
          </div>
          <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-ivory sm:text-7xl">
            {token.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-bone/72">
            {collection.description}
          </p>

          <dl className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroStat label="Owner" value={shortenAddress(token.owner, 6)} />
            <HeroStat label={snapshotTrait.label} value={snapshotTrait.value} />
            <HeroStat label="Minted" value={formatFullDate(token.mintedAt)} />
            <HeroStat
              label="Highest bid"
              value={highestBid ? formatEth(highestBid.priceEth) : "No bids"}
            />
          </dl>

          <div className="mt-8 rounded-[2rem] border border-ivory/10 bg-ink/40 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-bone/65">
              Seed
            </p>
            <p className="mt-3 break-all font-mono text-xs leading-6 text-bone/78">
              {token.seed || "Not available"}
            </p>
          </div>
        </section>
      </div>

      <TokenDetailTabs tabs={tabs} activeTab={mediaModel.state.tab}>
        {mediaModel.state.tab === "history" ? (
          <TokenHistoryPanel token={token} />
        ) : mediaModel.state.tab === "notes" ? (
          <TokenCollectorNotesPanel
            collection={collection}
            token={token}
            detailHref={detailHref}
            imageHref={stillImageHref}
            videoHref={videoHref}
          />
        ) : (
          <TokenMarketPanel
            collection={collection}
            token={token}
            activeSellOffer={activeSellOffer}
            highestBid={highestBid}
            offers={tokenOffers}
          />
        )}
      </TokenDetailTabs>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-ivory/10 bg-ink/45 p-4">
      <dt className="text-xs uppercase tracking-[0.22em] text-bone/65">
        {label}
      </dt>
      <dd className="mt-2 break-words font-semibold text-ivory">{value}</dd>
    </div>
  );
}
