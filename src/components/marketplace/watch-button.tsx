"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

import type { CollectionId } from "@/lib/marketplace/types";
import {
  WATCHLIST_CHANGE_EVENT,
  isWatched,
  toggleWatch,
} from "@/lib/watchlist";
import { cn } from "@/lib/utils";

/**
 * Wallet-free watch toggle backed by localStorage. Watched tokens surface in
 * the Watchlist section on the My NFTs page.
 */
export function WatchButton({
  collectionId,
  tokenId,
  variant = "icon",
  className,
}: {
  collectionId: CollectionId;
  tokenId: number;
  /** "icon" renders a compact star; "pill" adds a Watch/Watching label. */
  variant?: "icon" | "pill";
  className?: string;
}) {
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    const sync = () => setWatched(isWatched(collectionId, tokenId));

    sync();
    window.addEventListener(WATCHLIST_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(WATCHLIST_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [collectionId, tokenId]);

  const label = watched
    ? `Remove token ${tokenId} from your watchlist`
    : `Add token ${tokenId} to your watchlist`;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={watched}
      title={label}
      onClick={() => setWatched(toggleWatch(collectionId, tokenId))}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full border text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse",
        watched
          ? "border-chartreuse/40 bg-chartreuse/12 text-chartreuse"
          : "border-ivory/15 bg-ivory/[0.05] text-bone/75 hover:border-ivory/30 hover:text-ivory",
        variant === "pill" ? "px-3 py-1.5" : "size-9",
        className,
      )}
    >
      <Star
        aria-hidden
        className="size-4"
        fill={watched ? "currentColor" : "none"}
      />
      {variant === "pill" ? (watched ? "Watching" : "Watch") : null}
    </button>
  );
}
