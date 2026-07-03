import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchMarketplaceSales,
  getCollectionSales,
  resetSalesCachesForTests,
  summarizeSales,
  type SalesClient,
} from "@/lib/marketplace/sales-live";
import type { MarketSale } from "@/lib/marketplace/types";

const MARKETPLACE = "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08" as const;
const RANDOM_WALK_NFT = "0x895a6F444BE4ba9d124F61DF736605792B35D66b" as const;
const COSMIC_NFT = "0xbb84Be3500A63581d3F2d5AC3bdF8685AAedad25" as const;
const UNKNOWN_NFT = "0x0000000000000000000000000000000000000abc" as const;
const SELLER = "0x0000000000000000000000000000000000000011" as const;
const BUYER = "0x0000000000000000000000000000000000000022" as const;

type OfferTuple = readonly [
  `0x${string}`,
  bigint,
  bigint,
  `0x${string}`,
  `0x${string}`,
  boolean,
];

function saleLog(offerId: number, blockNumber: number) {
  return {
    args: { offerId: BigInt(offerId), seller: SELLER, buyer: BUYER },
    blockNumber: BigInt(blockNumber),
  };
}

function offerTuple(
  nftAddress: `0x${string}`,
  tokenId: number,
  priceEth: number,
): OfferTuple {
  return [
    nftAddress,
    BigInt(tokenId),
    BigInt(Math.round(priceEth * 1e18)),
    SELLER,
    BUYER,
    false,
  ];
}

function fakeClient({
  logs,
  offers,
  blockTimestamps = {},
  failGetLogs = false,
}: {
  logs: ReturnType<typeof saleLog>[];
  offers: Record<number, OfferTuple | Error>;
  blockTimestamps?: Record<number, number>;
  failGetLogs?: boolean;
}) {
  const getLogs = vi.fn(async () => {
    if (failGetLogs) {
      throw new Error("rpc down");
    }
    return logs;
  });
  const multicall = vi.fn(
    async ({
      contracts,
    }: {
      contracts: readonly { args?: readonly unknown[] }[];
    }) =>
      contracts.map((contract) => {
        const offerId = Number(contract.args?.[0]);
        const result = offers[offerId];

        return result instanceof Error || result === undefined
          ? { status: "failure" as const, error: result ?? new Error("missing") }
          : { status: "success" as const, result };
      }),
  );
  const getBlock = vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => {
    const timestamp = blockTimestamps[Number(blockNumber)];

    if (timestamp === undefined) {
      throw new Error(`no timestamp for block ${blockNumber}`);
    }

    return { timestamp: BigInt(timestamp) };
  });

  return {
    client: { getLogs, multicall, getBlock } as unknown as SalesClient,
    getLogs,
    multicall,
    getBlock,
  };
}

