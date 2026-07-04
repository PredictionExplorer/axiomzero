import { collections, requireCollection } from "@/config/collections";
import type {
  AnchorStatusFilter,
  CollectionId,
  MarketOffer,
  MarketToken,
  MarketplaceTokenPage,
  MarketplaceView,
  MarketplaceSearchParams,
  MarketplaceStats,
  SortKey,
  TokenMarketSummary,
} from "@/lib/marketplace/types";
import {
  getAnchoredTokenIdSet,
  getAnchorStatusForTokens,
  getTokenAnchorStatus,
} from "@/lib/marketplace/anchoring-live";
import {
  fetchRandomWalkMetadata,
  fetchRandomWalkTokenDetail,
  randomWalkTokenPreview,
} from "@/lib/marketplace/random-walk-live";
import {
  fetchCosmicSignatureMetadata,
  fetchCosmicSignatureTokenDetail,
} from "@/lib/marketplace/cosmic-signature-live";
import {
  fetchCollectionTokenOwner,
  getCollectionTokenIds,
} from "@/lib/marketplace/collection-index-live";
import { isZeroAddress } from "@/lib/marketplace/eth";
import { logMarketplaceDegradation } from "@/lib/marketplace/log";
import {
  fetchCollectionContractOffers,
  fetchContractOffersForTokenId,
} from "@/lib/marketplace/marketplace-contract-live";
import { isDisplayableOffer } from "@/lib/marketplace/offers";

const collectionIds = new Set(collections.map((collection) => collection.id));
const offerKinds = new Set(["buy", "sell", "all"]);
const marketplaceViews = new Set(["discover", "listings", "top-bids"]);
const sortKeys = new Set(["price-asc", "price-desc", "recent"]);
const anchorFilters = new Set(["never", "anchored"]);
const DEFAULT_TOKEN_PAGE = 1;
const DEFAULT_TOKEN_PAGE_SIZE = 12;
const MAX_TOKEN_PAGE_SIZE = 24;

export class TokenNotFoundError extends Error {
  constructor(collectionId: CollectionId, tokenId: number) {
    super(`${collectionId} token ${tokenId} was not found.`);
    this.name = "TokenNotFoundError";
  }
}

export function isTokenNotFoundError(
  error: unknown,
): error is TokenNotFoundError {
  return error instanceof TokenNotFoundError;
}

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

function parseBoolean(value: string | string[] | undefined) {
  const resolved = firstValue(value);
  return resolved === "1" || resolved === "true";
}

export function parseMarketplaceSearchParams(
  params: Record<string, string | string[] | undefined>,
): MarketplaceSearchParams {
  const collection = firstValue(params.collection);
  const kind = firstValue(params.kind);
  const view = firstValue(params.view);
  const sort = firstValue(params.sort);
  const anchor = firstValue(params.anchor);
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
      kind && offerKinds.has(kind)
        ? (kind as MarketplaceSearchParams["kind"])
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
    listedOnly: parseBoolean(params.listedOnly),
    anchor:
      anchor && anchorFilters.has(anchor)
        ? (anchor as AnchorStatusFilter)
        : undefined,
  };
}

/**
 * Anchor filtering degrades gracefully: when a collection's anchor set could
 * not be read, its tokens are kept rather than hiding the whole collection.
 */
function matchesAnchorFilter(
  anchor: AnchorStatusFilter,
  anchoredSet: Set<number> | undefined,
  tokenId: number,
) {
  if (!anchoredSet) {
    return true;
  }

  return anchor === "never"
    ? !anchoredSet.has(tokenId)
    : anchoredSet.has(tokenId);
}

async function anchoredSetsForCollections(requestedIds: CollectionId[]) {
  const entries = await Promise.all(
    requestedIds.map(
      async (collectionId) =>
        [
          collectionId,
          await getAnchoredTokenIdSet(collectionId).catch(() => undefined),
        ] as const,
    ),
  );

  return new Map(entries);
}

