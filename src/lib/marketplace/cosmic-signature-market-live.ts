import { z } from "zod";

import type {
  MarketOffer,
  MarketSale,
  OfferKind,
} from "@/lib/marketplace/types";
import { participantAddress, ZERO_ADDRESS } from "@/lib/marketplace/eth";
import { fetchGoApiJson } from "@/lib/marketplace/go-api";
import { cosmicSignatureApiPath } from "@/lib/marketplace/cosmic-signature-live";

/**
 * Market-state adapter for Cosmic Signature NFTs on the shared Arbitrum
 * marketplace contract. The CosmicGame backend indexes the same marketplace
 * (via the RandomWalk ETL that feeds its database) and exposes the Cosmic
 * Signature slice under /api/cosmicgame/marketplace/*, replacing the multicall
 * RPC scans. Offer rows carry only a token id (no seed), so artwork is attached
 * by the caller; the adapter returns offers without artwork. Every function
 * throws on failure so callers can fall back to the on-chain path.
 */

const COSMIC_SIGNATURE_REFRESH_SECONDS = 60;
const COSMIC_SIGNATURE_SALES_PAGE_SIZE = 100_000;
/** order_by: 0 = by offer id, 1 = price desc, 2 = price asc. Re-sorted client-side. */
const COSMIC_SIGNATURE_OFFERS_ORDER_BY = 0;

const cosmicSignatureOfferSchema = z
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
  })
  .passthrough();

const cosmicSignatureOffersResponseSchema = z.object({
  Offers: z.array(cosmicSignatureOfferSchema).nullish(),
});

const cosmicSignatureSalesResponseSchema = z.object({
  Trading: z.array(cosmicSignatureOfferSchema).nullish(),
});

type CosmicSignatureOffer = z.infer<typeof cosmicSignatureOfferSchema>;

/** OfferType 1 is a sell listing; 0 (and anything else) is a buy bid. */
function offerKind(offerType: number): OfferKind {
  return offerType === 1 ? "sell" : "buy";
}

function isoFromUnix(timestamp: number | undefined) {
  return typeof timestamp === "number" && timestamp > 0
    ? new Date(timestamp * 1000).toISOString()
    : new Date(0).toISOString();
}

function toMarketOffer(offer: CosmicSignatureOffer): MarketOffer | undefined {
  const kind = offerKind(offer.OfferType);
  const seller = participantAddress(offer.SellerAddr);
  const buyer = participantAddress(offer.BuyerAddr);
  const maker = kind === "sell" ? seller : buyer;
  const taker = kind === "sell" ? buyer : seller;

  if (offer.Active === false || !maker) {
    return undefined;
  }

  if (!Number.isFinite(offer.Price) || offer.Price <= 0) {
    return undefined;
  }

  return {
    id: `cosmic-signature-${kind}-${offer.OfferId}`,
    offerId: offer.OfferId,
    collectionId: "cosmic-signature",
    tokenId: offer.TokenId,
    kind,
    priceEth: offer.Price,
    maker,
    taker,
    createdAt: isoFromUnix(offer.TimeStamp),
    active: true,
    // artwork is seed-derived and attached by the caller (offers carry only a token id).
  };
}

/** All active Cosmic Signature marketplace offers (sell listings + buy bids). */
export async function fetchCosmicSignatureOffers(): Promise<MarketOffer[]> {
  const response = await fetchGoApiJson(
    cosmicSignatureApiPath(
      `marketplace/current_offers/${COSMIC_SIGNATURE_OFFERS_ORDER_BY}`,
    ),
    cosmicSignatureOffersResponseSchema,
    { revalidate: COSMIC_SIGNATURE_REFRESH_SECONDS },
  );

  return (response.Offers ?? []).flatMap((offer) => {
    const normalized = toMarketOffer(offer);

    return normalized ? [normalized] : [];
  });
}

/** Completed Cosmic Signature sales, newest first. */
export async function fetchCosmicSignatureSales(): Promise<MarketSale[]> {
  const response = await fetchGoApiJson(
    cosmicSignatureApiPath(
      `marketplace/trading/sales/0/${COSMIC_SIGNATURE_SALES_PAGE_SIZE}`,
    ),
    cosmicSignatureSalesResponseSchema,
    { revalidate: COSMIC_SIGNATURE_REFRESH_SECONDS },
  );
  const sales = (response.Trading ?? []).map((sale): MarketSale => ({
    collectionId: "cosmic-signature",
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

  return sales.sort((left, right) => right.blockNumber - left.blockNumber);
}
