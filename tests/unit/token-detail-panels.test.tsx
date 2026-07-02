import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/marketplace/token-actions", () => ({
  TokenActions: () => <div>Mock trading controls</div>,
}));

import {
  TokenHistoryPanel,
  TokenMarketPanel,
} from "@/components/marketplace/token-detail-panels";
import { requireCollection } from "@/config/collections";
import type { MarketToken } from "@/lib/marketplace/types";

function token(overrides: Partial<MarketToken> = {}): MarketToken {
  return {
    collectionId: "random-walk",
    tokenId: 7,
    name: "Random Walk #000007",
    owner: "0x0000000000000000000000000000000000000001",
    seed: "seed",
    traits: [],
    artwork: { image: "/art.png", alt: "Artwork" },
    ...overrides,
  };
}

describe("token detail panels", () => {
  it("renders a provenance timeline with sparkline for sale history", () => {
    render(
      <TokenHistoryPanel
        token={token({
          tokenHistory: [
            {
              recordType: 1,
              blockNumber: 100,
              timestamp: 1,
              dateTime: "2026-01-01T00:00:00.000Z",
              buyer: "0x0000000000000000000000000000000000000002",
              price: 1,
            },
            {
              recordType: 2,
              blockNumber: 200,
              timestamp: 2,
              dateTime: "2026-02-01T00:00:00.000Z",
              buyer: "0x0000000000000000000000000000000000000003",
              seller: "0x0000000000000000000000000000000000000002",
              price: 2,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText(/2 records/i)).toBeInTheDocument();
    expect(screen.getByText(/latest event/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/sale price trend sparkline/i),
    ).toBeInTheDocument();
  });

  it("shows an empty history state when no records exist", () => {
    render(<TokenHistoryPanel token={token()} />);

    expect(screen.getByText(/0 records/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no public transfer history/i),
    ).toBeInTheDocument();
  });

  it("shows listed price with usd approximation in the market panel", () => {
    render(
      <TokenMarketPanel
        collection={requireCollection("random-walk")}
        token={token()}
        activeSellOffer={{
          id: "sell",
          collectionId: "random-walk",
          tokenId: 7,
          kind: "sell",
          priceEth: 2,
          maker: "0x0000000000000000000000000000000000000002",
          createdAt: "2026-01-01T00:00:00.000Z",
        }}
        highestBid={undefined}
        offers={[]}
        usdPerEth={3000}
      />,
    );

    expect(screen.getAllByText("2.00 ETH").length).toBeGreaterThan(0);
    expect(screen.getByText(/\$6,000/)).toBeInTheDocument();
    expect(screen.getByText(/no bids/i)).toBeInTheDocument();
    expect(screen.getByText("Mock trading controls")).toBeInTheDocument();
  });

  it("explains market jargon with glossary tooltips", () => {
    render(
      <TokenMarketPanel
        collection={requireCollection("random-walk")}
        token={token()}
        activeSellOffer={undefined}
        highestBid={undefined}
        offers={[]}
        usdPerEth={undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: /about listing/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /about top bid/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /about order book/i }),
    ).toBeInTheDocument();
  });

  it("explains provenance with a glossary tooltip", () => {
    render(<TokenHistoryPanel token={token()} />);

    expect(
      screen.getByRole("button", { name: /about provenance/i }),
    ).toBeInTheDocument();
  });

  it("shows unlisted state without usd line", () => {
    render(
      <TokenMarketPanel
        collection={requireCollection("random-walk")}
        token={token()}
        activeSellOffer={undefined}
        highestBid={undefined}
        offers={[]}
        usdPerEth={undefined}
      />,
    );

    expect(screen.getByText("Unlisted")).toBeInTheDocument();
    expect(screen.queryByText(/≈/)).toBeNull();
  });
});
