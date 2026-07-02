import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { BRAND_NAME } from "@/lib/brand";
import { ALL_FAQ_ITEMS, FAQ_CATEGORIES } from "@/lib/faq";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import {
  collectionPath,
  FAQ_PATH,
  MY_NFTS_PATH,
} from "@/lib/marketplace/routes";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "FAQ",
  description:
    "Answers to common questions about trading on Axiom Zero: connecting a wallet, buying, bidding, listing, 0% fees, verified Arbitrum contracts, and the generative art collections.",
  path: FAQ_PATH,
  keywords: [
    "Axiom Zero FAQ",
    "how to buy NFT on Arbitrum",
    "NFT marketplace fees",
    "list NFT for sale",
    "Random Walk NFT",
    "Cosmic Signature NFT",
    "NFT glossary",
  ],
});

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "FAQ", path: FAQ_PATH },
          ]),
          faqPageJsonLd(ALL_FAQ_ITEMS),
        ]}
      />

      <section className="max-w-3xl">
        <p className="text-sm uppercase tracking-[0.42em] text-copper">
          Help center
        </p>
        <h1 className="font-display mt-5 text-5xl font-semibold tracking-[-0.06em] text-ivory sm:text-7xl">
          Frequently asked questions
        </h1>
        <p className="mt-6 text-lg leading-8 text-bone/70">
          Everything you need to trade confidently on {BRAND_NAME}: wallets,
          buying, bidding, listing, fees, and the art systems behind each
          collection. Every answer applies to a live market with 0% platform
          fees on Arbitrum.
        </p>
      </section>

      <nav aria-label="FAQ categories" className="mt-10">
        <ul className="flex flex-wrap gap-2">
          {FAQ_CATEGORIES.map((category) => (
            <li key={category.id}>
              <a
                href={`#${category.id}`}
                className="inline-block rounded-full border border-ivory/15 px-4 py-2 text-sm text-bone transition hover:border-copper/40 hover:text-ivory"
              >
                {category.title}
              </a>
            </li>
          ))}
          <li>
            <a
              href="#glossary"
              className="inline-block rounded-full border border-ivory/15 px-4 py-2 text-sm text-bone transition hover:border-copper/40 hover:text-ivory"
            >
              Glossary
            </a>
          </li>
        </ul>
      </nav>

      <div className="mt-12 space-y-12">
        {FAQ_CATEGORIES.map((category, categoryIndex) => (
          <section
            key={category.id}
            id={category.id}
            aria-labelledby={`${category.id}-heading`}
            className="scroll-mt-28"
          >
            <Reveal delayMs={categoryIndex * 60}>
              <h2
                id={`${category.id}-heading`}
                className="font-display text-3xl font-semibold tracking-[-0.04em] text-ivory"
              >
                {category.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-bone/70">
                {category.description}
              </p>
            </Reveal>

            <div className="mt-6 grid gap-3">
              {category.items.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-[1.5rem] border border-ivory/10 bg-ivory/[0.045] transition open:border-copper/30"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.5rem] p-5 text-left text-base font-semibold text-ivory transition hover:bg-ivory/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <Plus
                      aria-hidden
                      className="size-4 shrink-0 text-bone/70 transition-transform group-open:rotate-45"
                    />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-7 text-bone/78">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section
        id="glossary"
        aria-labelledby="glossary-heading"
        className="mt-16 scroll-mt-28"
      >
        <Reveal>
          <p className="text-sm uppercase tracking-[0.34em] text-copper">
            Speak the market
          </p>
          <h2
            id="glossary-heading"
            className="font-display mt-4 text-3xl font-semibold tracking-[-0.04em] text-ivory"
          >
            Marketplace glossary
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-bone/70">
            The same definitions power the info icons you see next to stats
            across the site.
          </p>
        </Reveal>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GLOSSARY_TERMS.map((entry) => (
            <div
              key={entry.term}
              className="rounded-[1.5rem] border border-ivory/10 bg-ink/45 p-5"
            >
              <dt className="text-sm font-semibold text-ivory">{entry.term}</dt>
              <dd className="mt-2 text-sm leading-6 text-bone/75">
                {entry.definition}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16 rounded-[2.5rem] border border-copper/20 bg-copper/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-ivory">
              Ready to explore the market?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-bone/75">
              Browse live listings without a wallet, or connect one to buy,
              bid, and list with zero platform fees.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={collectionPath("random-walk")}>
              Explore Random Walk
            </ButtonLink>
            <ButtonLink
              href={collectionPath("cosmic-signature")}
              variant="secondary"
            >
              Explore Cosmic Signature
            </ButtonLink>
            <ButtonLink href={MY_NFTS_PATH} variant="outline">
              Open My NFTs
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
