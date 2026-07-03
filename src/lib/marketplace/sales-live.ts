import { createPublicClient, formatEther, http } from "viem";
import { arbitrum } from "viem/chains";

import { collections, requireCollection } from "@/config/collections";
import type {
  CollectionId,
  MarketSale,
  SalesSummary,
} from "@/lib/marketplace/types";
import { itemBoughtEvent, marketplaceAbi } from "@/lib/web3/abis";

/**
 * Completed sales are reconstructed from the marketplace contract's
 * ItemBought events: the event carries offerId/seller/buyer, and the offers
 * mapping still holds the sold token, collection address, and price. Block
 * timestamps are only fetched for the newest sales so activity feeds can show
 * relative times without hammering the RPC.
 */

const RECENT_TIMESTAMP_LIMIT = 16;

type SalesReadCall = {
  address: `0x${string}`;
  abi: typeof marketplaceAbi;
  functionName: string;
  args?: readonly unknown[];
};

export type SalesClient = {
  getLogs: (args: {
    address: `0x${string}`;
    event: typeof itemBoughtEvent;
    fromBlock: bigint;
    toBlock: "latest";
  }) => Promise<
    Array<{
      args: {
        offerId?: bigint;
        seller?: `0x${string}`;
        buyer?: `0x${string}`;
      };
      blockNumber: bigint | null;
    }>
  >;
  multicall: (call: {
    allowFailure: true;
    contracts: readonly SalesReadCall[];
  }) => Promise<
    Array<
      | { status: "success"; result: unknown }
      | { status: "failure"; error: unknown }
    >
  >;
  getBlock: (args: {
    blockNumber: bigint;
  }) => Promise<{ timestamp: bigint }>;
};

type OfferTuple = readonly [
  nftAddress: `0x${string}`,
  tokenId: bigint,
  price: bigint,
  seller: `0x${string}`,
  buyer: `0x${string}`,
  active: boolean,
];

function createSalesPublicClient(): SalesClient {
  return createPublicClient({
    chain: arbitrum,
    transport: http(
      process.env.ARBITRUM_RPC_URL ??
        process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ??
        "https://arb1.arbitrum.io/rpc",
      // Timestamp lookups batch into few HTTP round trips; sales data
      // degrades to "unavailable" when the public RPC is slow.
      { batch: true, timeout: 5_000, retryCount: 1 },
    ),
  }) as unknown as SalesClient;
}

function collectionIdForNftAddress(nftAddress: `0x${string}`) {
  return collections.find(
    (collection) =>
      collection.nftAddress.toLowerCase() === nftAddress.toLowerCase(),
  )?.id;
}

/**
 * Scans every completed sale on a marketplace contract, newest first. Sales
 * of NFT contracts outside the configured collections are dropped.
 */
export async function fetchMarketplaceSales({
  marketplaceAddress,
  client = createSalesPublicClient(),
  timestampLimit = RECENT_TIMESTAMP_LIMIT,
}: {
  marketplaceAddress: `0x${string}`;
  client?: SalesClient;
  timestampLimit?: number;
}): Promise<MarketSale[]> {
  const logs = await client.getLogs({
    address: marketplaceAddress,
    event: itemBoughtEvent,
    fromBlock: 0n,
    toBlock: "latest",
  });
  const boughtOffers = logs.flatMap((log) =>
    log.args.offerId !== undefined &&
    log.args.seller &&
    log.args.buyer &&
    log.blockNumber !== null
      ? [
          {
            offerId: log.args.offerId,
            seller: log.args.seller,
            buyer: log.args.buyer,
            blockNumber: log.blockNumber,
          },
        ]
      : [],
  );

  if (!boughtOffers.length) {
    return [];
  }

  const offerResults = await client.multicall({
    allowFailure: true,
    contracts: boughtOffers.map(({ offerId }) => ({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "offers",
      args: [offerId],
    })),
  });
  const sales: MarketSale[] = [];

  boughtOffers.forEach((bought, index) => {
    const result = offerResults[index];

    if (result.status !== "success") {
      return;
    }

    const [nftAddress, tokenId, price] = result.result as OfferTuple;
    const collectionId = collectionIdForNftAddress(nftAddress);

    if (!collectionId) {
      return;
    }

    sales.push({
      collectionId,
      tokenId: Number(tokenId),
      offerId: Number(bought.offerId),
      priceEth: Number(formatEther(price)),
      seller: bought.seller,
      buyer: bought.buyer,
      blockNumber: Number(bought.blockNumber),
    });
  });

  sales.sort((left, right) => right.blockNumber - left.blockNumber);

  const recentBlocks = [
    ...new Set(
      sales.slice(0, timestampLimit).map((sale) => sale.blockNumber),
    ),
  ];
  const timestamps = new Map<number, string>();

  await Promise.all(
    recentBlocks.map(async (blockNumber) => {
      try {
        const block = await client.getBlock({
          blockNumber: BigInt(blockNumber),
        });
        timestamps.set(
          blockNumber,
          new Date(Number(block.timestamp) * 1000).toISOString(),
        );
      } catch {
        // Missing timestamps only hide relative times in the UI.
      }
    }),
  );

  return sales.map((sale) => ({
    ...sale,
    soldAt: timestamps.get(sale.blockNumber),
  }));
}

