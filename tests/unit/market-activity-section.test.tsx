import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketActivitySection } from "@/components/home/market-activity-section";
import type { HomeActivity } from "@/lib/marketplace/home-data";

function activity(overrides: Partial<HomeActivity> = {}): HomeActivity {
  return {
    totalSales: 169,
    totalVolumeEth: 12.5,
    activeOrders: 8,
    perCollection: [
      {
        collectionId: "random-walk",
        shortName: "Random Walk",
        sales: { count: 150, volumeEth: 10 },
      },
      {
        collectionId: "cosmic-signature",
        shortName: "Cosmic Signature",
        sales: { count: 19, volumeEth: 2.5 },
      },
    ],
    recentSales: [
      {
        collectionId: "cosmic-signature",
        tokenId: 8,
        offerId: 449,
        priceEth: 0.15,
        seller: "0x0000000000000000000000000000000000000011",
        buyer: "0x0000000000000000000000000000000000000022",
        blockNumber: 300,
        soldAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        name: "Cosmic Signature #8",
        artwork: { image: "/cs-8.png", alt: "Cosmic Signature #8 artwork" },
      },
      {
        collectionId: "random-walk",
        tokenId: 77,
        offerId: 448,
        priceEth: 0.4,
        seller: "0x0000000000000000000000000000000000000011",
        buyer: "0x0000000000000000000000000000000000000022",
        blockNumber: 200,
        name: "Random Walk #77",
        artwork: undefined,
      },
    ],
    ...overrides,
  };
}

describe("MarketActivitySection", () => {
  it("hides the latest sales rail when no recent sales resolved", () => {
    render(
      <MarketActivitySection activity={activity({ recentSales: [] })} />,
    );

    expect(screen.getByText("169")).toBeInTheDocument();
    expect(screen.queryByText(/latest sales/i)).toBeNull();
  });

  it("renders nothing without activity data or sales", () => {
    const { container: empty } = render(<MarketActivitySection />);
    expect(empty).toBeEmptyDOMElement();

    const { container: zero } = render(
      <MarketActivitySection activity={activity({ totalSales: 0 })} />,
    );
    expect(zero).toBeEmptyDOMElement();
  });

  it("shows headline totals with per-collection splits and USD context", () => {
    render(<MarketActivitySection activity={activity()} usdPerEth={2000} />);

    expect(
      screen.getByRole("heading", { name: /real trades, settled on-chain/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("169")).toBeInTheDocument();
    expect(
      screen.getByText("150 Random Walk · 19 Cosmic Signature"),
    ).toBeInTheDocument();
    expect(screen.getByText("12.50 ETH")).toBeInTheDocument();
    expect(screen.getByText(/≈ \$25,000/)).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders the latest sales rail with prices, times, and token links", () => {
    render(<MarketActivitySection activity={activity()} />);

    const saleCard = screen.getByRole("link", { name: /cosmic signature #8/i });

    expect(saleCard).toHaveAttribute("href", "/token/cosmic-signature/8");
    expect(saleCard).toHaveTextContent("0.1500 ETH");
    expect(saleCard).toHaveTextContent("2h ago");

    // Sales without timestamps or artwork still render a useful card.
    const fallbackCard = screen.getByRole("link", { name: /random walk #77/i });

    expect(fallbackCard).toHaveTextContent("Settled on-chain");
    expect(fallbackCard).toHaveTextContent("#000077");
  });

  it("explains sold and volume jargon with glossary tooltips", () => {
    render(<MarketActivitySection activity={activity()} />);

    expect(
      screen.getByRole("button", { name: /about sold/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /about volume/i }),
    ).toBeInTheDocument();
  });
});