export function filterOffers(
  allOffers: MarketOffer[],
  search: MarketplaceSearchParams,
) {
  return allOffers.filter((offer) => {
    if (!isDisplayableOffer(offer)) {
      return false;
    }

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

const OFFER_SCAN_CACHE_TTL_MS = 30_000;
const OFFER_SCAN_TIME_BUDGET_MS = 6_000;
const offerScanCache = new Map<
  CollectionId,
  { offers: Promise<MarketOffer[]>; fetchedAt: number }
>();
const lastGoodOfferScan = new Map<CollectionId, MarketOffer[]>();

function startOfferScan(collectionId: CollectionId) {
  const collection = requireCollection(collectionId);

  return fetchCollectionContractOffers({
    collectionId,
    nftAddress: collection.nftAddress,
    marketplaceAddress: collection.marketplaceAddress,
    loadToken:
      collectionId === "random-walk"
        ? async (tokenId) => randomWalkTokenPreview(tokenId)
        : fetchCosmicSignatureMetadata,
  });
}

/**
 * Collection offer scans are expensive multicalls against a public RPC, so
 * results are shared for a short TTL and stale data is served whenever a
 * refresh fails or exceeds its time budget.
 */
function scanCollectionContractOffers(collectionId: CollectionId) {
  if (process.env.NODE_ENV === "test") {
    return startOfferScan(collectionId);
  }

  const cached = offerScanCache.get(collectionId);
  let scan: Promise<MarketOffer[]>;

  if (cached && Date.now() - cached.fetchedAt < OFFER_SCAN_CACHE_TTL_MS) {
    scan = cached.offers;
  } else {
    scan = startOfferScan(collectionId).then((offers) => {
      lastGoodOfferScan.set(collectionId, offers);
      return offers;
    });
    scan.catch(() => offerScanCache.delete(collectionId));
    offerScanCache.set(collectionId, { offers: scan, fetchedAt: Date.now() });
  }

  const stale = lastGoodOfferScan.get(collectionId);

  if (stale === undefined) {
    return scan;
  }

  return Promise.race([
    scan.catch(() => stale),
    new Promise<MarketOffer[]>((resolve) => {
      const timer = setTimeout(
        () => resolve(stale),
        OFFER_SCAN_TIME_BUDGET_MS,
      );
      timer.unref?.();
    }),
  ]);
}

async function getMarketplaceOffersForCollection(
  collectionId: CollectionId,
  search: MarketplaceSearchParams,
) {
  const requestedKind =
    search.kind && search.kind !== "all" ? search.kind : "sell";
  const offers = await scanCollectionContractOffers(collectionId);

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
  const filtered = sortOffers(filterOffers(offers, search), search.sort);
  const anchor = search.anchor;

  if (!anchor) {
    return filtered;
  }

  const anchoredSets = await anchoredSetsForCollections(requestedCollections);

  return filtered.filter((offer) =>
    matchesAnchorFilter(
      anchor,
      anchoredSets.get(offer.collectionId),
      offer.tokenId,
    ),
  );
}

export function getMarketplaceStats(
  allOffers: MarketOffer[],
): MarketplaceStats {
  const activeOffers = allOffers.filter(isDisplayableOffer);
  const sellOffers = activeOffers.filter((offer) => offer.kind === "sell");
  const buyOffers = activeOffers.filter((offer) => offer.kind === "buy");

  return {
    totalOffers: activeOffers.length,
    floorOffer: sortOffers(sellOffers, "price-asc")[0],
    topBidOffer: sortOffers(buyOffers, "price-desc")[0],
    sellListings: sellOffers.length,
    buyOffers: buyOffers.length,
  };
}

export function summarizeTokenMarket(tokenMarket: {
  token: TokenMarketSummary["token"];
  offers: MarketOffer[];
}): TokenMarketSummary {
  const activeOffers = tokenMarket.offers.filter(isDisplayableOffer);

  return {
    ...tokenMarket,
    offers: activeOffers,
    activeSellOffer: sortOffers(
      activeOffers.filter((offer) => offer.kind === "sell"),
      "price-asc",
    )[0],
    highestBid: sortOffers(
      activeOffers.filter((offer) => offer.kind === "buy"),
      "price-desc",
    )[0],
  };
}

async function mintedTokenIdsForCollection(collectionId: CollectionId) {
  return getCollectionTokenIds(collectionId);
}

async function assertMintedToken(collectionId: CollectionId, tokenId: number) {
  if (!Number.isInteger(tokenId)) {
    throw new TokenNotFoundError(collectionId, tokenId);
  }

  const tokenIds = await mintedTokenIdsForCollection(collectionId);

  if (!tokenIds.includes(tokenId)) {
    throw new TokenNotFoundError(collectionId, tokenId);
  }
}

async function tokenCandidates(search: MarketplaceSearchParams) {
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

  const collectionTokenIds = await Promise.all(
    requestedCollections.map(async (collection) => ({
      collectionId: collection.id,
      tokenIds: await mintedTokenIdsForCollection(collection.id),
    })),
  );
  const candidates = collectionTokenIds.flatMap(
    ({ collectionId, tokenIds }) => {
      if (tokenQuery !== undefined) {
        return tokenIds.includes(tokenQuery)
          ? [{ collectionId, tokenId: tokenQuery }]
          : [];
      }

      return tokenIds.map((tokenId) => ({
        collectionId,
        tokenId,
      }));
    },
  );
  const anchor = search.anchor;

  if (!anchor) {
    return candidates;
  }

  const anchoredSets = await anchoredSetsForCollections(
    requestedCollections.map((collection) => collection.id),
  );

  return candidates.filter(({ collectionId, tokenId }) =>
    matchesAnchorFilter(anchor, anchoredSets.get(collectionId), tokenId),
  );
}

async function loadTokenSummaryPage(
  refs: Array<{ collectionId: CollectionId; tokenId: number }>,
) {
  // One batched anchor read for the page seeds the per-token cache before the
  // per-token stamping inside getTokenMarket runs.
  await getAnchorStatusForTokens(refs).catch(() => undefined);

  return (
    await Promise.all(
      refs.map(async ({ collectionId, tokenId }) => {
        try {
          return summarizeTokenMarket(
            await getTokenMarket(collectionId, tokenId),
          );
        } catch {
          return undefined;
        }
      }),
    )
  ).filter((item): item is TokenMarketSummary => Boolean(item));
}

/**
 * Discover pages with listing-based filters (listed only, price bounds, or a
 * price sort) are built from the cached collection offer scan instead of
 * loading every minted token, so the work stays bounded by page size.
 */
async function listedTokenPage(
  search: MarketplaceSearchParams,
  pageSize: number,
  sort: SortKey,
): Promise<MarketplaceTokenPage> {
  const offers = await getMarketplaceOffers({
    collection: search.collection,
    kind: "sell",
    view: "listings",
    sort,
    query: search.query,
    min: search.min,
    max: search.max,
    anchor: search.anchor,
  });
  const seen = new Set<string>();
  const tokenRefs: Array<{ collectionId: CollectionId; tokenId: number }> = [];

  for (const offer of offers) {
    const key = `${offer.collectionId}:${offer.tokenId}`;

    if (!seen.has(key)) {
      seen.add(key);
      tokenRefs.push({
        collectionId: offer.collectionId,
        tokenId: offer.tokenId,
      });
    }
  }

  const totalPages = Math.max(1, Math.ceil(tokenRefs.length / pageSize));
  const page = Math.min(search.page ?? DEFAULT_TOKEN_PAGE, totalPages);
  const offset = (page - 1) * pageSize;
  const items = await loadTokenSummaryPage(
    tokenRefs.slice(offset, offset + pageSize),
  );

  return {
    items,
    page,
    pageSize,
    totalItems: tokenRefs.length,
    totalPages,
  };
}

export async function getMarketplaceTokenPage(
  search: MarketplaceSearchParams,
): Promise<MarketplaceTokenPage> {
  const pageSize = search.pageSize ?? DEFAULT_TOKEN_PAGE_SIZE;
  const sort = search.sort ?? "price-asc";
  const usesListingFilters =
    Boolean(search.listedOnly) ||
    search.min !== undefined ||
    search.max !== undefined ||
    sort === "price-desc";

  if (usesListingFilters) {
    return listedTokenPage(search, pageSize, sort);
  }

  const candidates = await tokenCandidates(search);
  const ordered = sort === "recent" ? [...candidates].reverse() : candidates;
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const page = Math.min(search.page ?? DEFAULT_TOKEN_PAGE, totalPages);
  const offset = (page - 1) * pageSize;
  const items = await loadTokenSummaryPage(
    ordered.slice(offset, offset + pageSize),
  );

  return {
    items,
    page,
    pageSize,
    totalItems: ordered.length,
    totalPages,
  };
}

/**
 * Fallback tokens built from static metadata carry no ownership data, so the
 * owner is read from the NFT contract instead of rendering the zero address.
 */
async function withOnChainOwner(
  collectionId: CollectionId,
  tokenId: number,
  token: MarketToken,
): Promise<MarketToken> {
  if (!isZeroAddress(token.owner)) {
    return token;
  }

  try {
    const owner = await fetchCollectionTokenOwner({ collectionId, tokenId });

    return owner ? { ...token, owner } : token;
  } catch (error) {
    logMarketplaceDegradation(
      `${collectionId} token ${tokenId} on-chain owner unavailable`,
      error,
    );
    return token;
  }
}

async function loadCollectionToken(
  collectionId: CollectionId,
  tokenId: number,
): Promise<MarketToken> {
  if (collectionId === "random-walk") {
    try {
      return await fetchRandomWalkTokenDetail(tokenId);
    } catch (error) {
      logMarketplaceDegradation(
        `random-walk token ${tokenId} API detail unavailable, using metadata`,
        error,
      );
      return withOnChainOwner(
        collectionId,
        tokenId,
        await fetchRandomWalkMetadata(tokenId),
      );
    }
  }

  return withOnChainOwner(
    collectionId,
    tokenId,
    await fetchCosmicSignatureTokenDetail(tokenId),
  );
}

export async function getToken(collectionId: CollectionId, tokenId: number) {
  return loadCollectionToken(collectionId, tokenId);
}

const TOKEN_OFFERS_CACHE_TTL_MS = 30_000;
const tokenOffersCache = new Map<
  string,
  { offers: Promise<MarketOffer[]>; fetchedAt: number }
>();

function fetchContractOffersForCollectionToken(
  collectionId: CollectionId,
  tokenId: number,
  token: Pick<MarketToken, "artwork">,
) {
  const collection = requireCollection(collectionId);
  const useTtlCache = process.env.NODE_ENV !== "test";
  const cacheKey = `${collectionId}:${tokenId}`;
  const cached = tokenOffersCache.get(cacheKey);

  if (
    useTtlCache &&
    cached &&
    Date.now() - cached.fetchedAt < TOKEN_OFFERS_CACHE_TTL_MS
  ) {
    return cached.offers;
  }

  const offers = fetchContractOffersForTokenId({
    collectionId,
    nftAddress: collection.nftAddress,
    marketplaceAddress: collection.marketplaceAddress,
    tokenId,
    artwork: token.artwork,
  });

  if (useTtlCache) {
    tokenOffersCache.set(cacheKey, { offers, fetchedAt: Date.now() });
    offers.catch(() => tokenOffersCache.delete(cacheKey));
  }

  return offers;
}

export async function getOffersForToken(
  collectionId: CollectionId,
  tokenId: number,
) {
  await assertMintedToken(collectionId, tokenId);

  const token =
    collectionId === "random-walk"
      ? randomWalkTokenPreview(tokenId)
      : await fetchCosmicSignatureMetadata(tokenId);

  return fetchContractOffersForCollectionToken(collectionId, tokenId, token);
}

export async function getTokenMarket(
  collectionId: CollectionId,
  tokenId: number,
) {
  const [market, anchored] = await Promise.all([
    loadTokenMarket(collectionId, tokenId),
    getTokenAnchorStatus(collectionId, tokenId).catch(() => undefined),
  ]);

  if (anchored !== undefined) {
    market.token = { ...market.token, anchored };
  }

  return market;
}

async function loadTokenMarket(
  collectionId: CollectionId,
  tokenId: number,
): Promise<{ token: MarketToken; offers: MarketOffer[] }> {
  await assertMintedToken(collectionId, tokenId);

  const token = await loadCollectionToken(collectionId, tokenId);
  const offers = await fetchContractOffersForCollectionToken(
    collectionId,
    tokenId,
    token,
  ).catch((error) => {
    logMarketplaceDegradation(
      `${collectionId} token ${tokenId} contract offers unavailable`,
      error,
    );
    return [];
  });

  return { token, offers };
}
