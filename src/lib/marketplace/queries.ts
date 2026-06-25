import { collections, requireCollection } from "@/config/collections";
import type {
  CollectionId,
  MarketOffer,
  MarketplaceTokenPage,
  MarketplaceView,
  MarketplaceSearchParams,
  MarketplaceStats,
  OfferKind,
  SortKey,
  TokenMarketSummary,
} from "@/lib/marketplace/types";
import {
  fetchRandomWalkMarketplaceOffers,
  fetchRandomWalkMetadata,
  fetchRandomWalkTokenDetail,
} from "@/lib/marketplace/random-walk-live";
import { fetchCosmicSignatureMetadata } from "@/lib/marketplace/cosmic-signature-live";
import {
  fetchCollectionContractOffers,
  fetchContractOffersForTokenId,
} from "@/lib/marketplace/marketplace-contract-live";

const collectionIds = new Set(collections.map((collection) => collection.id));
const offerKinds = new Set(["buy", "sell"]);
const marketplaceViews = new Set(["discover", "listings", "top-bids", "my-nfts"]);
const sortKeys = new Set(["price-asc", "price-desc", "recent"]);
const DEFAULT_TOKEN_PAGE = 1;
const DEFAULT_TOKEN_PAGE_SIZE = 12;
const MAX_TOKEN_PAGE_SIZE = 24;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumber(value: string | string[] | undefined) {
  const resolved = firstValue(value);
  if (!resolved) {
    return undefined;
  }

  const parsed = Number(resolved);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseInteger(
  value: string | string[] | undefined,
  fallback: number,
  { min = 1, max = Number.MAX_SAFE_INTEGER } = {},
) {
  const parsed = Number(firstValue(value));

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export function parseMarketplaceSearchParams(
  params: Record<string, string | string[] | undefined>,
): MarketplaceSearchParams {
  const collection = firstValue(params.collection);
  const kind = firstValue(params.kind);
  const view = firstValue(params.view);
  const sort = firstValue(params.sort);
  const parsedView = marketplaceViews.has(view as MarketplaceView)
    ? (view as MarketplaceView)
    : "discover";
  const fallbackKind =
    parsedView === "top-bids"
      ? "buy"
      : parsedView === "listings"
        ? "sell"
        : firstValue(params.filter) === "buy"
          ? "buy"
          : firstValue(params.filter) === "sell"
            ? "sell"
            : "sell";

  return {
    collection:
      collection && collectionIds.has(collection as CollectionId)
        ? (collection as CollectionId)
        : "all",
    kind:
      kind && offerKinds.has(kind as OfferKind)
        ? (kind as OfferKind)
        : fallbackKind,
    view: parsedView,
    query: firstValue(params.query)?.trim() || undefined,
    min: parseNumber(params.min),
    max: parseNumber(params.max),
    sort:
      sort && sortKeys.has(sort as SortKey)
        ? (sort as SortKey)
        : parsedView === "top-bids"
          ? "price-desc"
          : "price-asc",
    page: parseInteger(params.page, DEFAULT_TOKEN_PAGE),
    pageSize: parseInteger(params.pageSize, DEFAULT_TOKEN_PAGE_SIZE, {
      min: 1,
      max: MAX_TOKEN_PAGE_SIZE,
    }),
  };
}

export function filterOffers(
  allOffers: MarketOffer[],
  search: MarketplaceSearchParams,
) {
  return allOffers.filter((offer) => {
    if (search.collection && search.collection !== "all") {
      if (offer.collectionId !== search.collection) {
        return false;
      }
    }

    if (search.kind && search.kind !== "all" && offer.kind !== search.kind) {
      return false;
    }

    if (search.query) {
      const tokenId = Number(search.query.replace(/^#/, ""));
      if (!Number.isFinite(tokenId) || offer.tokenId !== tokenId) {
        return false;
      }
    }

    if (search.min !== undefined && offer.priceEth < search.min) {
      return false;
    }

    if (search.max !== undefined && offer.priceEth > search.max) {
      return false;
    }

    return true;
  });
}

export function sortOffers(
  allOffers: MarketOffer[],
  sort: SortKey = "price-asc",
) {
  return [...allOffers].sort((left, right) => {
    if (sort === "price-desc") {
      return right.priceEth - left.priceEth;
    }

    if (sort === "recent") {
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    }

    return left.priceEth - right.priceEth;
  });
}

async function getMarketplaceOffersForCollection(
  collectionId: CollectionId,
  search: MarketplaceSearchParams,
) {
  const requestedKind =
    search.kind && search.kind !== "all" ? search.kind : "sell";

  if (collectionId === "random-walk") {
    return search.kind === "all"
      ? [
          ...(await fetchRandomWalkMarketplaceOffers("sell", search.sort)),
          ...(await fetchRandomWalkMarketplaceOffers("buy", search.sort)),
        ]
      : await fetchRandomWalkMarketplaceOffers(requestedKind, search.sort);
  }

  const collection = requireCollection(collectionId);
  const offers = await fetchCollectionContractOffers({
    collectionId,
    nftAddress: collection.nftAddress,
    marketplaceAddress: collection.marketplaceAddress,
    loadToken: fetchCosmicSignatureMetadata,
  });

  return search.kind === "all"
    ? offers
    : offers.filter((offer) => offer.kind === requestedKind);
}

export async function getMarketplaceOffers(search: MarketplaceSearchParams) {
  const requestedCollections =
    search.collection && search.collection !== "all"
      ? [search.collection]
      : collections.map((collection) => collection.id);
  const offers = (
    await Promise.all(
      requestedCollections.map((collectionId) =>
        getMarketplaceOffersForCollection(collectionId, search),
      ),
    )
  ).flat();

  return sortOffers(filterOffers(offers, search), search.sort);
}

export function getMarketplaceStats(
  allOffers: MarketOffer[],
): MarketplaceStats {
  return {
    totalOffers: allOffers.length,
    lowestPrice: allOffers.length
      ? Math.min(...allOffers.map((offer) => offer.priceEth))
      : undefined,
    highestPrice: allOffers.length
      ? Math.max(...allOffers.map((offer) => offer.priceEth))
      : undefined,
    sellListings: allOffers.filter((offer) => offer.kind === "sell").length,
    buyOffers: allOffers.filter((offer) => offer.kind === "buy").length,
  };
}

export function summarizeTokenMarket(
  tokenMarket: {
    token: TokenMarketSummary["token"];
    offers: MarketOffer[];
  },
): TokenMarketSummary {
  return {
    ...tokenMarket,
    activeSellOffer: sortOffers(
      tokenMarket.offers.filter((offer) => offer.kind === "sell"),
      "price-asc",
    )[0],
    highestBid: sortOffers(
      tokenMarket.offers.filter((offer) => offer.kind === "buy"),
      "price-desc",
    )[0],
  };
}

function tokenCandidates(search: MarketplaceSearchParams) {
  const requestedCollections =
    search.collection && search.collection !== "all"
      ? collections.filter((collection) => collection.id === search.collection)
      : collections;
  const tokenQuery = search.query
    ? Number(search.query.replace(/^#/, ""))
    : undefined;

  if (search.query && !Number.isInteger(tokenQuery)) {
    return [];
  }

  return requestedCollections.flatMap((collection) => {
    if (tokenQuery !== undefined) {
      return tokenQuery >= collection.tokenRange.start &&
        tokenQuery <= collection.tokenRange.end
        ? [{ collectionId: collection.id, tokenId: tokenQuery }]
        : [];
    }

    return Array.from(
      {
        length: collection.tokenRange.end - collection.tokenRange.start + 1,
      },
      (_, index) => ({
        collectionId: collection.id,
        tokenId: collection.tokenRange.start + index,
      }),
    );
  });
}

export async function getMarketplaceTokenPage(
  search: MarketplaceSearchParams,
): Promise<MarketplaceTokenPage> {
  const candidates = tokenCandidates(search);
  const pageSize = search.pageSize ?? DEFAULT_TOKEN_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(candidates.length / pageSize));
  const page = Math.min(search.page ?? DEFAULT_TOKEN_PAGE, totalPages);
  const offset = (page - 1) * pageSize;
  const pageCandidates = candidates.slice(offset, offset + pageSize);
  const items = (
    await Promise.all(
      pageCandidates.map(async ({ collectionId, tokenId }) => {
        try {
          return summarizeTokenMarket(await getTokenMarket(collectionId, tokenId));
        } catch {
          return undefined;
        }
      }),
    )
  ).filter((item): item is TokenMarketSummary => Boolean(item));

  return {
    items,
    page,
    pageSize,
    totalItems: candidates.length,
    totalPages,
  };
}

export async function getToken(collectionId: CollectionId, tokenId: number) {
  if (collectionId === "random-walk") {
    try {
      return (await fetchRandomWalkTokenDetail(tokenId)).token;
    } catch {
      return fetchRandomWalkMetadata(tokenId);
    }
  }

  return fetchCosmicSignatureMetadata(tokenId);
}

export async function getOffersForToken(
  collectionId: CollectionId,
  tokenId: number,
) {
  if (collectionId === "random-walk") {
    return (await fetchRandomWalkTokenDetail(tokenId)).offers;
  }

  const collection = requireCollection(collectionId);
  const token = await fetchCosmicSignatureMetadata(tokenId);

  return fetchContractOffersForTokenId({
    collectionId,
    nftAddress: collection.nftAddress,
    marketplaceAddress: collection.marketplaceAddress,
    tokenId,
    artwork: token.artwork,
  });
}

export async function getTokenMarket(
  collectionId: CollectionId,
  tokenId: number,
) {
  if (collectionId === "random-walk") {
    return fetchRandomWalkTokenDetail(tokenId);
  }

  const collection = requireCollection(collectionId);
  const token = await fetchCosmicSignatureMetadata(tokenId);
  const offers = await fetchContractOffersForTokenId({
    collectionId,
    nftAddress: collection.nftAddress,
    marketplaceAddress: collection.marketplaceAddress,
    tokenId,
    artwork: token.artwork,
  });

  return { token, offers };
}
