import Link from "next/link";

import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { BRAND_NAME } from "@/lib/brand";

const navItems = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/marketplace?view=my-nfts", label: "My NFTs" },
  {
    href: "/marketplace?view=listings&collection=random-walk&sort=price-asc",
    label: "Random Walk",
  },
  {
    href: "/marketplace?view=listings&collection=cosmic-signature&sort=price-asc",
    label: "Cosmic Signature",
  },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ivory/10 bg-ink/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full border border-copper/60 bg-copper/10 text-sm font-semibold text-copper shadow-[0_0_60px_rgba(216,121,50,0.24)]">
            AZ
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-semibold tracking-[0.28em] text-ivory">
              {BRAND_NAME}
            </span>
            <span className="mt-1 text-[0.64rem] uppercase tracking-[0.36em] text-bone/75">
              zero privilege market
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-ivory/10 bg-ivory/[0.035] p-1 lg:flex">
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

        <ConnectWalletButton />
      </div>
    </header>
  );
}
