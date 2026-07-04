import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/marketplace/token-actions", () => ({
  TokenActions: () => <div>Mock trading controls</div>,
}));

import {
  TokenCollectorNotesPanel,
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
              kind: "mint",
              recordType: 1,
              blockNumber: 100,
              timestamp: 1,
              dateTime: "2026-01-01T00:00:00.000Z",
              owner: "0x0000000000000000000000000000000000000002",
              price: 1,
            },
            {
              kind: "sale",
              recordType: 4,
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

  it("shows the last on-chain sale with relative time when available", () => {
    render(
      <TokenMarketPanel
        collection={requireCollection("random-walk")}
        token={token()}
        activeSellOffer={undefined}
        highestBid={undefined}
        offers={[]}
        usdPerEth={undefined}
        lastSale={{
          collectionId: "random-walk",
          tokenId: 7,
          offerId: 12,
          priceEth: 0.8,
          seller: "0x0000000000000000000000000000000000000011",
          buyer: "0x0000000000000000000000000000000000000022",
          blockNumber: 100,
          soldAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        }}
      />,
    );

    expect(screen.getByText("Last sale")).toBeInTheDocument();
    expect(screen.getByText("0.8000 ETH · 5h ago")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /about last sale/i }),
    ).toBeInTheDocument();
  });

  it("omits the last sale stat when the token never sold", () => {
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

    expect(screen.queryByText("Last sale")).toBeNull();
  });

  it("lists order book rows and masks zero-address makers", () => {
    render(
      <TokenMarketPanel
        collection={requireCollection("random-walk")}
        token={token()}
        activeSellOffer={undefined}
        highestBid={{
          id: "bid",
          collectionId: "random-walk",
          tokenId: 7,
          kind: "buy",
          priceEth: 0.5,
          maker: "0x00000000000000000000000000000000000000AB",
          createdAt: "2026-01-02T00:00:00.000Z",
        }}
        offers={[
          {
            id: "sell",
            collectionId: "random-walk",
            tokenId: 7,
            kind: "sell",
            priceEth: 2,
            maker: "0x0000000000000000000000000000000000000000",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "bid",
            collectionId: "random-walk",
            tokenId: 7,
            kind: "buy",
            priceEth: 0.5,
            maker: "0x00000000000000000000000000000000000000AB",
            createdAt: "2026-01-02T00:00:00.000Z",
          },
        ]}
        usdPerEth={undefined}
      />,
    );

    // The zero-address seller renders as Unknown instead of a broken link.
    expect(screen.getByText("Unknown")).toBeInTheDocument();

    const makerLink = screen.getByRole("link", { name: /0x0000\.\.\.00ab/i });
    expect(makerLink).toHaveAttribute(
      "href",
      "https://arbiscan.io/address/0x00000000000000000000000000000000000000AB",
    );
    expect(screen.getByText(/top bid/i)).toBeInTheDocument();
  });

  it("summarizes marketplace sales in the history header", () => {
    render(
      <TokenHistoryPanel
        token={token()}
        sales={{
          count: 3,
          volumeEth: 2.4,
          lastSale: undefined,
          topSale: undefined,
        }}
      />,
    );

    expect(
      screen.getByText(/3 marketplace sales · 2\.40 ETH lifetime volume/i),
    ).toBeInTheDocument();
  });

  it("omits the sales summary when the token has no marketplace sales", () => {
    render(
      <TokenHistoryPanel
        token={token()}
        sales={{ count: 0, volumeEth: 0 }}
      />,
    );

    expect(screen.queryByText(/marketplace sale/i)).toBeNull();
  });

  it("uses the singular sales label and renders unpriced records", () => {
    render(
      <TokenHistoryPanel
        token={token({
          tokenHistory: [
            {
              kind: "transfer",
              recordType: 0,
              blockNumber: 100,
              timestamp: 1,
              dateTime: "2026-01-01T00:00:00.000Z",
              from: "0x0000000000000000000000000000000000000002",
              to: "0x0000000000000000000000000000000000000003",
            },
          ],
        })}
        sales={{ count: 1, volumeEth: 0.5, lastSale: undefined, topSale: undefined }}
      />,
    );

    expect(
      screen.getByText(/1 marketplace sale · 0\.5000 ETH lifetime volume/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/latest event/i)).toBeInTheDocument();
  });

  it("labels vault-held tokens and hides the video share link without video", () => {
    const collection = requireCollection("cosmic-signature");

    render(
      <TokenCollectorNotesPanel
        collection={collection}
        token={token({
          collectionId: "cosmic-signature",
          anchored: true,
          owner: collection.anchoringWalletAddress,
        })}
        detailHref="https://axiomzero.market/token/cosmic-signature/7"
        imageHref="/art.png"
      />,
    );

    expect(screen.getByText("Anchoring vault")).toBeInTheDocument();
    expect(screen.getByText("Anchored now")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy image link/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy video link/i })).toBeNull();
  });

  it("reports unknown anchor status when no anchor data resolved", () => {
    render(
      <TokenCollectorNotesPanel
        collection={requireCollection("random-walk")}
        token={token()}
        detailHref="https://axiomzero.market/token/random-walk/7"
        imageHref="/art.png"
        videoHref="/art.mp4"
      />,
    );

    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /copy video link/i }),
    ).toBeInTheDocument();
  });
});
