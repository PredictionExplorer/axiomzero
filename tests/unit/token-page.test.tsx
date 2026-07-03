import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketOffer, MarketToken } from "@/lib/marketplace/types";

const queryMocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  getTokenMarket: vi.fn(),
  isTokenNotFoundError: vi.fn(() => false),
}));

const collectionIndexMocks = vi.hoisted(() => ({
  getCollectionTokenIds: vi.fn(),
}));

const salesMocks = vi.hoisted(() => ({
  getCollectionSales: vi.fn(),
}));

vi.mock("@/lib/marketplace/queries", () => queryMocks);
vi.mock("@/lib/marketplace/collection-index-live", () => collectionIndexMocks);
vi.mock("@/lib/pricing/eth-usd", () => ({
  getEthUsdPrice: vi.fn().mockResolvedValue(3000),
  formatEthWithUsd: vi.fn(() => "$3,750.00"),
}));
vi.mock("@/lib/marketplace/sales-live", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/marketplace/sales-live")>();

  return {
    ...actual,
    getCollectionSales: salesMocks.getCollectionSales,
  };
});
vi.mock("@/components/marketplace/token-actions", () => ({
  TokenActions: () => <div>Mock trading controls</div>,
}));

import TokenPage from "@/app/token/[collectionId]/[tokenId]/page";

