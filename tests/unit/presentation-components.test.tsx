import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketplaceCard } from "@/components/marketplace/marketplace-card";
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

  it("collapses page numbers around the edges of long paginations", () => {
    render(
      <MarketplacePagination
        collectionId="random-walk"
        search={{ collection: "random-walk", view: "discover", page: 2 }}
        page={2}
        totalPages={12}
      />,
    );
    // Early pages only need a trailing ellipsis.
    expect(screen.getAllByText("...")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "12" })).toBeInTheDocument();

    render(
      <MarketplacePagination
        collectionId="random-walk"
        search={{ collection: "random-walk", view: "discover", page: 11 }}
        page={11}
        totalPages={12}
      />,
    );
    // Late pages only need a leading ellipsis.
    expect(screen.getAllByText("...")).toHaveLength(2);
  });

  it("ignores unpriced and unparseable records but tolerates flat prices", () => {
    render(
      <PriceSparkline
        records={[
          { key: "1", title: "Transfer", subtitle: "Owner", date: "Jan 1" },
          {
            key: "2",
            title: "Sale",
            subtitle: "Buyer",
            date: "Jan 2",
            price: "N/A",
          },
          {
            key: "3",
            title: "Sale",
            subtitle: "Buyer",
            date: "Jan 3",
            price: "1.00 ETH",
          },
          {
            key: "4",
            title: "Sale",
            subtitle: "Buyer",
            date: "Jan 4",
            price: "1.00 ETH",
          },
        ]}
      />,
    );

    // Two equal prices still render a (flat) sparkline.
    expect(
      screen.getByLabelText(/sale price trend sparkline/i),
    ).toBeInTheDocument();
  });

  it("renders marketplace offer cards with artwork, usd, and on-chain maker", () => {
    render(
      <MarketplaceCard
        offer={{
          id: "sell",
          collectionId: "random-walk",
          tokenId: 7,
          kind: "sell",
          priceEth: 2,
          maker: "0x0000000000000000000000000000000000000000",
          createdAt: "1970-01-01T00:00:00.000Z",
          artwork: { image: "/art.png", alt: "Random Walk artwork" },
        }}
        usdPerEth={2000}
      />,
    );

    expect(screen.getByAltText("Random Walk artwork")).toBeInTheDocument();
    expect(screen.getByText(/≈ \$4,000/)).toBeInTheDocument();
    expect(screen.getByText("On-chain")).toBeInTheDocument();
    expect(screen.getByText(/live random walk order/i)).toBeInTheDocument();
    expect(screen.getByText(/sell listing/i)).toBeInTheDocument();
  });

  it("renders buy offer cards with dated orders and shortened makers", () => {
    render(
      <MarketplaceCard
        offer={{
          id: "bid",
          collectionId: "random-walk",
          tokenId: 7,
          kind: "buy",
          priceEth: 0.5,
          maker: "0x00000000000000000000000000000000000000AB",
          createdAt: "2026-01-01T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText(/buy offer/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting artwork/i)).toBeInTheDocument();
    expect(screen.getByText(/0x0000\.\.\.00ab/i)).toBeInTheDocument();
    expect(screen.queryByText(/≈ \$/)).toBeNull();
  });
});
