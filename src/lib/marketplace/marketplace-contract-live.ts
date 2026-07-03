import {
  createPublicClient,
  formatEther,
  http,
} from "viem";
import { arbitrum } from "viem/chains";

import { marketplaceAbi } from "@/lib/web3/abis";
import type {
  CollectionId,
  MarketOffer,
  MarketToken,
  OfferKind,
  TokenArtwork,
} from "@/lib/marketplace/types";

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;
const DEFAULT_MARKETPLACE_SCAN_LIMIT = 5_000;

type MarketplaceContractCall = {
  address: `0x${string}`;
  abi: typeof marketplaceAbi;
  functionName: string;
  args?: readonly unknown[];
};

export type MarketplaceClient = {
  readContract: (call: MarketplaceContractCall) => Promise<unknown>;
  multicall: (call: {
    allowFailure: true;
    contracts: readonly MarketplaceContractCall[];
  }) => Promise<
    Array<
      | { status: "success"; result: unknown }
      | { status: "failure"; error: unknown }
    >
  >;
};

export type MarketplaceOfferTuple = readonly [
  nftAddress: `0x${string}`,
  tokenId: bigint,
  price: bigint,
  seller: `0x${string}`,
  buyer: `0x${string}`,
  active: boolean,
];

type FetchOffersOptions = {
  collectionId: CollectionId;
  nftAddress: `0x${string}`;
  marketplaceAddress: `0x${string}`;
  artwork?: TokenArtwork;
  client?: MarketplaceClient;
};

type FetchCollectionOffersOptions = FetchOffersOptions & {
  loadToken?: (tokenId: number) => Promise<MarketToken | undefined>;
  maxOffers?: number;
};

function createMarketplacePublicClient(): MarketplaceClient {
  return createPublicClient({
    chain: arbitrum,
    transport: http(
      process.env.ARBITRUM_RPC_URL ??
        process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ??
        "https://arb1.arbitrum.io/rpc",
      // Batching coalesces the multicall chunks of a full offer scan into a
      // few HTTP requests, which keeps rate-limited public RPCs from dropping
      // parts of the scan. Timeouts keep server renders bounded; callers fall
      // back to cached or empty market data.
      { batch: true, timeout: 5_000, retryCount: 1 },
    ),
  }) as unknown as MarketplaceClient;
}

function sameAddress(left: `0x${string}`, right: `0x${string}`) {
  return left.toLowerCase() === right.toLowerCase();
}

function offerKind(offer: MarketplaceOfferTuple): OfferKind | undefined {
  const [, , , seller, buyer] = offer;

  if (seller === ZERO_ADDRESS && buyer !== ZERO_ADDRESS) {
    return "buy";
  }

  if (seller !== ZERO_ADDRESS && buyer === ZERO_ADDRESS) {
    return "sell";
  }

  return undefined;
}

export function normalizeContractOffer(
  offerId: number,
  offer: MarketplaceOfferTuple,
  collectionId: CollectionId,
  artwork?: TokenArtwork,
): MarketOffer | undefined {
  const [, tokenId, price, seller, buyer, active] = offer;
  const kind = offerKind(offer);

  if (!active || !kind || price <= 0n) {
    return undefined;
  }

  return {
    id: `${collectionId}-${kind}-${offerId}`,
    offerId,
    collectionId,
    tokenId: Number(tokenId),
    kind,
    priceEth: Number(formatEther(price)),
    maker: kind === "sell" ? seller : buyer,
    taker: kind === "sell" ? buyer : seller,
    createdAt: "1970-01-01T00:00:00.000Z",
    active,
    artwork,
  };
}

async function readOffer(
  client: MarketplaceClient,
  marketplaceAddress: `0x${string}`,
  offerId: bigint,
) {
  return client.readContract({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    functionName: "offers",
    args: [offerId],
  }) as Promise<MarketplaceOfferTuple>;
}

async function readOffersByIds(
  client: MarketplaceClient,
  marketplaceAddress: `0x${string}`,
  offerIds: readonly bigint[],
) {
  if (!offerIds.length) {
    return [];
  }

  const results = await client.multicall({
    allowFailure: true,
    contracts: offerIds.map((offerId) => ({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "offers",
      args: [offerId],
    })),
  });

  return results.flatMap((result, index) => {
    if (result.status !== "success") {
      return [];
    }

    return [
      {
        offerId: Number(offerIds[index]),
        offer: result.result as unknown as MarketplaceOfferTuple,
      },
    ];
  });
}

