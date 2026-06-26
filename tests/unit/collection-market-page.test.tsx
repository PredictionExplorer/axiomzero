import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketOffer, MarketplaceView } from "@/lib/marketplace/types";

const queryMocks = vi.hoisted(() => ({
  getMarketplaceOffers: vi.fn(),
  getMarketplaceTokenPage: vi.fn(),
}));

const collectionIndexMocks = vi.hoisted(() => ({
  getCollectionSupply: vi.fn(),
}));

vi.mock("@/lib/marketplace/queries", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/marketplace/queries")>();

  return {
    ...actual,
    getMarketplaceOffers: queryMocks.getMarketplaceOffers,
    getMarketplaceTokenPage: queryMocks.getMarketplaceTokenPage,
  };
});
vi.mock("@/lib/marketplace/collection-index-live", () => collectionIndexMocks);

import { CollectionMarketPage } from "@/components/marketplace/collection-market-page";

function offer(overrides: Partial<MarketOffer>): MarketOffer {
  return {
    id: "offer",
    collectionId: "random-walk",
    tokenId: 1,
    kind: "sell",
    priceEth: 1,
    maker: "0x0000000000000000000000000000000000000001",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const collectionWideOffers = [
  offer({ id: "expensive-listing", tokenId: 5, kind: "sell", priceEth: 3 }),
  offer({ id: "floor", tokenId: 7, kind: "sell", priceEth: 1.5 }),
  offer({ id: "low-bid", tokenId: 8, kind: "buy", priceEth: 1 }),
  offer({ id: "top-bid", tokenId: 9, kind: "buy", priceEth: 2.25 }),
  offer({
    id: "inactive-high-bid",
    tokenId: 10,
    kind: "buy",
    priceEth: 10,
    active: false,
  }),
] satisfies MarketOffer[];

describe("CollectionMarketPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.getMarketplaceTokenPage.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 12,
      totalItems: 0,
      totalPages: 1,
    });
    collectionIndexMocks.getCollectionSupply.mockResolvedValue(5_000);
  });

  it("uses visible offers for stats when discover is already collection-wide", async () => {
    queryMocks.getMarketplaceOffers.mockResolvedValueOnce(collectionWideOffers);

    render(
      await CollectionMarketPage({
        collectionId: "random-walk",
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole("link", { name: /floor price 1\.50 eth/i }),
    ).toHaveTextContent("1.50 ETH");
    expect(
      screen.getByRole("link", { name: /top bid 2\.25 eth/i }),
    ).toHaveTextContent("2.25 ETH");
    expect(queryMocks.getMarketplaceOffers).toHaveBeenCalledTimes(1);
  });

  it("uses collection-wide stats when discover results are filtered", async () => {
    queryMocks.getMarketplaceOffers
      .mockResolvedValueOnce([
        offer({ id: "filtered-listing", tokenId: 1233, priceEth: 4 }),
      ])
      .mockResolvedValueOnce(collectionWideOffers);

    render(
      await CollectionMarketPage({
        collectionId: "random-walk",
        searchParams: Promise.resolve({ query: "1233" }),
      }),
    );

    expect(
      screen.getByRole("link", { name: /floor price 1\.50 eth/i }),
    ).toHaveTextContent("1.50 ETH");
    expect(
      screen.getByRole("link", { name: /top bid 2\.25 eth/i }),
    ).toHaveTextContent("2.25 ETH");
    expect(queryMocks.getMarketplaceOffers.mock.calls[1]?.[0]).toEqual({
      collection: "random-walk",
      kind: "all",
      view: "discover",
      sort: "price-asc",
    });
  });

  it.each([
    ["listings", "sell"],
    ["top-bids", "buy"],
  ] satisfies Array<[MarketplaceView, "sell" | "buy"]>)(
    "keeps stats collection-wide on the %s view",
    async (view, visibleKind) => {
      queryMocks.getMarketplaceOffers
        .mockResolvedValueOnce([
          offer({
            id: `${view}-visible`,
            tokenId: 11,
            kind: visibleKind,
            priceEth: visibleKind === "sell" ? 4 : 0.5,
          }),
        ])
        .mockResolvedValueOnce(collectionWideOffers);

      render(
        await CollectionMarketPage({
          collectionId: "random-walk",
          searchParams: Promise.resolve({ view }),
        }),
      );

      expect(
        screen.getByRole("link", { name: /floor price 1\.50 eth/i }),
      ).toHaveTextContent("1.50 ETH");
      expect(
        screen.getByRole("link", { name: /top bid 2\.25 eth/i }),
      ).toHaveTextContent("2.25 ETH");
      expect(queryMocks.getMarketplaceOffers).toHaveBeenCalledTimes(2);
      expect(queryMocks.getMarketplaceOffers.mock.calls[1]?.[0]).toEqual({
        collection: "random-walk",
        kind: "all",
        view: "discover",
        sort: "price-asc",
      });
    },
  );
});
