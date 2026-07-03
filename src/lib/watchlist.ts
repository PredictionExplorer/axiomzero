import type { CollectionId } from "@/lib/marketplace/types";

/**
 * Wallet-free watchlist stored in localStorage so anyone can track tokens
 * while browsing. Components stay in sync through a window event that fires
 * on every change (plus the native storage event for other tabs).
 */

export type WatchlistEntry = {
  collectionId: CollectionId;
  tokenId: number;
  addedAt: string;
};

export const WATCHLIST_STORAGE_KEY = "axiomzero.watchlist.v1";
export const WATCHLIST_CHANGE_EVENT = "axiomzero:watchlist-change";
const MAX_WATCHLIST_ENTRIES = 100;

function isWatchlistEntry(value: unknown): value is WatchlistEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Partial<WatchlistEntry>;

  return (
    (entry.collectionId === "random-walk" ||
      entry.collectionId === "cosmic-signature") &&
    typeof entry.tokenId === "number" &&
    Number.isInteger(entry.tokenId) &&
    typeof entry.addedAt === "string"
  );
}

export function readWatchlist(): WatchlistEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isWatchlistEntry);
  } catch {
    return [];
  }
}

function writeWatchlist(entries: WatchlistEntry[]) {
  try {
    window.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_WATCHLIST_ENTRIES)),
    );
    window.dispatchEvent(new Event(WATCHLIST_CHANGE_EVENT));
  } catch {
    // Storage can be unavailable (private mode, quota); watching is optional.
  }
}

export function isWatched(collectionId: CollectionId, tokenId: number) {
  return readWatchlist().some(
    (entry) => entry.collectionId === collectionId && entry.tokenId === tokenId,
  );
}

/**
 * Adds or removes a token from the watchlist. Returns true when the token is
 * watched after the toggle.
 */
export function toggleWatch(collectionId: CollectionId, tokenId: number) {
  const entries = readWatchlist();
  const existingIndex = entries.findIndex(
    (entry) => entry.collectionId === collectionId && entry.tokenId === tokenId,
  );

  if (existingIndex >= 0) {
    entries.splice(existingIndex, 1);
    writeWatchlist(entries);
    return false;
  }

  writeWatchlist([
    { collectionId, tokenId, addedAt: new Date().toISOString() },
    ...entries,
  ]);

  return true;
}
