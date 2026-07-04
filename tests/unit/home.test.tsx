import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  HomeArtworkItem,
  HomeCollectionPulse,
} from "@/lib/marketplace/home-data";

const homeDataMocks = vi.hoisted(() => ({
  getHomeHeroArtworks: vi.fn(),
  getHomeMarketOverview: vi.fn(),
}));

vi.mock("@/lib/marketplace/home-data", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/marketplace/home-data")>();

  return {
    ...actual,
    getHomeHeroArtworks: homeDataMocks.getHomeHeroArtworks,
    getHomeMarketOverview: homeDataMocks.getHomeMarketOverview,
  };
});

const ethUsdMocks = vi.hoisted(() => ({
  getEthUsdPrice: vi.fn(),
}));

vi.mock("@/lib/pricing/eth-usd", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/pricing/eth-usd")>();

  return {
    ...actual,
    getEthUsdPrice: ethUsdMocks.getEthUsdPrice,
  };
});

import Home from "@/app/page";

function pulse(
  overrides: Partial<HomeCollectionPulse> & {
    collectionId: HomeCollectionPulse["collectionId"];
    shortName: string;
  },
): HomeCollectionPulse {
  return {
    supply: 100,
    stats: {
      totalOffers: 0,
      sellListings: 0,
      buyOffers: 0,
      floorOffer: undefined,
      topBidOffer: undefined,
    },
    ...overrides,
  };
}

describe("Home", () => {
  beforeEach(() => {
    ethUsdMocks.getEthUsdPrice.mockResolvedValue(2000);
  });

  it("renders without usd hints when the exchange rate lookup fails", async () => {
    ethUsdMocks.getEthUsdPrice.mockRejectedValue(new Error("pricing down"));
    homeDataMocks.getHomeHeroArtworks.mockResolvedValue([]);
    homeDataMocks.getHomeMarketOverview.mockResolvedValue({
      pulses: [
        pulse({ collectionId: "random-walk", shortName: "Random Walk" }),
        pulse({
          collectionId: "cosmic-signature",
          shortName: "Cosmic Signature",
        }),
      ],
      featured: [],
    });

    render(await Home());

    expect(
      screen.getByRole("link", { name: /^my nfts$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/≈ \$/)).toBeNull();
  });

  it("links to the three main destinations and token-specific market stats", async () => {
    const randomWalkPulse = pulse({
      collectionId: "random-walk",
      shortName: "Random Walk",
      supply: 4086,
      stats: {
        totalOffers: 4,
        sellListings: 2,
        buyOffers: 2,
        floorOffer: {
          id: "rw-floor",
          collectionId: "random-walk",
          tokenId: 7,
          kind: "sell",
          priceEth: 1.5,
          maker: "0x0000000000000000000000000000000000000001",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        topBidOffer: {
          id: "rw-bid",
          collectionId: "random-walk",
          tokenId: 9,
          kind: "buy",
          priceEth: 2.25,
          maker: "0x0000000000000000000000000000000000000002",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
    });
    const cosmicPulse = pulse({
      collectionId: "cosmic-signature",
      shortName: "Cosmic Signature",
      supply: 24,
    });
    const featured: HomeArtworkItem[] = [
      {
        collectionId: "random-walk",
        tokenId: 7,
        name: "Random Walk #7",
        artwork: { image: "/rw-7.png", alt: "Random Walk #7 artwork" },
        priceEth: 1.5,
      },
    ];

    homeDataMocks.getHomeHeroArtworks.mockResolvedValue([
      {
        collectionId: "random-walk",
        tokenId: 1,
        name: "Random Walk #1",
        artwork: { image: "/rw-1.png", alt: "Random Walk #1 artwork" },
      },
    ]);
    homeDataMocks.getHomeMarketOverview.mockResolvedValue({
      pulses: [randomWalkPulse, cosmicPulse],
      featured,
    });

    render(await Home());

    expect(screen.getByRole("link", { name: /^my nfts$/i })).toHaveAttribute(
      "href",
      "/my-nfts",
    );
    expect(
      screen.getByRole("link", { name: /^random walk$/i }),
    ).toHaveAttribute("href", "/random-walk");
    expect(
      screen.getByRole("link", { name: /^cosmic signature$/i }),
    ).toHaveAttribute("href", "/cosmic-signature");

    expect(
      screen.getByRole("link", { name: /random walk floor price 1.50 eth/i }),
    ).toHaveAttribute("href", "/token/random-walk/7");
    expect(
      screen.getByRole("link", { name: /random walk highest bid 2.25 eth/i }),
    ).toHaveAttribute("href", "/token/random-walk/9");
    expect(screen.getAllByText("N/A").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole("heading", {
        name: /questions collectors ask before they trade/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /live works on the market/i }),
    ).toBeInTheDocument();
  });

  it("shows the on-chain activity band when sales data is available", async () => {
    homeDataMocks.getHomeHeroArtworks.mockResolvedValue([]);
    homeDataMocks.getHomeMarketOverview.mockResolvedValue({
      pulses: [
        pulse({ collectionId: "random-walk", shortName: "Random Walk" }),
        pulse({
          collectionId: "cosmic-signature",
          shortName: "Cosmic Signature",
        }),
      ],
      featured: [],
      activity: {
        totalSales: 169,
        totalVolumeEth: 12.5,
        activeOrders: 8,
        perCollection: [
          {
            collectionId: "random-walk",
            shortName: "Random Walk",
            sales: { count: 150, volumeEth: 10 },
          },
        ],
        recentSales: [
          {
            collectionId: "random-walk",
            tokenId: 77,
            offerId: 448,
            priceEth: 0.4,
            seller: "0x0000000000000000000000000000000000000011",
            buyer: "0x0000000000000000000000000000000000000022",
            blockNumber: 200,
            name: "Random Walk #77",
            artwork: { image: "/rw-77.png", alt: "Random Walk #77 artwork" },
          },
        ],
      },
    });

    render(await Home());

    expect(
      screen.getByRole("heading", { name: /real trades, settled on-chain/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("169")).toBeInTheDocument();
    expect(screen.getByText(/≈ \$25,000/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /random walk #77/i }),
    ).toHaveAttribute("href", "/token/random-walk/77");
  });

  it("hides the activity band when sales data is unavailable", async () => {
    homeDataMocks.getHomeHeroArtworks.mockResolvedValue([]);
    homeDataMocks.getHomeMarketOverview.mockResolvedValue({
      pulses: [
        pulse({ collectionId: "random-walk", shortName: "Random Walk" }),
        pulse({
          collectionId: "cosmic-signature",
          shortName: "Cosmic Signature",
        }),
      ],
      featured: [],
    });

    render(await Home());

    expect(
      screen.queryByRole("heading", { name: /real trades, settled on-chain/i }),
    ).toBeNull();
  });

  it("guides newcomers with a how-it-works strip and a full FAQ link", async () => {
    homeDataMocks.getHomeHeroArtworks.mockResolvedValue([]);
    homeDataMocks.getHomeMarketOverview.mockResolvedValue({
      pulses: [
        pulse({ collectionId: "random-walk", shortName: "Random Walk" }),
        pulse({
          collectionId: "cosmic-signature",
          shortName: "Cosmic Signature",
        }),
      ],
      featured: [],
    });

    render(await Home());

    expect(
      screen.getByRole("heading", {
        name: /three steps from browsing to owning/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /the faq walks through every step/i }),
    ).toHaveAttribute("href", "/faq");
    expect(
      screen.getByRole("link", { name: /read the full faq/i }),
    ).toHaveAttribute("href", "/faq");
  });
});
