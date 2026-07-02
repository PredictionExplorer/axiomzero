import Link from "next/link";
import { BadgeCheck, Compass, Wallet } from "lucide-react";

import { Reveal } from "@/components/ui/reveal";
import { FAQ_PATH } from "@/lib/marketplace/routes";

const steps = [
  {
    icon: Wallet,
    title: "Connect an Arbitrum wallet",
    copy: "Browse freely without one. When you are ready to trade, connect a wallet such as MetaMask or Rainbow; every action is signed by you and Axiom Zero never holds your assets.",
  },
  {
    icon: Compass,
    title: "Browse live listings and bids",
    copy: "Every price on the site is read straight from verified marketplace contracts, from collection floor prices to the order book on each token page.",
  },
  {
    icon: BadgeCheck,
    title: "Buy, bid, or list with 0% fees",
    copy: "Trades settle on-chain in a single transaction. Sellers receive the full amount and the only cost besides the price is network gas.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="mx-auto max-w-7xl px-5 pt-20 sm:px-8"
    >
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-copper">
              How it works
            </p>
            <h2
              id="how-it-works-heading"
              className="font-display mt-4 text-4xl font-semibold tracking-[-0.05em] text-ivory sm:text-5xl"
            >
              Three steps from browsing to owning
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-bone/70">
            New to NFTs or to Arbitrum?{" "}
            <Link
              href={FAQ_PATH}
              className="font-semibold text-copper transition hover:text-ember"
            >
              The FAQ walks through every step
            </Link>
            , from wallets and gas to cancelling an order.
          </p>
        </div>
      </Reveal>

      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Reveal
              delayMs={index * 80}
              className="h-full rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <step.icon aria-hidden className="text-chartreuse" />
                <span
                  aria-hidden
                  className="font-display text-3xl font-semibold text-ivory/50"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-semibold text-ivory">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-bone/78">{step.copy}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
