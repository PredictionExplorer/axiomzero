import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  getMarketplaceOffers: vi.fn(),
  getMarketplaceStats: vi.fn(),
  getTokenMarket: vi.fn(),
  parseMarketplaceSearchParams: vi.fn(),
}));

vi.mock("@/lib/marketplace/queries", () => queryMocks);

import { GET as getOffers } from "@/app/api/marketplace/offers/route";
import { GET as getTokenMarketRoute } from "@/app/api/marketplace/token/[collectionId]/[tokenId]/route";

describe("marketplace API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.parseMarketplaceSearchParams.mockReturnValue({
      collection: "all",
      kind: "buy",
      sort: "price-asc",
    });
    queryMocks.getMarketplaceStats.mockReturnValue({
      totalOffers: 1,
      sellListings: 0,
      buyOffers: 1,
      floorOffer: undefined,
      topBidOffer: {
        id: "buy-1",
        collectionId: "random-walk",
        tokenId: 1,
        kind: "buy",
        priceEth: 0.5,
        maker: "0x0000000000000000000000000000000000000001",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("returns normalized marketplace offers and stats", async () => {
    queryMocks.getMarketplaceOffers.mockResolvedValueOnce([
      {
        id: "buy-1",
        collectionId: "random-walk",
        tokenId: 1,
        kind: "buy",
        priceEth: 0.5,
        maker: "0x0000000000000000000000000000000000000001",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const response = await getOffers(
      new NextRequest("http://localhost/api/marketplace/offers?filter=buy"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(queryMocks.parseMarketplaceSearchParams).toHaveBeenCalledWith({
      filter: "buy",
    });
    expect(payload.stats.totalOffers).toBe(1);
    expect(payload.stats.topBidOffer).toMatchObject({
      id: "buy-1",
      priceEth: 0.5,
    });
    expect(payload.offers[0]).toMatchObject({ id: "buy-1", kind: "buy" });
  });

  it("returns a bad gateway response when source loading fails", async () => {
    queryMocks.getMarketplaceOffers.mockRejectedValueOnce(
      new Error("backend unavailable"),
    );

    const response = await getOffers(
      new NextRequest("http://localhost/api/marketplace/offers"),
    );

    await expect(response.json()).resolves.toMatchObject({
      error: "backend unavailable",
    });
    expect(response.status).toBe(502);
  });

  it("returns token market data for known collections", async () => {
    queryMocks.getTokenMarket.mockResolvedValueOnce({
      token: { tokenId: 9 },
      offers: [],
    });

    const response = await getTokenMarketRoute(
      new NextRequest("http://localhost/api/marketplace/token/random-walk/9"),
      {
        params: Promise.resolve({
          collectionId: "random-walk",
          tokenId: "9",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(queryMocks.getTokenMarket).toHaveBeenCalledWith("random-walk", 9);
    expect(payload.token).toMatchObject({ tokenId: 9 });
  });

  it("returns not found for unsupported token requests", async () => {
    const response = await getTokenMarketRoute(
      new NextRequest("http://localhost/api/marketplace/token/not-real/9"),
      {
        params: Promise.resolve({
          collectionId: "not-real",
          tokenId: "9",
        }),
      } as never,
    );

    expect(response.status).toBe(404);
  });
});