function token(overrides: Partial<MarketToken> = {}): MarketToken {
  return {
    collectionId: "cosmic-signature",
    tokenId: 19,
    name: "NUMBA 19",
    owner: "0x0000000000000000000000000000000000000001",
    seed: "seed",
    traits: [
      { label: "Round", value: "4" },
      { label: "seed", value: "seed" },
    ],
    artwork: {
      image: "/cosmic.png",
      alt: "Cosmic artwork",
    },
    assets: {
      blackImage: "/cosmic.png",
      whiteImage: "/cosmic.png",
      blackSingleVideo: "/cosmic.mp4",
      whiteSingleVideo: "/cosmic.mp4",
    },
    mintedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function offer(overrides: Partial<MarketOffer>): MarketOffer {
  return {
    id: "offer",
    collectionId: "random-walk",
    tokenId: 1233,
    kind: "sell",
    priceEth: 1,
    maker: "0x0000000000000000000000000000000000000001",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TokenPage", () => {
  beforeEach(() => {
    salesMocks.getCollectionSales.mockResolvedValue(undefined);
  });

  it("renders Cosmic Signature from metadata and hides unavailable controls", async () => {
    queryMocks.getTokenMarket.mockResolvedValueOnce({
      token: token(),
      offers: [],
    });
    collectionIndexMocks.getCollectionTokenIds.mockResolvedValueOnce([
      18, 19, 20,
    ]);
    queryMocks.getToken.mockImplementation(async (_collectionId, tokenId) =>
      token({ tokenId }),
    );

    render(
      await TokenPage({
        params: Promise.resolve({
          collectionId: "cosmic-signature",
          tokenId: "19",
        }),
        searchParams: Promise.resolve({
          theme: "black",
          media: "image",
        }),
      }),
    );

    expect(screen.getByRole("heading", { name: /numba 19/i })).toBeVisible();
    expect(screen.queryByRole("link", { name: /light/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /triple video/i })).toBeNull();
    expect(screen.getByRole("link", { name: /single video/i })).toHaveAttribute(
      "href",
      "/token/cosmic-signature/19?theme=black&media=single&tab=market",
    );
    expect(screen.getByRole("link", { name: /prev token/i })).toHaveAttribute(
      "href",
      "/token/cosmic-signature/18?theme=black&media=image&tab=market",
    );
    expect(screen.getByRole("tab", { name: /history/i })).toHaveAttribute(
      "href",
      "/token/cosmic-signature/19?theme=black&media=image&tab=history",
    );
    expect(screen.getByText("Mock trading controls")).toBeVisible();
  });

  it("renders Random Walk rich media and URL-backed collector notes", async () => {
    queryMocks.getTokenMarket.mockResolvedValueOnce({
      token: token({
        collectionId: "random-walk",
        tokenId: 1233,
        name: "Random Walk #001233",
        artwork: {
          image: "/rw-black.png",
          alt: "Random Walk artwork",
        },
        assets: {
          blackImage: "/rw-black.png",
          whiteImage: "/rw-white.png",
          blackSingleVideo: "/rw-black-single.mp4",
          blackTripleVideo: "/rw-black-triple.mp4",
          whiteSingleVideo: "/rw-white-single.mp4",
          whiteTripleVideo: "/rw-white-triple.mp4",
        },
        rating: 9.25,
      }),
      offers: [
        offer({
          id: "inactive-sell",
          kind: "sell",
          priceEth: 0.01,
          active: false,
        }),
        offer({ id: "sell", kind: "sell", priceEth: 1.25 }),
        offer({ id: "low-bid", kind: "buy", priceEth: 0.75 }),
        offer({ id: "bid", kind: "buy", priceEth: 2 }),
        offer({ id: "inactive-bid", kind: "buy", priceEth: 10, active: false }),
      ],
    });
    collectionIndexMocks.getCollectionTokenIds.mockResolvedValueOnce([
      1232, 1233, 1234,
    ]);
    queryMocks.getToken.mockImplementation(async (_collectionId, tokenId) =>
      token({
        collectionId: "random-walk",
        tokenId,
        name: `Random Walk #${String(tokenId).padStart(6, "0")}`,
      }),
    );

    render(
      await TokenPage({
        params: Promise.resolve({
          collectionId: "random-walk",
          tokenId: "1233",
        }),
        searchParams: Promise.resolve({
          theme: "white",
          media: "triple",
          tab: "notes",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /random walk #001233/i }),
    ).toBeVisible();
    expect(screen.getByText("Listed at 1.25 ETH")).toBeVisible();
    expect(screen.getByText("2.00 ETH")).toBeVisible();
    expect(
      screen.getByLabelText(/random walk #001233 triple video/i),
    ).toHaveAttribute("src", "/rw-white-triple.mp4");
    expect(screen.getByRole("link", { name: /light/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: /triple video/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: /next token/i })).toHaveAttribute(
      "href",
      "/token/random-walk/1234?theme=white&media=triple&tab=notes",
    );
    expect(
      screen.getByRole("button", { name: /copy detail link/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("tab", { name: /collector notes/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("shows the anchor status pill and watch toggle for never-anchored tokens", async () => {
    queryMocks.getTokenMarket.mockResolvedValueOnce({
      token: token({ anchored: false }),
      offers: [],
    });
    collectionIndexMocks.getCollectionTokenIds.mockResolvedValueOnce([19]);

    render(
      await TokenPage({
        params: Promise.resolve({
          collectionId: "cosmic-signature",
          tokenId: "19",
        }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Never anchored")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /add token 19 to your watchlist/i }),
    ).toBeVisible();
  });

  it("surfaces the token's most recent on-chain sale in the market panel", async () => {
    queryMocks.getTokenMarket.mockResolvedValueOnce({
      token: token(),
      offers: [],
    });
    collectionIndexMocks.getCollectionTokenIds.mockResolvedValueOnce([19]);
    salesMocks.getCollectionSales.mockResolvedValue([
      {
        collectionId: "cosmic-signature",
        tokenId: 19,
        offerId: 5,
        priceEth: 0.25,
        seller: "0x0000000000000000000000000000000000000011",
        buyer: "0x0000000000000000000000000000000000000022",
        blockNumber: 300,
        soldAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        collectionId: "cosmic-signature",
        tokenId: 4,
        offerId: 2,
        priceEth: 9,
        seller: "0x0000000000000000000000000000000000000011",
        buyer: "0x0000000000000000000000000000000000000022",
        blockNumber: 100,
      },
    ]);

    render(
      await TokenPage({
        params: Promise.resolve({
          collectionId: "cosmic-signature",
          tokenId: "19",
        }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Last sale")).toBeInTheDocument();
    expect(screen.getByText("0.2500 ETH · 3d ago")).toBeInTheDocument();
    // The other token's sale must not leak into this token's stat.
    expect(screen.queryByText(/9\.00 ETH/)).toBeNull();
  });

  it("labels tokens held by the anchoring vault", async () => {
    queryMocks.getTokenMarket.mockResolvedValueOnce({
      token: token({
        anchored: true,
        owner: "0x6308A405B4FF1eA890870Efe2a6D036750B81F7C",
      }),
      offers: [],
    });
    collectionIndexMocks.getCollectionTokenIds.mockResolvedValueOnce([19]);

    render(
      await TokenPage({
        params: Promise.resolve({
          collectionId: "cosmic-signature",
          tokenId: "19",
        }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Anchored now")).toBeVisible();
    expect(screen.getByText("Anchoring vault")).toBeVisible();
  });
});
