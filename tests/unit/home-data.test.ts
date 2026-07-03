import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  getMarketplaceOffers: vi.fn(),
  getToken: vi.fn(),
}));

const indexMocks = vi.hoisted(() => ({
  getCollectionSupply: vi.fn(),
}));

const salesMocks = vi.hoisted(() => ({
  getCollectionSales: vi.fn(),
}));

vi.mock("@/lib/marketplace/queries", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/marketplace/queries")>();

  return {
    ...actual,
    getMarketplaceOffers: queryMocks.getMarketplaceOffers,
    getToken: queryMocks.getToken,
  };
});

vi.mock("@/lib/marketplace/collection-index-live", () => ({
  getCollectionSupply: indexMocks.getCollectionSupply,
}));

vi.mock("@/lib/marketplace/sales-live", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/marketplace/sales-live")>();

  return {
    ...actual,
    getCollectionSales: salesMocks.getCollectionSales,
  };
});

import {
  getHomeHeroArtworks,
  getHomeMarketOverview,
  pickArtSystemShowcases,
} from "@/lib/marketplace/home-data";
import type { MarketSale } from "@/lib/marketplace/types";

function sale(overrides: Partial<MarketSale> = {}): MarketSale {
  return {
    collectionId: "random-walk",
    tokenId: 7,
    offerId: 1,
    priceEth: 0.5,
    seller: "0x0000000000000000000000000000000000000011",
    buyer: "0x0000000000000000000000000000000000000022",
    blockNumber: 100,
    ...overrides,
  };
}

describe("home data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    salesMocks.getCollectionSales.mockResolvedValue(undefined);
  });

  it("builds pulses and featured listings from one offers snapshot", async () => {
    queryMocks.getMarketplaceOffers.mockImplementation(
      async ({ collection }: { collection: string }) =>
        collection === "random-walk"
          ? [
              {
                id: "sell-cheap",
                collectionId: "random-walk",
                tokenId: 7,
                kind: "sell",
                priceEth: 1,
                maker: "0x0000000000000000000000000000000000000001",
                createdAt: "2026-01-01T00:00:00.000Z",
                artwork: { image: "/rw-7.png", alt: "Artwork 7" },
              },
              {
                id: "sell-expensive",
                collectionId: "random-walk",
                tokenId: 8,
                kind: "sell",
                priceEth: 3,
                maker: "0x0000000000000000000000000000000000000002",
                createdAt: "2026-01-01T00:00:00.000Z",
                artwork: { image: "/rw-8.png", alt: "Artwork 8" },
              },
              {
                id: "no-artwork",
                collectionId: "random-walk",
                tokenId: 9,
                kind: "sell",
                priceEth: 2,
                maker: "0x0000000000000000000000000000000000000003",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
              {
                id: "bid",
                collectionId: "random-walk",
                tokenId: 7,
                kind: "buy",
                priceEth: 0.5,
                maker: "0x0000000000000000000000000000000000000004",
                createdAt: "2026-01-01T00:00:00.000Z",
                artwork: { image: "/rw-7.png", alt: "Artwork 7" },
              },
            ]
          : [],
    );
    indexMocks.getCollectionSupply.mockResolvedValue(4086);

    const overview = await getHomeMarketOverview(2);

    expect(overview.pulses).toHaveLength(2);
    expect(overview.pulses[0]).toMatchObject({
      collectionId: "random-walk",
      supply: 4086,
    });
    expect(overview.pulses[0]?.stats.floorOffer?.priceEth).toBe(1);
    expect(overview.featured.map((item) => item.tokenId)).toEqual([7, 8]);
    expect(overview.featured[0]?.priceEth).toBe(1);
  });

  it("falls back to config supply and empty offers on failures", async () => {
    queryMocks.getMarketplaceOffers.mockRejectedValue(new Error("rpc down"));
    indexMocks.getCollectionSupply.mockRejectedValue(new Error("rpc down"));
    salesMocks.getCollectionSales.mockRejectedValue(new Error("rpc down"));

    const overview = await getHomeMarketOverview();

    expect(overview.pulses).toHaveLength(2);
    expect(overview.pulses[0]?.stats.totalOffers).toBe(0);
    expect(overview.pulses[0]?.supply).toBeGreaterThan(0);
    expect(overview.featured).toEqual([]);
    expect(overview.pulses[0]?.sales).toBeUndefined();
    expect(overview.activity).toBeUndefined();
  });

  it("aggregates activity totals and enriches recent sales with artwork", async () => {
    queryMocks.getMarketplaceOffers.mockImplementation(
      async ({ collection }: { collection: string }) =>
        collection === "random-walk"
          ? [
              {
                id: "bid",
                collectionId: "random-walk",
                tokenId: 7,
                kind: "buy",
                priceEth: 0.5,
                maker: "0x0000000000000000000000000000000000000004",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ]
          : [],
    );
    indexMocks.getCollectionSupply.mockResolvedValue(4086);
    salesMocks.getCollectionSales.mockImplementation(
      async (collectionId: string) =>
        collectionId === "random-walk"
          ? [
              sale({
                tokenId: 9,
                offerId: 3,
                priceEth: 2,
                blockNumber: 300,
                soldAt: "2026-06-01T00:00:00.000Z",
              }),
              sale({ tokenId: 7, offerId: 1, priceEth: 0.5, blockNumber: 100 }),
            ]
          : undefined,
    );

    const overview = await getHomeMarketOverview(8, 1);

    expect(overview.pulses[0]?.sales).toMatchObject({
      count: 2,
      volumeEth: 2.5,
    });
    expect(overview.pulses[1]?.sales).toBeUndefined();
    expect(overview.activity).toMatchObject({
      totalSales: 2,
      totalVolumeEth: 2.5,
      activeOrders: 1,
    });
    expect(overview.activity?.perCollection).toHaveLength(1);
    expect(overview.activity?.recentSales).toHaveLength(1);
    expect(overview.activity?.recentSales[0]).toMatchObject({
      tokenId: 9,
      name: "Random Walk #9",
    });
    // Random Walk previews use deterministic artwork URLs, no fetches.
    expect(overview.activity?.recentSales[0]?.artwork?.image).toContain("9");
  });

  it("loads hero artworks and skips failed tokens", async () => {
    queryMocks.getToken.mockImplementation(
      async (collectionId: string, tokenId: number) => {
        if (collectionId === "cosmic-signature") {
          throw new Error("unavailable");
        }

        return {
          collectionId,
          tokenId,
          name: `Random Walk #${tokenId}`,
          owner: "0x0000000000000000000000000000000000000001",
          seed: "seed",
          traits: [],
          artwork: { image: `/rw-${tokenId}.png`, alt: `Artwork ${tokenId}` },
        };
      },
    );

    const artworks = await getHomeHeroArtworks();

    expect(artworks.length).toBe(3);
    expect(
      artworks.every((item) => item.collectionId === "random-walk"),
    ).toBe(true);

    const showcases = pickArtSystemShowcases(artworks);
    expect(showcases[0]?.collectionId).toBe("random-walk");
    expect(showcases[1]).toBeUndefined();
  });
});