export async function fetchContractOffersForTokenId({
  collectionId,
  nftAddress,
  marketplaceAddress,
  tokenId,
  artwork,
  client = createMarketplacePublicClient(),
}: FetchOffersOptions & { tokenId: number }) {
  const [sellOfferIds, buyOfferIds] = (await Promise.all([
    client.readContract({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "getSellOffers",
      args: [nftAddress, BigInt(tokenId)],
    }),
    client.readContract({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "getBuyOffers",
      args: [nftAddress, BigInt(tokenId)],
    }),
  ])) as [bigint[], bigint[]];

  const offers = await readOffersByIds(client, marketplaceAddress, [
    ...sellOfferIds,
    ...buyOfferIds,
  ]);

  return offers.flatMap(({ offerId, offer }) => {
    const normalized = normalizeContractOffer(
      offerId,
      offer,
      collectionId,
      artwork,
    );

    return normalized ? [normalized] : [];
  });
}

async function artworkByTokenId(
  tokenIds: number[],
  loadToken?: (tokenId: number) => Promise<MarketToken | undefined>,
) {
  const entries = await Promise.all(
    tokenIds.map(async (tokenId) => {
      try {
        return [tokenId, (await loadToken?.(tokenId))?.artwork] as const;
      } catch {
        return [tokenId, undefined] as const;
      }
    }),
  );

  return new Map(entries);
}

type RawMarketplaceOffer = {
  offerId: number;
  offer: MarketplaceOfferTuple;
};

const RAW_OFFER_SCAN_CACHE_TTL_MS = 30_000;
const rawOfferScanCache = new Map<
  string,
  { scan: Promise<RawMarketplaceOffer[]>; fetchedAt: number }
>();

export function resetMarketplaceOfferScanCacheForTests() {
  rawOfferScanCache.clear();
}

async function scanMarketplaceOffers({
  marketplaceAddress,
  maxOffers,
  client,
}: {
  marketplaceAddress: `0x${string}`;
  maxOffers: number;
  client: MarketplaceClient;
}): Promise<RawMarketplaceOffer[]> {
  const offerCount = (await client.readContract({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    functionName: "numOffers",
  })) as bigint;
  const boundedOfferCount =
    offerCount > BigInt(maxOffers) ? maxOffers : Number(offerCount);
  const startOfferId =
    offerCount > BigInt(maxOffers) ? offerCount - BigInt(maxOffers) : 0n;
  const offerIds = Array.from({ length: boundedOfferCount }, (_, index) =>
    startOfferId + BigInt(index),
  );
  const offers = await readOffersByIds(client, marketplaceAddress, offerIds);

  // Offer reads only fail wholesale when the RPC drops the scan (e.g. rate
  // limiting). Resolving to [] here would render an empty market and poison
  // last-good fallbacks, so surface the failure to callers instead.
  if (offerIds.length > 0 && offers.length === 0) {
    throw new Error(
      "Marketplace offer scan failed: no offers could be read from the RPC.",
    );
  }

  return offers;
}

/**
 * Both collections trade on one marketplace contract, so the raw offer scan
 * is cached briefly per contract address and shared by concurrent
 * per-collection callers instead of re-reading every offer for each
 * collection.
 */
function getMarketplaceOfferTuples(options: {
  marketplaceAddress: `0x${string}`;
  maxOffers: number;
  client: MarketplaceClient;
}): Promise<RawMarketplaceOffer[]> {
  const cacheKey = options.marketplaceAddress.toLowerCase();
  const cached = rawOfferScanCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < RAW_OFFER_SCAN_CACHE_TTL_MS) {
    return cached.scan;
  }

  const scan = scanMarketplaceOffers(options);
  scan.catch(() => rawOfferScanCache.delete(cacheKey));
  rawOfferScanCache.set(cacheKey, { scan, fetchedAt: Date.now() });

  return scan;
}

export async function fetchCollectionContractOffers({
  collectionId,
  nftAddress,
  marketplaceAddress,
  loadToken,
  maxOffers = Number(process.env.MARKETPLACE_SCAN_LIMIT) ||
    DEFAULT_MARKETPLACE_SCAN_LIMIT,
  client = createMarketplacePublicClient(),
}: FetchCollectionOffersOptions) {
  const offers = await getMarketplaceOfferTuples({
    marketplaceAddress,
    maxOffers,
    client,
  });
  const matchingOffers = offers.filter(({ offer }) => {
    const [offerNftAddress, , , , , active] = offer;
    return active && sameAddress(offerNftAddress, nftAddress);
  });
  const tokenIds = [
    ...new Set(matchingOffers.map(({ offer }) => Number(offer[1]))),
  ];
  const artwork = await artworkByTokenId(tokenIds, loadToken);

  return matchingOffers.flatMap(({ offerId, offer }) => {
    const normalized = normalizeContractOffer(
      offerId,
      offer,
      collectionId,
      artwork.get(Number(offer[1])),
    );

    return normalized ? [normalized] : [];
  });
}

export async function fetchContractOfferById({
  collectionId,
  marketplaceAddress,
  offerId,
  artwork,
  client = createMarketplacePublicClient(),
}: Omit<FetchOffersOptions, "nftAddress"> & { offerId: number }) {
  const offer = await readOffer(client, marketplaceAddress, BigInt(offerId));
  return normalizeContractOffer(offerId, offer, collectionId, artwork);
}
