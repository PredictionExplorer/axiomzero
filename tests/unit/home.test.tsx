import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MarketOffer } from "@/lib/marketplace/types";

const queryMocks = vi.hoisted(() => ({
  getMarketplaceOffers: vi.fn(),
}));

vi.mock("@/lib/marketplace/queries", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/marketplace/queries")>();

  return {
    ...actual,
    getMarketplaceOffers: queryMocks.getMarketplaceOffers,
  };
});

import Home from "@/app/page";

function marketOffer(overrides: Partial<MarketOffer>): MarketOffer {
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

describe("Home", () => {
  it("links to the three main destinations and token-specific market stats", async () => {
    const randomWalkOffers = [
      marketOffer({
        id: "rw-higher-listing",
        collectionId: "random-walk",
        tokenId: 5,
        kind: "sell",
        priceEth: 3,
      }),
      marketOffer({
        id: "rw-inactive-low-listing",
        collectionId: "random-walk",
        tokenId: 6,
        kind: "sell",
        priceEth: 0.1,
        active: false,
      }),
      marketOffer({
        id: "rw-floor",
        collectionId: "random-walk",
        tokenId: 7,
        kind: "sell",
        priceEth: 1.5,
      }),
      marketOffer({
        id: "rw-lower-bid",
        collectionId: "random-walk",
        tokenId: 8,
        kind: "buy",
        priceEth: 1,
      }),
      marketOffer({
        id: "rw-bid",
        collectionId: "random-walk",
        tokenId: 9,
        kind: "buy",
        priceEth: 2.25,
      }),
      marketOffer({
        id: "rw-inactive-high-bid",
        collectionId: "random-walk",
        tokenId: 10,
        kind: "buy",
        priceEth: 10,
        active: false,
      }),
    ];
    queryMocks.getMarketplaceOffers
      .mockResolvedValueOnce(randomWalkOffers)
      .mockResolvedValueOnce([]);

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
    expect(screen.getAllByText("N/A")).toHaveLength(2);
  });
});
