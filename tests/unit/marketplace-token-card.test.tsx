import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketplaceTokenCard } from "@/components/marketplace/marketplace-token-card";
import type { TokenMarketSummary } from "@/lib/marketplace/types";

function summary(
  overrides: Partial<TokenMarketSummary["token"]> = {},
  market: Partial<Omit<TokenMarketSummary, "token">> = {},
): TokenMarketSummary {
  return {
    token: {
      collectionId: "random-walk",
      tokenId: 7,
      name: "Random Walk #000007",
      owner: "0x0000000000000000000000000000000000000001",
      seed: "seed",
      traits: [],
      artwork: { image: "/token.png", alt: "Token artwork" },
      ...overrides,
    },
    offers: [],
    ...market,
  };
}

const listing = {
  id: "sell-7",
  offerId: 1,
  collectionId: "random-walk" as const,
  tokenId: 7,
  kind: "sell" as const,
  priceEth: 1.15,
  maker: "0x0000000000000000000000000000000000000001" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("MarketplaceTokenCard", () => {
  it("labels never-anchored tokens and offers a watch toggle", () => {
    render(<MarketplaceTokenCard item={summary({ anchored: false })} />);

    expect(screen.getByText("Never anchored")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add token 7 to your watchlist/i }),
    ).toBeInTheDocument();
  });

  it("marks tokens whose anchor has been used", () => {
    render(<MarketplaceTokenCard item={summary({ anchored: true })} />);

    expect(screen.getByText("Anchor used")).toBeInTheDocument();
  });

  it("marks tokens currently held by the anchoring vault", () => {
    render(
      <MarketplaceTokenCard
        item={summary({
          anchored: true,
          owner: "0x5EB3396092841E6c5b0b51141699F6711E830529",
        })}
      />,
    );

    expect(screen.getByText("Anchored now")).toBeInTheDocument();
  });

  it("omits the anchor pill when the status is unknown", () => {
    render(<MarketplaceTokenCard item={summary()} />);

    expect(screen.queryByText(/anchor/i)).toBeNull();
  });

  it("shows USD context and the floor delta for listed tokens", () => {
    render(
      <MarketplaceTokenCard
        item={summary({}, { activeSellOffer: listing, offers: [listing] })}
        usdPerEth={2000}
        floorPriceEth={1}
      />,
    );

    expect(screen.getByText(/≈ \$2,300 · \+15% vs floor/i)).toBeInTheDocument();
  });

  it("celebrates listings sitting exactly at the floor", () => {
    render(
      <MarketplaceTokenCard
        item={summary({}, { activeSellOffer: listing, offers: [listing] })}
        floorPriceEth={1.15}
      />,
    );

    expect(screen.getByText("At floor")).toBeInTheDocument();
  });
});
