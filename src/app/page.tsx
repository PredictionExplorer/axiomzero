import { ArrowUpRight, Equal, Percent, Sparkles } from "lucide-react";

import { collections } from "@/config/collections";
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  FOUNDATION_STATEMENT,
  ZERO_PROMISES,
} from "@/lib/brand";
import { ButtonLink } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="overflow-hidden">
      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.04fr_0.96fr] lg:py-28">
        <div className="flex flex-col justify-center">
          <p className="text-sm uppercase tracking-[0.42em] text-copper">
            {BRAND_NAME}
          </p>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-ivory sm:text-7xl lg:text-8xl">
            A fair market for art made from first principles.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-bone/74">
            {BRAND_TAGLINE} Browse Random Walk and Cosmic Signature NFTs in a
            0% fee marketplace built for fair-launch generative art.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/marketplace">Enter marketplace</ButtonLink>
            <ButtonLink href="#collections" variant="secondary">
              View collections
            </ButtonLink>
          </div>
        </div>

        <div className="relative min-h-[520px] rounded-[2.5rem] border border-ivory/10 bg-ivory/[0.04] p-5 shadow-[0_40px_140px_rgba(0,0,0,0.34)]">
          <div className="absolute inset-5 rounded-[2rem] border border-copper/20" />
          <div className="relative grid h-full place-items-center overflow-hidden rounded-[2rem] bg-carbon">
            <div className="absolute h-[38rem] w-[38rem] rounded-full border border-copper/40" />
            <div className="absolute h-[28rem] w-[28rem] rotate-45 rounded-full border border-chartreuse/30" />
            <div className="absolute h-[18rem] w-[18rem] -rotate-12 rounded-full border border-ivory/20" />
            <div className="absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-copper to-transparent" />
            <div className="relative max-w-sm rounded-[2rem] border border-ivory/10 bg-ink/82 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.28em] text-chartreuse">
                zero means zero
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-ivory">
                No founder allocations. No allowlists. No insider lane.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="collections"
        className="mx-auto grid max-w-7xl gap-4 px-5 pb-20 sm:px-8 lg:grid-cols-2"
      >
        {collections.map((collection) => (
          <a
            key={collection.id}
            href={`/marketplace?collection=${collection.id}`}
            className="group rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-6 transition hover:-translate-y-1 hover:border-copper/35 hover:bg-ivory/[0.07]"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-copper">
                  {collection.supplyLabel}
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ivory">
                  {collection.shortName}
                </h2>
              </div>
              <ArrowUpRight className="text-bone/75 transition group-hover:text-chartreuse" />
            </div>
            <p className="mt-5 max-w-xl leading-7 text-bone/78">
              {collection.description}
            </p>
            <p className="mt-5 font-mono text-sm text-bone/75">
              {collection.artSystem}
            </p>
          </a>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="rounded-[2.5rem] border border-copper/20 bg-copper/10 p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm uppercase tracking-[0.34em] text-copper">
                Zero means zero
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-ivory sm:text-5xl">
                Founders get no special privilege.
              </h2>
              <p className="mt-5 max-w-xl leading-7 text-bone/78">
                Axiom Zero exists for collections with fair-launch energy:
                equal market access, transparent rules, and no reserved founder
                advantage.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ZERO_PROMISES.map((promise) => (
                <div
                  key={promise.label}
                  className="rounded-[1.5rem] border border-ivory/10 bg-ink/55 p-4"
                >
                  <p className="font-semibold text-ivory">{promise.label}</p>
                  <p className="mt-2 text-sm leading-6 text-bone/78">
                    {promise.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-24 sm:px-8 md:grid-cols-3">
        {[
          [Sparkles, "Math, code, algorithms", FOUNDATION_STATEMENT],
          [Equal, "Fair launch, no founder privilege", "No reserved founder mints, no insider allocations, and no creator advantage."],
          [Percent, "0% marketplace fees", "Axiom Zero adds no platform fee to the trade."],
        ].map(([Icon, title, copy]) => {
          const TypedIcon = Icon as typeof Sparkles;

          return (
            <div key={title as string} className="rounded-[2rem] border border-ivory/10 bg-carbon p-6">
              <TypedIcon className="text-chartreuse" />
              <h3 className="mt-5 text-xl font-semibold text-ivory">
                {title as string}
              </h3>
              <p className="mt-3 text-sm leading-6 text-bone/78">
                {copy as string}
              </p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
