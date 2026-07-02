import Link from "next/link";

import { collections } from "@/config/collections";
import { BRAND_NAME, BRAND_PRINCIPLES, FOUNDATION_STATEMENT } from "@/lib/brand";
import {
  collectionPath,
  FAQ_PATH,
  MY_NFTS_PATH,
} from "@/lib/marketplace/routes";
import { shortenAddress } from "@/lib/utils";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: MY_NFTS_PATH, label: "My NFTs" },
  ...collections.map((collection) => ({
    href: collectionPath(collection.id),
    label: collection.shortName,
  })),
  { href: FAQ_PATH, label: "FAQ" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ivory/10 bg-carbon px-5 py-12 text-bone/78 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.2fr_0.8fr_1fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.34em] text-copper">
            {BRAND_NAME}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6">
            {FOUNDATION_STATEMENT} No marketplace fees, no allowlists, no
            insider allocations, and no founder privilege.
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-bone/65">
            Navigate
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition hover:text-ivory"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-bone/65">
            Verified contracts
          </p>
          <ul className="mt-4 space-y-4 text-sm">
            {collections.map((collection) => (
              <li key={collection.id}>
                <p className="font-semibold text-ivory">{collection.shortName}</p>
                <p className="mt-1 font-mono text-xs text-bone/70">
                  NFT{" "}
                  <a
                    href={`https://arbiscan.io/address/${collection.nftAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-copper transition hover:text-ember"
                  >
                    {shortenAddress(collection.nftAddress, 6)}
                  </a>
                </p>
                <p className="mt-1 font-mono text-xs text-bone/70">
                  Market{" "}
                  <a
                    href={`https://arbiscan.io/address/${collection.marketplaceAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-copper transition hover:text-ember"
                  >
                    {shortenAddress(collection.marketplaceAddress, 6)}
                  </a>
                </p>
                <a
                  href={collection.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-copper transition hover:text-ember"
                >
                  Visit {collection.shortName} site
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="mx-auto mt-10 grid max-w-7xl gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {BRAND_PRINCIPLES.map((principle) => (
          <li
            key={principle}
            className="rounded-full border border-ivory/10 px-4 py-2"
          >
            {principle}
          </li>
        ))}
      </ul>
    </footer>
  );
}
