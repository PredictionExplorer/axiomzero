"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { BRAND_NAME } from "@/lib/brand";
import { collectionPath, MY_NFTS_PATH } from "@/lib/marketplace/routes";
import { cn } from "@/lib/utils";

const navItems = [
  { href: MY_NFTS_PATH, label: "My NFTs" },
  { href: collectionPath("random-walk"), label: "Random Walk" },
  { href: collectionPath("cosmic-signature"), label: "Cosmic Signature" },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-ivory/10 bg-ink/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full border border-copper bg-copper text-sm font-semibold text-ink shadow-[0_0_60px_rgba(216,121,50,0.24)]">
            AZ
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-semibold tracking-[0.28em] text-ivory">
              {BRAND_NAME}
            </span>
            <span className="mt-1 text-[0.64rem] uppercase tracking-[0.36em] text-bone">
              zero privilege market
            </span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 rounded-full border border-ivory/10 bg-ivory/[0.035] p-1 lg:flex"
          aria-label="Primary"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm text-bone/70 transition hover:bg-ivory/10 hover:text-ivory"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ConnectWalletButton />
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full border border-ivory/15 bg-ivory/[0.04] text-ivory transition hover:bg-ivory/[0.09] lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* The blurred header is this panel's containing block, so it is
          anchored below the header with absolute positioning instead of
          viewport-fixed coordinates. */}
      <div
        id="mobile-nav"
        className={cn(
          "absolute inset-x-0 top-full z-30 h-screen bg-ink transition lg:hidden",
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <nav className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 sm:px-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-ivory/10 bg-ivory/[0.04] px-5 py-4 text-lg font-semibold text-ivory transition hover:border-copper/35 hover:bg-ivory/[0.08]"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
