import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketplaceStatsGrid } from "@/components/marketplace/marketplace-stats";
import type { MarketOffer, MarketplaceStats } from "@/lib/marketplace/types";

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

describe("MarketplaceStatsGrid", () => {
  it("links floor price and top bid metrics to their token pages", () => {
    const stats = {
      totalOffers: 2,
      sellListings: 1,
      buyOffers: 1,
      floorOffer: marketOffer({
        id: "floor",
        collectionId: "random-walk",
        tokenId: 7,
        kind: "sell",
        priceEth: 1.5,
      }),
      topBidOffer: marketOffer({
        id: "top-bid",
        collectionId: "cosmic-signature",
        tokenId: 12,
        kind: "buy",
        priceEth: 3.25,
      }),
    } satisfies MarketplaceStats;

    render(<MarketplaceStatsGrid stats={stats} />);

    expect(screen.getByRole("link", { name: /floor price/i })).toHaveAttribute(
      "href",
      "/token/random-walk/7",
    );
    expect(
      screen.getByRole("link", { name: /floor price/i }),
    ).toHaveTextContent("1.50 ETH");
    expect(screen.getByRole("link", { name: /top bid/i })).toHaveAttribute(
      "href",
      "/token/cosmic-signature/12",
    );
    expect(screen.getByRole("link", { name: /top bid/i })).toHaveTextContent(
      "3.25 ETH",
    );
  });

  it("keeps missing floor and bid metrics non-clickable", () => {
    render(
      <MarketplaceStatsGrid
        stats={{
          totalOffers: 0,
          sellListings: 0,
          buyOffers: 0,
          floorOffer: undefined,
          topBidOffer: undefined,
        }}
      />,
    );

    expect(screen.queryByRole("link", { name: /floor price/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /top bid/i })).toBeNull();
    expect(screen.getAllByText("N/A")).toHaveLength(2);
  });

  it("links the never-anchored supply card to the anchor filter", () => {
    render(
      <MarketplaceStatsGrid
        stats={{
          totalOffers: 0,
          sellListings: 0,
          buyOffers: 0,
          floorOffer: undefined,
          topBidOffer: undefined,
        }}
        anchorSupply={{
          neverAnchoredCount: 4_060,
          href: "/random-walk?view=discover&anchor=never",
        }}
      />,
    );

    const card = screen.getByRole("link", { name: /never anchored/i });

    expect(card).toHaveAttribute(
      "href",
      "/random-walk?view=discover&anchor=never",
    );
    expect(card).toHaveTextContent("4,060");
  });

  it("adds approximate USD context to floor and top bid when available", () => {
    render(
      <MarketplaceStatsGrid
        stats={{
          totalOffers: 2,
          sellListings: 1,
          buyOffers: 1,
          floorOffer: marketOffer({ priceEth: 2 }),
          topBidOffer: marketOffer({
            id: "bid",
            kind: "buy",
            priceEth: 1,
          }),
        }}
        usdPerEth={3000}
      />,
    );

    expect(
      screen.getByRole("link", { name: /floor price/i }),
    ).toHaveTextContent("≈ $6,000");
    expect(screen.getByRole("link", { name: /top bid/i })).toHaveTextContent(
      "≈ $3,000",
    );
  });
});
