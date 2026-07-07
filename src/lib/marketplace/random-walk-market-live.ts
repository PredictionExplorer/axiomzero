import { z } from "zod";

import type {
  MarketOffer,
  MarketSale,
  OfferKind,
} from "@/lib/marketplace/types";
import { participantAddress, ZERO_ADDRESS } from "@/lib/marketplace/eth";
import { fetchGoApiJson } from "@/lib/marketplace/go-api";
import {
  randomWalkApiPath,
  randomWalkArtwork,
} from "@/lib/marketplace/random-walk-live";

/**
 * Market-state adapter for the Random Walk Go "webserv" backend. That backend
 * indexes the exact same Arbitrum marketplace contract AxiomZero trades on
 * (0x47eF85…), so its offer/sale/token endpoints replace the expensive
 * multicall RPC scans for the Random Walk collection. Every function here
 * degrades to `undefined`/throws so callers can fall back to the on-chain path.
 */

const RANDOM_WALK_REFRESH_SECONDS = 60;
const RANDOM_WALK_SALES_PAGE_SIZE = 100_000;
/**
 * order_by for current_offers: 0 = by offer id, 1 = price desc, 2 = price asc.
 * AxiomZero re-sorts offers itself, so the cheapest DB ordering (by id) is
 * requested.
 */
const RANDOM_WALK_OFFERS_ORDER_BY = 0;

/** API_Offer as serialized by the Go backend (prices already in ETH). */
const randomWalkOfferSchema = z
  .object({
    OfferId: z.number(),
    OfferType: z.number(),
    SellerAddr: z.string().optional(),
    BuyerAddr: z.string().optional(),
    TokenId: z.number(),
    Active: z.boolean().optional(),
    Price: z.number(),
    TimeStamp: z.number().optional(),
    BlockNum: z.number().optional(),
    WasCanceled: z.boolean().optional(),
  })
  .passthrough();

const randomWalkOffersResponseSchema = z.object({
  // The Go backend encodes a nil slice as JSON null.
  Offers: z.array(randomWalkOfferSchema).nullish(),
});

const randomWalkSalesResponseSchema = z.object({
  Trading: z.array(randomWalkOfferSchema).nullish(),
});

// No `.passthrough()`: the minted-token response is ~2.8MB of mint records but
// only TokenId is needed, so unknown fields are stripped during parsing to keep
// the retained array small.
const randomWalkMintedTokensResponseSchema = z.object({
  MintedTokens: z.array(z.object({ TokenId: z.number() })).nullish(),
});

const randomWalkUserTokensResponseSchema = z.object({
  UserTokens: z.array(z.object({ TokenId: z.number() }).passthrough()).nullish(),
});

type RandomWalkOffer = z.infer<typeof randomWalkOfferSchema>;

/** OfferType 1 is a sell listing; 0 (and anything else) is a buy bid. */
function offerKind(offerType: number): OfferKind {
  return offerType === 1 ? "sell" : "buy";
}

function isoFromUnix(timestamp: number | undefined) {
  return typeof timestamp === "number" && timestamp > 0
    ? new Date(timestamp * 1000).toISOString()
    : new Date(0).toISOString();
}

function toMarketOffer(offer: RandomWalkOffer): MarketOffer | undefined {
  const kind = offerKind(offer.OfferType);
  const seller = participantAddress(offer.SellerAddr);
  const buyer = participantAddress(offer.BuyerAddr);
  const maker = kind === "sell" ? seller : buyer;
  const taker = kind === "sell" ? buyer : seller;

  // Active offers only, and the maker (seller for listings, bidder for bids)
  // must resolve to a real address for the trade to settle on-chain.
  if (offer.Active === false || offer.WasCanceled || !maker) {
    return undefined;
  }

  if (!Number.isFinite(offer.Price) || offer.Price <= 0) {
    return undefined;
  }

  return {
    id: `random-walk-${kind}-${offer.OfferId}`,
    offerId: offer.OfferId,
    collectionId: "random-walk",
    tokenId: offer.TokenId,
    kind,
    priceEth: offer.Price,
    maker,
    taker,
    createdAt: isoFromUnix(offer.TimeStamp),
    active: true,
    artwork: randomWalkArtwork(offer.TokenId),
  };
}