const SALES_SCAN_CACHE_TTL_MS = 60_000;
const SALES_SCAN_TIME_BUDGET_MS = 6_000;

const salesScanCache = new Map<
  string,
  { scan: Promise<MarketSale[]>; fetchedAt: number }
>();
const lastGoodSalesScan = new Map<string, MarketSale[]>();

export function resetSalesCachesForTests() {
  salesScanCache.clear();
  lastGoodSalesScan.clear();
}

/**
 * Cached sales snapshot per marketplace contract (both collections share one
 * contract, so one scan serves both). Serves stale data when a refresh fails
 * or exceeds its time budget, and undefined when nothing is available yet.
 */
function getMarketplaceSalesSnapshot(
  marketplaceAddress: `0x${string}`,
  client?: SalesClient,
): Promise<MarketSale[] | undefined> {
  if (process.env.NODE_ENV === "test") {
    return fetchMarketplaceSales({ marketplaceAddress, client }).catch(
      () => undefined,
    );
  }

  const cacheKey = marketplaceAddress.toLowerCase();
  const cached = salesScanCache.get(cacheKey);
  let scan: Promise<MarketSale[]>;

  if (cached && Date.now() - cached.fetchedAt < SALES_SCAN_CACHE_TTL_MS) {
    scan = cached.scan;
  } else {
    scan = fetchMarketplaceSales({ marketplaceAddress, client }).then(
      (sales) => {
        lastGoodSalesScan.set(cacheKey, sales);
        return sales;
      },
    );
    scan.catch(() => salesScanCache.delete(cacheKey));
    salesScanCache.set(cacheKey, { scan, fetchedAt: Date.now() });
  }

  const stale = lastGoodSalesScan.get(cacheKey);

  return Promise.race([
    scan.catch(() => stale),
    new Promise<MarketSale[] | undefined>((resolve) => {
      const timer = setTimeout(() => resolve(stale), SALES_SCAN_TIME_BUDGET_MS);
      timer.unref?.();
    }),
  ]);
}

/**
 * Completed sales for one collection, newest first. Undefined when the sales
 * scan is unavailable so callers can degrade gracefully.
 */
export async function getCollectionSales(
  collectionId: CollectionId,
  client?: SalesClient,
): Promise<MarketSale[] | undefined> {
  const collection = requireCollection(collectionId);
  const sales = await getMarketplaceSalesSnapshot(
    collection.marketplaceAddress,
    client,
  );

  return sales?.filter((sale) => sale.collectionId === collectionId);
}

/** Aggregates a newest-first sales list into headline numbers. */
export function summarizeSales(sales: readonly MarketSale[]): SalesSummary {
  let volumeEth = 0;
  let topSale: MarketSale | undefined;

  for (const sale of sales) {
    volumeEth += sale.priceEth;

    if (!topSale || sale.priceEth > topSale.priceEth) {
      topSale = sale;
    }
  }

  return {
    count: sales.length,
    volumeEth,
    lastSale: sales[0],
    topSale,
  };
}
