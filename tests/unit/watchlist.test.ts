import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  WATCHLIST_CHANGE_EVENT,
  WATCHLIST_STORAGE_KEY,
  isWatched,
  readWatchlist,
  toggleWatch,
} from "@/lib/watchlist";

describe("watchlist storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty and survives corrupted storage payloads", () => {
    expect(readWatchlist()).toEqual([]);

    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, "{not json");
    expect(readWatchlist()).toEqual([]);

    window.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify([
        { collectionId: "random-walk", tokenId: 7, addedAt: "2026-01-01" },
        { collectionId: "unknown", tokenId: 1, addedAt: "2026-01-01" },
        { collectionId: "cosmic-signature", tokenId: "9" },
      ]),
    );
    expect(readWatchlist()).toEqual([
      { collectionId: "random-walk", tokenId: 7, addedAt: "2026-01-01" },
    ]);
  });

  it("drops entries that are not objects and payloads that are not arrays", () => {
    window.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify([
        null,
        "starred",
        42,
        { collectionId: "random-walk", tokenId: 7, addedAt: "2026-01-01" },
      ]),
    );
    expect(readWatchlist()).toEqual([
      { collectionId: "random-walk", tokenId: 7, addedAt: "2026-01-01" },
    ]);

    window.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify({ collectionId: "random-walk" }),
    );
    expect(readWatchlist()).toEqual([]);
  });

  it("toggles tokens on and off with newest first", () => {
    expect(toggleWatch("random-walk", 7)).toBe(true);
    expect(toggleWatch("cosmic-signature", 3)).toBe(true);

    expect(isWatched("random-walk", 7)).toBe(true);
    expect(readWatchlist().map((entry) => entry.tokenId)).toEqual([3, 7]);

    expect(toggleWatch("random-walk", 7)).toBe(false);
    expect(isWatched("random-walk", 7)).toBe(false);
    expect(readWatchlist().map((entry) => entry.tokenId)).toEqual([3]);
  });

  it("announces every change through a window event", () => {
    const listener = vi.fn();
    window.addEventListener(WATCHLIST_CHANGE_EVENT, listener);

    toggleWatch("random-walk", 7);
    toggleWatch("random-walk", 7);

    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(WATCHLIST_CHANGE_EVENT, listener);
  });
});
