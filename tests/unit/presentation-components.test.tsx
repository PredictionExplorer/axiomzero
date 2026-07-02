import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketplacePagination } from "@/components/marketplace/marketplace-pagination";
import { MarketplaceTokenCard } from "@/components/marketplace/marketplace-token-card";
import { PriceSparkline } from "@/components/marketplace/price-sparkline";
import { Reveal } from "@/components/ui/reveal";
import { TokenCardSkeleton } from "@/components/ui/skeleton";
import type { TokenMarketSummary } from "@/lib/marketplace/types";

const item = {
  token: {
    collectionId: "random-walk",
    tokenId: 7,
    name: "Random Walk #000007",
    owner: "0x0000000000000000000000000000000000000001",
    seed: "seed",
    traits: [],
    artwork: { image: "/art.png", alt: "Artwork" },
    rating: 8.5,
    mintedAt: "2026-01-01T00:00:00.000Z",
  },
  activeSellOffer: {
    id: "sell",
    collectionId: "random-walk",
    tokenId: 7,
    kind: "sell",
    priceEth: 1.5,
    maker: "0x0000000000000000000000000000000000000002",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  highestBid: {
    id: "bid",
    collectionId: "random-walk",
    tokenId: 7,
    kind: "buy",
    priceEth: 1,
    maker: "0x0000000000000000000000000000000000000003",
    createdAt: "2026-01-02T00:00:00.000Z",
  },
  offers: [],
} satisfies TokenMarketSummary;

describe("ui and marketplace presentation components", () => {
  it("renders skeleton and reveal wrappers", () => {
    render(
      <>
        <TokenCardSkeleton />
        <Reveal>
          <p>Visible content</p>
        </Reveal>
      </>,
    );

    expect(screen.getByText("Visible content")).toBeInTheDocument();
  });

  it("renders token cards and pagination", () => {
    render(
      <>
        <MarketplaceTokenCard item={item} />
        <MarketplacePagination
          collectionId="random-walk"
          search={{ collection: "random-walk", view: "discover", page: 2 }}
          page={2}
          totalPages={5}
        />
      </>,
    );

    expect(screen.getByText("Beauty 8.5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute(
      "href",
      expect.stringContaining("page=3"),
    );
    render(
      <MarketplacePagination
        collectionId="random-walk"
        search={{ collection: "random-walk", view: "discover", page: 5 }}
        page={5}
        totalPages={12}
      />,
    );
    expect(screen.getAllByText("...").length).toBeGreaterThan(0);
  });

  it("skips sparkline rendering without enough sale points", () => {
    const { container } = render(
      <PriceSparkline
        records={[
          {
            key: "1",
            title: "Sale",
            subtitle: "Buyer",
            date: "Jan 1",
            price: "1.00 ETH",
          },
        ]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a price sparkline when enough sale records exist", () => {
    render(
      <PriceSparkline
        records={[
          {
            key: "1",
            title: "Sale",
            subtitle: "Buyer",
            date: "Jan 1",
            price: "1.00 ETH",
          },
          {
            key: "2",
            title: "Sale",
            subtitle: "Buyer",
            date: "Jan 2",
            price: "2.00 ETH",
          },
        ]}
      />,
    );

    expect(screen.getByLabelText(/sale price trend sparkline/i)).toBeInTheDocument();
  });
});
