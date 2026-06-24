import { collections } from "@/config/collections";
import type {
  CollectionId,
  MarketOffer,
  MarketplaceSearchParams,
  MarketplaceStats,
  OfferKind,
  SortKey,
} from "@/lib/marketplace/types";
import {
  fetchRandomWalkMarketplaceOffers,
  fetchRandomWalkMetadata,
  fetchRandomWalkTokenDetail,
} from "@/lib/marketplace/random-walk-live";

const collectionIds = new Set(collections.map((collection) => collection.id));
const offerKinds = new Set(["buy", "sell"]);
const sortKeys = new Set(["price-asc", "price-desc", "recent"]);

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

export function parseMarketplaceSearchParams(
  params: Record<string, string | string[] | undefined>,
): MarketplaceSearchParams {
  const collection = firstValue(params.collection);
  const kind = firstValue(params.kind);
  const sort = firstValue(params.sort);

  return {
    collection:
      collection && collectionIds.has(collection as CollectionId)
        ? (collection as CollectionId)
        : "all",
    kind:
      kind && offerKinds.has(kind as OfferKind)
        ? (kind as OfferKind)
        : firstValue(params.filter) === "buy"
          ? "buy"
          : firstValue(params.filter) === "sell"
            ? "sell"
            : "sell",
    query: firstValue(params.query)?.trim() || undefined,
    min: parseNumber(params.min),
    max: parseNumber(params.max),
    sort:
      sort && sortKeys.has(sort as SortKey) ? (sort as SortKey) : "price-asc",
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

export async function getMarketplaceOffers(search: MarketplaceSearchParams) {
  const requestedKind =
    search.kind && search.kind !== "all" ? search.kind : "sell";
  const offers =
    search.kind === "all"
      ? [
          ...(await fetchRandomWalkMarketplaceOffers("sell", search.sort)),
          ...(await fetchRandomWalkMarketplaceOffers("buy", search.sort)),
        ]
      : await fetchRandomWalkMarketplaceOffers(requestedKind, search.sort);

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

export async function getToken(collectionId: CollectionId, tokenId: number) {
  if (collectionId !== "random-walk") {
    return undefined;
  }

  try {
    return (await fetchRandomWalkTokenDetail(tokenId)).token;
  } catch {
    return fetchRandomWalkMetadata(tokenId);
  }
}

export async function getOffersForToken(
  collectionId: CollectionId,
  tokenId: number,
) {
  if (collectionId !== "random-walk") {
    return [];
  }

  return (await fetchRandomWalkTokenDetail(tokenId)).offers;
}

export async function getTokenMarket(
  collectionId: CollectionId,
  tokenId: number,
) {
  if (collectionId !== "random-walk") {
    return undefined;
  }

  return fetchRandomWalkTokenDetail(tokenId);
}
