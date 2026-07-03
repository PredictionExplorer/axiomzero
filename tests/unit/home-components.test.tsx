import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArtSystemsSection } from "@/components/home/art-systems-section";
import { FeaturedArtworksRail } from "@/components/home/featured-artworks-rail";
import { HomeHero } from "@/components/home/home-hero";
import { MarketPulseStrip } from "@/components/home/market-pulse-strip";
import type {
  HomeArtworkItem,
  HomeCollectionPulse,
} from "@/lib/marketplace/home-data";

function artwork(
  overrides: Partial<HomeArtworkItem> = {},
): HomeArtworkItem {
  return {
    collectionId: "random-walk",
    tokenId: 7,
    name: "Random Walk #7",
    artwork: { image: "/art-7.png", alt: "Artwork 7" },
    ...overrides,
  };
}

describe("home components", () => {
  it("renders the hero mosaic with token links", () => {
    render(
      <HomeHero
        artworks={[
          artwork(),
          artwork({
            tokenId: 8,
            name: "Random Walk #8",
            artwork: { image: "/art-8.png", alt: "Artwork 8" },
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: /a fair market for art made from first principles/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Artwork 7")).toBeInTheDocument();
    expect(screen.getByAltText("Artwork 8")).toBeInTheDocument();
  });

  it("falls back to the brand panel when no hero artwork loads", () => {
    render(<HomeHero artworks={[]} />);

    expect(
      screen.getByText(/no founder allocations\. no allowlists\./i),
    ).toBeInTheDocument();
  });

  it("renders market pulse stats with and without offer links", () => {
    const pulses: HomeCollectionPulse[] = [
      {
        collectionId: "random-walk",
        shortName: "Random Walk",
        supply: 4086,
        stats: {
          totalOffers: 3,
          sellListings: 2,
          buyOffers: 1,
          floorOffer: {
            id: "floor",
            collectionId: "random-walk",
            tokenId: 7,
            kind: "sell",
            priceEth: 1.5,
            maker: "0x0000000000000000000000000000000000000002",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          topBidOffer: undefined,
        },
      },
      {
        collectionId: "cosmic-signature",
        shortName: "Cosmic Signature",
        supply: 24,
        stats: {
          totalOffers: 0,
          sellListings: 0,
          buyOffers: 0,
          floorOffer: undefined,
          topBidOffer: undefined,
        },
      },
    ];

    render(<MarketPulseStrip pulses={pulses} />);

    expect(screen.getByText(/random walk market pulse/i)).toBeInTheDocument();
    expect(screen.getByText("1.50 ETH")).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /explore/i })[0],
    ).toHaveAttribute("href", "/random-walk");
    expect(
      screen.getByRole("link", { name: /floor 1\.50 eth/i }),
    ).toHaveAttribute("href", "/token/random-walk/7");
  });

  it("adds sold and volume pulse stats when sales data is available", () => {
    const pulses: HomeCollectionPulse[] = [
      {
        collectionId: "random-walk",
        shortName: "Random Walk",
        supply: 4086,
        stats: {
          totalOffers: 0,
          sellListings: 0,
          buyOffers: 0,
          floorOffer: undefined,
          topBidOffer: undefined,
        },
        sales: { count: 150, volumeEth: 10.5 },
      },
    ];

    render(<MarketPulseStrip pulses={pulses} />);

    expect(screen.getByText("Sold")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByText("10.50 ETH")).toBeInTheDocument();
  });

  it("hides sold and volume pulse stats when the sales scan is unavailable", () => {
    const pulses: HomeCollectionPulse[] = [
      {
        collectionId: "random-walk",
        shortName: "Random Walk",
        supply: 4086,
        stats: {
          totalOffers: 0,
          sellListings: 0,
          buyOffers: 0,
          floorOffer: undefined,
          topBidOffer: undefined,
        },
      },
    ];

    render(<MarketPulseStrip pulses={pulses} />);

    expect(screen.queryByText("Sold")).toBeNull();
    expect(screen.queryByText("Volume")).toBeNull();
  });

  it("explains market pulse jargon with glossary tooltips", () => {
    const pulses: HomeCollectionPulse[] = [
      {
        collectionId: "random-walk",
        shortName: "Random Walk",
        supply: 4086,
        stats: {
          totalOffers: 0,
          sellListings: 0,
          buyOffers: 0,
          floorOffer: undefined,
          topBidOffer: undefined,
        },
      },
    ];

    render(<MarketPulseStrip pulses={pulses} />);

    for (const name of [
      /about floor price/i,
      /about top bid/i,
      /about listing/i,
      /about bid$/i,
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("renders the featured rail and hides it when empty", () => {
    const { container: emptyContainer } = render(
      <FeaturedArtworksRail items={[]} />,
    );
    expect(emptyContainer).toBeEmptyDOMElement();

    render(
      <FeaturedArtworksRail
        items={[
          artwork({ priceEth: 1.5 }),
          artwork({
            tokenId: 9,
            name: "Random Walk #9",
            artwork: { image: "/art-9.png", alt: "Artwork 9" },
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /live works on the market/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("1.50 ETH")).toBeInTheDocument();
    expect(screen.getByText("Unlisted")).toBeInTheDocument();
  });

  it("renders art system panels with showcase backdrops", () => {
    render(
      <ArtSystemsSection
        showcases={[artwork(), undefined]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /^random walk$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^cosmic signature$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /explore market/i }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: /view featured token/i }),
    ).toHaveLength(1);
  });
});
