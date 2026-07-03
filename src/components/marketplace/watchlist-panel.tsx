"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { AnchorStatusPill } from "@/components/marketplace/anchor-status-pill";
import { WatchButton } from "@/components/marketplace/watch-button";
import { TokenCardSkeleton } from "@/components/ui/skeleton";
import type { MarketOffer, MarketToken } from "@/lib/marketplace/types";
import { tokenPath } from "@/lib/marketplace/routes";
import { formatEth, formatTokenId } from "@/lib/utils";
import {
  WATCHLIST_CHANGE_EVENT,
  readWatchlist,
  type WatchlistEntry,
} from "@/lib/watchlist";

const MAX_WATCHLIST_DETAIL = 24;

type WatchedItem = {
  entry: WatchlistEntry;
  token?: MarketToken;
  activeSellOffer?: MarketOffer;
  highestBid?: MarketOffer;
};

function entryKey(entry: WatchlistEntry) {
  return `${entry.collectionId}:${entry.tokenId}`;
}

async function loadWatchedItem(entry: WatchlistEntry): Promise<WatchedItem> {
  try {
    const response = await fetch(
      `/api/marketplace/token/${entry.collectionId}/${entry.tokenId}`,
    );

    if (!response.ok) {
      return { entry };
    }

    const market = (await response.json()) as {
      token: MarketToken;
      offers: MarketOffer[];
    };
    const sellOffers = market.offers
      .filter((offer) => offer.kind === "sell")
      .sort((left, right) => left.priceEth - right.priceEth);
    const buyOffers = market.offers
      .filter((offer) => offer.kind === "buy")
      .sort((left, right) => right.priceEth - left.priceEth);

    return {
      entry,
      token: market.token,
      activeSellOffer: sellOffers[0],
      highestBid: buyOffers[0],
    };
  } catch {
    return { entry };
  }
}

/**
 * Wallet-free watchlist: tokens starred anywhere on the site, hydrated with
 * live market data. Stored only in this browser's localStorage.
 */
export function WatchlistPanel() {
  const [entries, setEntries] = useState<WatchlistEntry[]>();
  const [loaded, setLoaded] = useState<{ key: string; items: WatchedItem[] }>();

  useEffect(() => {
    const sync = () => setEntries(readWatchlist());
    const timer = window.setTimeout(sync, 0);

    window.addEventListener(WATCHLIST_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(WATCHLIST_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!entries?.length) {
      return;
    }

    let isCurrent = true;
    const visible = entries.slice(0, MAX_WATCHLIST_DETAIL);

    void Promise.all(visible.map(loadWatchedItem)).then((items) => {
      if (isCurrent) {
        setLoaded({ key: visible.map(entryKey).join("|"), items });
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [entries]);

  if (entries === undefined) {
    return null;
  }

  const entriesKey = entries
    .slice(0, MAX_WATCHLIST_DETAIL)
    .map(entryKey)
    .join("|");
  const isLoading = Boolean(entries.length) && loaded?.key !== entriesKey;
  const items = !entries.length || isLoading ? [] : (loaded?.items ?? []);

  return (
    <section className="rounded-[2.5rem] border border-ivory/10 bg-ivory/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.22)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-copper">
            No wallet needed
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ivory">
            Your watchlist
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-bone/78">
            Tokens you starred while browsing, with live listings and bids.
            The list lives only in this browser — no wallet or account
            required.
          </p>
        </div>
        <p className="rounded-full border border-ivory/15 px-3 py-1 text-xs uppercase tracking-[0.24em] text-bone/75">
          {entries.length} watched
        </p>
      </div>

      {!entries.length ? (
        <div className="mt-6 rounded-[2rem] border border-ivory/10 bg-ink/38 p-8 text-center">
          <h3 className="font-display text-xl font-semibold text-ivory">
            Nothing watched yet
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-bone/75">
            Tap the star on any token card or detail page to track it here.
            Handy for stalking deals on never-anchored tokens.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/random-walk"
              className="inline-flex h-11 items-center justify-center rounded-full bg-copper px-5 text-sm font-semibold text-ink transition hover:bg-ember"
            >
              Browse Random Walk
            </Link>
            <Link
              href="/cosmic-signature"
              className="inline-flex h-11 items-center justify-center rounded-full border border-ivory/15 bg-ivory/[0.04] px-5 text-sm font-semibold text-ivory transition hover:bg-ivory/[0.09]"
            >
              Browse Cosmic Signature
            </Link>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from(
            { length: Math.min(entries.length, 3) },
            (_, index) => (
              <TokenCardSkeleton key={`watch-skeleton-${index}`} />
            ),
          )}
        </div>
      ) : null}

      {!isLoading && items.length ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={entryKey(item.entry)}
              className="overflow-hidden rounded-[2rem] border border-ivory/10 bg-ink/38"
            >
              <Link
                href={tokenPath(item.entry.collectionId, item.entry.tokenId)}
                className="relative block aspect-square bg-carbon"
              >
                {item.token ? (
                  <Image
                    src={item.token.artwork.image}
                    alt={item.token.artwork.alt}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                    className="object-contain p-4"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-bone/70">
                    Market data unavailable
                  </div>
                )}
                <AnchorStatusPill
                  anchored={item.token?.anchored}
                  className="absolute right-4 top-4"
                />
              </Link>

              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-copper">
                      {item.entry.collectionId === "random-walk"
                        ? "Random Walk"
                        : "Cosmic Signature"}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-ivory">
                      {formatTokenId(item.entry.tokenId)}
                    </h3>
                  </div>
                  <WatchButton
                    collectionId={item.entry.collectionId}
                    tokenId={item.entry.tokenId}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-ivory/[0.045] p-3">
                    <p className="text-bone/75">Listing</p>
                    <p className="mt-1 font-semibold text-chartreuse">
                      {item.activeSellOffer
                        ? formatEth(item.activeSellOffer.priceEth)
                        : "Unlisted"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-ivory/[0.045] p-3">
                    <p className="text-bone/75">Highest bid</p>
                    <p className="mt-1 font-semibold text-ivory">
                      {item.highestBid
                        ? formatEth(item.highestBid.priceEth)
                        : "None"}
                    </p>
                  </div>
                </div>

                <Link
                  href={tokenPath(item.entry.collectionId, item.entry.tokenId)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-ivory/15 bg-ivory/[0.04] px-5 text-sm font-semibold text-ivory transition hover:bg-ivory/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse"
                >
                  View token
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
