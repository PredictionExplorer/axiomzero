import type { Metadata } from "next";
import Link from "next/link";

import { collections } from "@/config/collections";
import { MyNftsPanel } from "@/components/marketplace/my-nfts-panel";
import { WatchlistPanel } from "@/components/marketplace/watchlist-panel";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { FAQ_PATH, MY_NFTS_PATH } from "@/lib/marketplace/routes";

export const metadata: Metadata = buildPageMetadata({
  title: "My NFTs",
  description:
    "Connect a wallet to view, list, and manage bids for your Random Walk and Cosmic Signature NFTs.",
  path: MY_NFTS_PATH,
});

export default function MyNftsPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <section className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.42em] text-copper">
            Wallet workspace
          </p>
          <h1 className="font-display mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-ivory sm:text-7xl">
            My NFTs
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-bone/70">
            Connect your wallet to scan owned Random Walk and Cosmic Signature
            NFTs, review bids, and manage listings from one focused page.
          </p>
        </div>

        <div className="rounded-[2rem] border border-copper/20 bg-copper/10 p-5">
          <p className="text-xs uppercase tracking-[0.26em] text-copper">
            Owner tools
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ivory">
            Your listings and bid alerts live here.
          </p>
          <p className="mt-3 text-sm leading-6 text-bone/78">
            New to wallets, gas, or Arbitrum?{" "}
            <Link
              href={FAQ_PATH}
              className="font-semibold text-copper transition hover:text-ember"
            >
              The FAQ explains setup and every trading step
            </Link>
            .
          </p>
        </div>
      </section>

      <div className="mt-10">
        <MyNftsPanel collections={collections} />
      </div>

      <div className="mt-10">
        <WatchlistPanel />
      </div>
    </div>
  );
}
