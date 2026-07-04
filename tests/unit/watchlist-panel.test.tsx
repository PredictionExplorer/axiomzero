import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WatchlistPanel } from "@/components/marketplace/watchlist-panel";
import {
  WATCHLIST_CHANGE_EVENT,
  WATCHLIST_STORAGE_KEY,
  type WatchlistEntry,
} from "@/lib/watchlist";

function seedWatchlist(entries: WatchlistEntry[]) {
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
}

function entry(
  tokenId: number,
  collectionId: WatchlistEntry["collectionId"] = "random-walk",
) {
  return {
    collectionId,
    tokenId,
    addedAt: "2026-01-01T00:00:00.000Z",
  } satisfies WatchlistEntry;
}

function marketResponse(tokenId: number) {
  return new Response(
    JSON.stringify({
      token: {
        collectionId: "random-walk",
        tokenId,
        name: `Random Walk #${tokenId}`,
        owner: "0x0000000000000000000000000000000000000001",
        seed: "seed",
        traits: [],
        anchored: false,
        artwork: { image: "/art.png", alt: "Token artwork" },
      },
      offers: [
        {
          id: "listing",
          offerId: 1,
          collectionId: "random-walk",
          tokenId,
          kind: "sell",
          priceEth: 2,
          maker: "0x0000000000000000000000000000000000000001",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "cheap-listing",
          offerId: 2,
          collectionId: "random-walk",
          tokenId,
          kind: "sell",
          priceEth: 1.5,
          maker: "0x0000000000000000000000000000000000000002",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "low-bid",
          offerId: 3,
          collectionId: "random-walk",
          tokenId,
          kind: "buy",
          priceEth: 0.25,
          maker: "0x0000000000000000000000000000000000000003",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "high-bid",
          offerId: 4,
          collectionId: "random-walk",
          tokenId,
          kind: "buy",
          priceEth: 0.75,
          maker: "0x0000000000000000000000000000000000000004",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  );
}

describe("WatchlistPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the empty state when nothing is watched", async () => {
    render(<WatchlistPanel />);

    expect(await screen.findByText(/nothing watched yet/i)).toBeVisible();
    expect(screen.getByText(/0 watched/i)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /browse random walk/i }),
    ).toHaveAttribute("href", "/random-walk");
    expect(
      screen.getByRole("link", { name: /browse cosmic signature/i }),
    ).toHaveAttribute("href", "/cosmic-signature");
  });

  it("hydrates watched tokens with live listing and bid data", async () => {
    seedWatchlist([entry(7)]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => marketResponse(7)),
    );

    render(<WatchlistPanel />);

    expect(await screen.findByText(/1 watched/i)).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: /#000007/i }),
    ).toBeVisible();
    // Cheapest listing and highest bid win.
    expect(screen.getByText(/1\.50 eth/i)).toBeVisible();
    expect(screen.getByText(/0\.7500 eth/i)).toBeVisible();
    expect(fetch).toHaveBeenCalledWith("/api/marketplace/token/random-walk/7");
  });

  it("falls back to a market-data-unavailable card when the API fails", async () => {
    seedWatchlist([entry(8), entry(9, "cosmic-signature")]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).endsWith("/8")) {
          return new Response("", { status: 502 });
        }
        throw new Error("network down");
      }),
    );

    render(<WatchlistPanel />);

    expect(await screen.findByText(/2 watched/i)).toBeVisible();
    await waitFor(() => {
      expect(screen.getAllByText(/market data unavailable/i)).toHaveLength(2);
    });
    expect(screen.getAllByText(/unlisted/i)).toHaveLength(2);
    expect(screen.getAllByText(/^none$/i)).toHaveLength(2);
    expect(screen.getByText("Random Walk")).toBeVisible();
    expect(screen.getByText("Cosmic Signature")).toBeVisible();
  });

  it("re-syncs when the watchlist changes elsewhere on the page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => marketResponse(11)),
    );

    render(<WatchlistPanel />);

    expect(await screen.findByText(/nothing watched yet/i)).toBeVisible();

    seedWatchlist([entry(11)]);
    window.dispatchEvent(new Event(WATCHLIST_CHANGE_EVENT));

    expect(
      await screen.findByRole("heading", { name: /#000011/i }),
    ).toBeVisible();
    expect(screen.queryByText(/nothing watched yet/i)).not.toBeInTheDocument();
  });

  it("only hydrates the first 24 entries of large watchlists", async () => {
    seedWatchlist(
      Array.from({ length: 30 }, (_, index) => entry(index + 1)),
    );
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<WatchlistPanel />);

    expect(await screen.findByText(/30 watched/i)).toBeVisible();
    await waitFor(() => {
      expect(screen.getAllByText(/market data unavailable/i)).toHaveLength(24);
    });
    expect(fetchMock).toHaveBeenCalledTimes(24);
  });
});
