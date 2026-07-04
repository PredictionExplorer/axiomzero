import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/marketplace/collection-market-page", () => ({
  CollectionMarketPage: ({ collectionId }: { collectionId: string }) => (
    <div data-testid="collection-market-page">{collectionId}</div>
  ),
}));

vi.mock("@/components/marketplace/my-nfts-panel", () => ({
  MyNftsPanel: () => <div data-testid="my-nfts-panel" />,
}));

vi.mock("@/components/marketplace/watchlist-panel", () => ({
  WatchlistPanel: () => <div data-testid="watchlist-panel" />,
}));

import RandomWalkPage, {
  metadata as randomWalkMetadata,
} from "@/app/random-walk/page";
import CosmicSignaturePage, {
  metadata as cosmicSignatureMetadata,
} from "@/app/cosmic-signature/page";
import MyNftsPage, { metadata as myNftsMetadata } from "@/app/my-nfts/page";
import { SITE_URL } from "@/lib/seo/metadata";

describe("collection pages", () => {
  it("renders the Random Walk market with page metadata", () => {
    render(<RandomWalkPage searchParams={Promise.resolve({})} />);

    expect(screen.getByTestId("collection-market-page")).toHaveTextContent(
      "random-walk",
    );
    expect(randomWalkMetadata.title).toBe("Random Walk");
    expect(randomWalkMetadata.alternates?.canonical).toBe(
      `${SITE_URL}/random-walk`,
    );
  });

  it("renders the Cosmic Signature market with page metadata", () => {
    render(<CosmicSignaturePage searchParams={Promise.resolve({})} />);

    expect(screen.getByTestId("collection-market-page")).toHaveTextContent(
      "cosmic-signature",
    );
    expect(cosmicSignatureMetadata.title).toBe("Cosmic Signature");
    expect(cosmicSignatureMetadata.alternates?.canonical).toBe(
      `${SITE_URL}/cosmic-signature`,
    );
  });
});

describe("MyNftsPage", () => {
  it("hosts the wallet scanner and watchlist panels", () => {
    render(<MyNftsPage />);

    expect(
      screen.getByRole("heading", { name: /^my nfts$/i }),
    ).toBeVisible();
    expect(screen.getByTestId("my-nfts-panel")).toBeInTheDocument();
    expect(screen.getByTestId("watchlist-panel")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /faq explains setup/i }),
    ).toHaveAttribute("href", "/faq");
    expect(myNftsMetadata.title).toBe("My NFTs");
  });
});