describe("fetchMarketplaceSales", () => {
  beforeEach(() => {
    resetSalesCachesForTests();
  });

  it("joins ItemBought events with offer records, newest first", async () => {
    const { client } = fakeClient({
      logs: [saleLog(1, 100), saleLog(2, 300), saleLog(3, 200)],
      offers: {
        1: offerTuple(RANDOM_WALK_NFT, 7, 0.5),
        2: offerTuple(COSMIC_NFT, 3, 1.25),
        3: offerTuple(RANDOM_WALK_NFT, 9, 2),
      },
      blockTimestamps: { 100: 1_700_000_000, 200: 1_700_000_100, 300: 1_700_000_200 },
    });

    const sales = await fetchMarketplaceSales({
      marketplaceAddress: MARKETPLACE,
      client,
    });

    expect(sales.map((sale) => sale.offerId)).toEqual([2, 3, 1]);
    expect(sales[0]).toMatchObject({
      collectionId: "cosmic-signature",
      tokenId: 3,
      priceEth: 1.25,
      seller: SELLER,
      buyer: BUYER,
      blockNumber: 300,
      soldAt: new Date(1_700_000_200 * 1000).toISOString(),
    });
    expect(sales[2]).toMatchObject({
      collectionId: "random-walk",
      tokenId: 7,
      priceEth: 0.5,
    });
  });

  it("drops sales of unknown NFT contracts and failed offer reads", async () => {
    const { client } = fakeClient({
      logs: [saleLog(1, 100), saleLog(2, 200), saleLog(3, 300)],
      offers: {
        1: offerTuple(UNKNOWN_NFT, 1, 1),
        2: new Error("read failed"),
        3: offerTuple(RANDOM_WALK_NFT, 5, 0.75),
      },
    });

    const sales = await fetchMarketplaceSales({
      marketplaceAddress: MARKETPLACE,
      client,
    });

    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({ tokenId: 5, collectionId: "random-walk" });
  });

  it("only fetches timestamps for the newest sales and tolerates failures", async () => {
    const logs = Array.from({ length: 5 }, (_, index) =>
      saleLog(index + 1, (index + 1) * 100),
    );
    const offers = Object.fromEntries(
      logs.map((_, index) => [
        index + 1,
        offerTuple(RANDOM_WALK_NFT, index + 1, 1),
      ]),
    );
    const { client, getBlock } = fakeClient({
      logs,
      offers,
      // Newest blocks are 500 and 400; 400 has no timestamp available.
      blockTimestamps: { 500: 1_700_000_500 },
    });

    const sales = await fetchMarketplaceSales({
      marketplaceAddress: MARKETPLACE,
      client,
      timestampLimit: 2,
    });

    expect(getBlock).toHaveBeenCalledTimes(2);
    expect(sales[0]?.soldAt).toBe(new Date(1_700_000_500 * 1000).toISOString());
    expect(sales[1]?.soldAt).toBeUndefined();
    expect(sales[4]?.soldAt).toBeUndefined();
  });

  it("returns an empty list when no sales have happened", async () => {
    const { client, multicall } = fakeClient({ logs: [], offers: {} });

    await expect(
      fetchMarketplaceSales({ marketplaceAddress: MARKETPLACE, client }),
    ).resolves.toEqual([]);
    expect(multicall).not.toHaveBeenCalled();
  });
});

describe("getCollectionSales", () => {
  beforeEach(() => {
    resetSalesCachesForTests();
  });

  it("filters the shared marketplace scan down to one collection", async () => {
    const { client } = fakeClient({
      logs: [saleLog(1, 100), saleLog(2, 200)],
      offers: {
        1: offerTuple(RANDOM_WALK_NFT, 7, 0.5),
        2: offerTuple(COSMIC_NFT, 3, 1.25),
      },
    });

    const randomWalkSales = await getCollectionSales("random-walk", client);
    const cosmicSales = await getCollectionSales("cosmic-signature", client);

    expect(randomWalkSales?.map((sale) => sale.tokenId)).toEqual([7]);
    expect(cosmicSales?.map((sale) => sale.tokenId)).toEqual([3]);
  });

  it("degrades to undefined when the sales scan fails", async () => {
    const { client } = fakeClient({ logs: [], offers: {}, failGetLogs: true });

    await expect(
      getCollectionSales("random-walk", client),
    ).resolves.toBeUndefined();
  });
});

describe("summarizeSales", () => {
  it("aggregates count, volume, last sale, and top sale", () => {
    const sales: MarketSale[] = [
      {
        collectionId: "random-walk",
        tokenId: 9,
        offerId: 3,
        priceEth: 2,
        seller: SELLER,
        buyer: BUYER,
        blockNumber: 300,
        soldAt: "2026-06-01T00:00:00.000Z",
      },
      {
        collectionId: "random-walk",
        tokenId: 7,
        offerId: 1,
        priceEth: 5,
        seller: SELLER,
        buyer: BUYER,
        blockNumber: 200,
      },
      {
        collectionId: "random-walk",
        tokenId: 8,
        offerId: 2,
        priceEth: 0.5,
        seller: SELLER,
        buyer: BUYER,
        blockNumber: 100,
      },
    ];

    const summary = summarizeSales(sales);

    expect(summary.count).toBe(3);
    expect(summary.volumeEth).toBeCloseTo(7.5);
    expect(summary.lastSale?.offerId).toBe(3);
    expect(summary.topSale?.offerId).toBe(1);
  });

  it("handles empty sales lists", () => {
    expect(summarizeSales([])).toEqual({
      count: 0,
      volumeEth: 0,
      lastSale: undefined,
      topSale: undefined,
    });
  });
});
