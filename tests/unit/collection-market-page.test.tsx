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

const anchoringMocks = vi.hoisted(() => ({
  getAnchoredTokenIdSet: vi.fn(),
}));

const ethUsdMocks = vi.hoisted(() => ({
  getEthUsdPrice: vi.fn(),
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
    getMarketplaceTokenPage: queryMocks.getMarketplaceTokenPage,
  };
});
vi.mock("@/lib/marketplace/collection-index-live", () => collectionIndexMocks);
vi.mock("@/lib/marketplace/anchoring-live", () => anchoringMocks);
vi.mock("@/lib/pricing/eth-usd", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/pricing/eth-usd")>();

  return {
    ...actual,
    getEthUsdPrice: ethUsdMocks.getEthUsdPrice,
  };
});
vi.mock("@/lib/marketplace/sales-live", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/marketplace/sales-live")>();

  return {
    ...actual,
    getCollectionSales: salesMocks.getCollectionSales,
  };
});

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
    anchoringMocks.getAnchoredTokenIdSet.mockResolvedValue(undefined);
    ethUsdMocks.getEthUsdPrice.mockResolvedValue(undefined);
    salesMocks.getCollectionSales.mockResolvedValue(undefined);
  });

  it("shows a sold stat with lifetime volume when sales data resolves", async () => {
    queryMocks.getMarketplaceOffers.mockResolvedValue(collectionWideOffers);
    ethUsdMocks.getEthUsdPrice.mockResolvedValue(2000);
    salesMocks.getCollectionSales.mockResolvedValue([
      {
        collectionId: "random-walk",
        tokenId: 9,
        offerId: 3,
        priceEth: 2,
        seller: "0x0000000000000000000000000000000000000011",
        buyer: "0x0000000000000000000000000000000000000022",
        blockNumber: 300,
      },
      {
        collectionId: "random-walk",
        tokenId: 7,
        offerId: 1,
        priceEth: 0.5,
        seller: "0x0000000000000000000000000000000000000011",
        buyer: "0x0000000000000000000000000000000000000022",
        blockNumber: 100,
      },
    ]);

    render(
      await CollectionMarketPage({
        collectionId: "random-walk",
        searchParams: Promise.resolve({}),
      }),
    );

    const soldCard = screen.getByRole("link", { name: /^sold/i });

    expect(soldCard).toHaveTextContent("2");
    expect(soldCard).toHaveTextContent("2.50 ETH lifetime volume");
    expect(soldCard).toHaveTextContent("≈ $5,000");
    expect(soldCard).toHaveAttribute("href", "/token/random-walk/9");
  });

  it("shows a linked never-anchored supply stat when the anchor scan resolves", async () => {
    queryMocks.getMarketplaceOffers.mockResolvedValue(collectionWideOffers);
    anchoringMocks.getAnchoredTokenIdSet.mockResolvedValue(new Set([1, 2, 3]));

    render(
      await CollectionMarketPage({
        collectionId: "random-walk",
        searchParams: Promise.resolve({}),
      }),
    );

    const statCard = screen.getByRole("link", { name: /never anchored/i });

    expect(statCard).toHaveAttribute(
      "href",
      "/random-walk?view=discover&anchor=never",
    );
    expect(statCard).toHaveTextContent("4,997");
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

  it("renders discover token cards when the token page resolves", async () => {
    queryMocks.getMarketplaceOffers.mockResolvedValue(collectionWideOffers);
    queryMocks.getMarketplaceTokenPage.mockResolvedValue({
      items: [
        {
          token: {
            collectionId: "random-walk",
            tokenId: 7,
            name: "Random Walk #000007",
            owner: "0x0000000000000000000000000000000000000001",
            seed: "seed",
            traits: [],
            artwork: { image: "/art.png", alt: "Token artwork" },
          },
          offers: [],
          activeSellOffer: offer({ id: "listing", tokenId: 7, priceEth: 1.5 }),
          highestBid: undefined,
        },
      ],
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
    });

    render(
      await CollectionMarketPage({
        collectionId: "random-walk",
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /#000007/i }),
    ).toBeVisible();
    expect(screen.getByText(/1 tokens/i)).toBeVisible();
  });

  it("degrades gracefully when every marketplace data source fails", async () => {
    queryMocks.getMarketplaceOffers.mockRejectedValue(new Error("offers down"));
    queryMocks.getMarketplaceTokenPage.mockRejectedValue(
      new Error("tokens down"),
    );
    collectionIndexMocks.getCollectionSupply.mockRejectedValue(
      new Error("index down"),
    );
    anchoringMocks.getAnchoredTokenIdSet.mockRejectedValue(
      new Error("anchors down"),
    );
    ethUsdMocks.getEthUsdPrice.mockRejectedValue(new Error("pricing down"));
    salesMocks.getCollectionSales.mockRejectedValue(new Error("sales down"));

    render(
      await CollectionMarketPage({
        collectionId: "random-walk",
        searchParams: Promise.resolve({ query: "1233" }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /^random walk$/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /nothing matched this view/i }),
    ).toBeVisible();
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