/** All active Random Walk marketplace offers (sell listings + buy bids). */
export async function fetchRandomWalkOffers(): Promise<MarketOffer[]> {
  const response = await fetchGoApiJson(
    randomWalkApiPath(`current_offers/${RANDOM_WALK_OFFERS_ORDER_BY}`),
    randomWalkOffersResponseSchema,
    { revalidate: RANDOM_WALK_REFRESH_SECONDS },
  );

  return (response.Offers ?? []).flatMap((offer) => {
    const normalized = toMarketOffer(offer);

    return normalized ? [normalized] : [];
  });
}

/** Completed Random Walk sales, newest first. */
export async function fetchRandomWalkSales(): Promise<MarketSale[]> {
  const response = await fetchGoApiJson(
    randomWalkApiPath(`trading/sales/0/${RANDOM_WALK_SALES_PAGE_SIZE}`),
    randomWalkSalesResponseSchema,
    { revalidate: RANDOM_WALK_REFRESH_SECONDS },
  );
  const sales = (response.Trading ?? []).map((sale): MarketSale => ({
    collectionId: "random-walk",
    tokenId: sale.TokenId,
    offerId: sale.OfferId,
    priceEth: sale.Price,
    seller: participantAddress(sale.SellerAddr) ?? ZERO_ADDRESS,
    buyer: participantAddress(sale.BuyerAddr) ?? ZERO_ADDRESS,
    blockNumber: sale.BlockNum ?? 0,
    soldAt:
      typeof sale.TimeStamp === "number" && sale.TimeStamp > 0
        ? isoFromUnix(sale.TimeStamp)
        : undefined,
  }));

  // The backend returns sales oldest-first; AxiomZero expects newest-first.
  return sales.sort((left, right) => right.blockNumber - left.blockNumber);
}

/**
 * The minted-token list is ~2.8MB, which exceeds Next's 2MB data-cache limit,
 * so it is fetched with `no-store` and cached in-process here. The minted set
 * changes rarely (only on new mints), so a several-minute TTL is ample.
 */
const TOKEN_IDS_CACHE_TTL_MS = 5 * 60 * 1000;
let tokenIdsCache: { ids: number[]; fetchedAt: number } | undefined;

export function resetRandomWalkMarketCachesForTests() {
  tokenIdsCache = undefined;
}

/** All minted Random Walk token ids, ascending. */
export async function fetchRandomWalkTokenIds(): Promise<number[]> {
  const useCache = process.env.NODE_ENV !== "test";

  if (
    useCache &&
    tokenIdsCache &&
    Date.now() - tokenIdsCache.fetchedAt < TOKEN_IDS_CACHE_TTL_MS
  ) {
    return tokenIdsCache.ids;
  }

  const response = await fetchGoApiJson(
    randomWalkApiPath("tokens/list/sequential"),
    randomWalkMintedTokensResponseSchema,
    { noStore: true },
  );
  const tokenIds = (response.MintedTokens ?? []).map((token) => token.TokenId);
  const ids = [...new Set(tokenIds)].sort((left, right) => left - right);

  if (useCache) {
    tokenIdsCache = { ids, fetchedAt: Date.now() };
  }

  return ids;
}

/**
 * Random Walk token ids owned by an address. The Go `tokens/by_user` JSON
 * handler accepts a raw 0x address in the `:user_aid` slot and resolves it to
 * the internal address id.
 */
export async function fetchRandomWalkTokensByUser(
  owner: `0x${string}`,
): Promise<number[]> {
  const response = await fetchGoApiJson(
    randomWalkApiPath(`tokens/by_user/${owner}`),
    randomWalkUserTokensResponseSchema,
    { revalidate: RANDOM_WALK_REFRESH_SECONDS },
  );
  const tokenIds = (response.UserTokens ?? []).map((token) => token.TokenId);

  return [...new Set(tokenIds)].sort((left, right) => left - right);
}
