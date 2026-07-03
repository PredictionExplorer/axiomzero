import type { ReactNode } from "react";

import type {
  Collection,
  MarketOffer,
  MarketSale,
  MarketToken,
  SalesSummary,
} from "@/lib/marketplace/types";
import { anchorStatusLabel } from "@/components/marketplace/anchor-status-pill";
import { PriceSparkline } from "@/components/marketplace/price-sparkline";
import { TokenActions } from "@/components/marketplace/token-actions";
import { TokenShareActions } from "@/components/marketplace/token-share-actions";
import { ButtonLink } from "@/components/ui/button";
import { GlossaryTip } from "@/components/ui/tooltip";
import type { GlossaryKey } from "@/lib/glossary";
import {
  formatFullDate,
  formatHistoryRecords,
  primaryTokenTrait,
  sortOffersForDisplay,
  visibleTokenTraits,
} from "@/lib/marketplace/token-detail";
import { formatEthWithUsd } from "@/lib/pricing/eth-usd";
import { sameAddress } from "@/lib/marketplace/trading-actions";
import {
  formatDate,
  formatEth,
  formatRelativeTime,
  shortenAddress,
} from "@/lib/utils";

function arbiscanAddressUrl(address: string) {
  return `https://arbiscan.io/address/${address}`;
}

function PriceLabel({
  eth,
  usdPerEth,
  className = "text-ivory",
}: {
  eth: number;
  usdPerEth?: number;
  className?: string;
}) {
  const usd = formatEthWithUsd(eth, usdPerEth);

  return (
    <div>
      <p className={`font-display text-3xl font-semibold tracking-[-0.04em] ${className}`}>
        {formatEth(eth)}
      </p>
      {usd ? <p className="mt-1 text-sm text-bone/70">≈ {usd}</p> : null}
    </div>
  );
}

export function TokenMarketPanel({
  collection,
  token,
  activeSellOffer,
  highestBid,
  offers,
  usdPerEth,
  lastSale,
}: {
  collection: Collection;
  token: MarketToken;
  activeSellOffer?: MarketOffer;
  highestBid?: MarketOffer;
  offers: MarketOffer[];
  usdPerEth?: number;
  lastSale?: MarketSale;
}) {
  const sellOffers = sortOffersForDisplay(offers, "sell");
  const buyOffers = sortOffersForDisplay(offers, "buy");
  const lastSaleAgo = lastSale?.soldAt
    ? formatRelativeTime(lastSale.soldAt)
    : undefined;

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
          <p className="text-sm uppercase tracking-[0.28em] text-copper">
            Live market
          </p>
          <div className="mt-3">
            {activeSellOffer ? (
              <PriceLabel eth={activeSellOffer.priceEth} usdPerEth={usdPerEth} />
            ) : (
              <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-ivory">
                Unlisted
              </h2>
            )}
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <MarketStat
              label="Best listing"
              termKey="listing"
              value={
                activeSellOffer ? formatEth(activeSellOffer.priceEth) : "None"
              }
            />
            <MarketStat
              label="Highest bid"
              termKey="topBid"
              value={highestBid ? formatEth(highestBid.priceEth) : "No bids"}
            />
            {lastSale ? (
              <MarketStat
                label="Last sale"
                termKey="lastSale"
                value={
                  lastSaleAgo
                    ? `${formatEth(lastSale.priceEth)} · ${lastSaleAgo}`
                    : formatEth(lastSale.priceEth)
                }
              />
            ) : null}
          </dl>
        </section>

        <TokenActions
          collection={collection}
          tokenId={token.tokenId}
          activeSellOffer={activeSellOffer}
          offers={offers}
        />
      </div>

      <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045]">
        <div className="border-b border-ivory/10 p-5">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ivory">
            Order book
            <GlossaryTip termKey="orderBook" align="start" />
          </h2>
          <p className="mt-2 text-sm text-bone/70">
            Listings and bids sourced from the collection marketplace contract.
            Anyone can buy an active listing instantly; bids stay open until
            they are accepted on-chain or cancelled.
          </p>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <OfferTable
            title="Listings"
            empty="No active listings yet."
            makerLabel="Seller"
            offers={sellOffers}
          />
          <OfferTable
            title="Bids"
            empty="No active bids yet."
            makerLabel="Buyer"
            offers={buyOffers}
          />
        </div>
      </section>
    </div>
  );
}

export function TokenHistoryPanel({
  token,
  sales,
}: {
  token: MarketToken;
  sales?: SalesSummary;
}) {
  const records = formatHistoryRecords(token.tokenHistory);

  return (
    <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm uppercase tracking-[0.28em] text-copper">
            Provenance
            <GlossaryTip termKey="provenance" align="start" />
          </p>
          <h2 className="font-display mt-3 text-2xl font-semibold text-ivory">
            Token history
          </h2>
          <p className="mt-2 text-sm leading-6 text-bone/70">
            Every recorded mint, transfer, and sale for this token, newest
            first.
          </p>
        </div>
        <div className="text-right text-sm text-bone/70">
          <p>{records.length.toLocaleString("en-US")} records</p>
          {sales?.count ? (
            <p className="mt-1 text-chartreuse">
              {sales.count.toLocaleString("en-US")} marketplace sale
              {sales.count === 1 ? "" : "s"} · {formatEth(sales.volumeEth)}{" "}
              lifetime volume
            </p>
          ) : null}
        </div>
      </div>

      <PriceSparkline records={records} />

      {records.length ? (
        <ol className="relative mt-8 space-y-0 border-l border-ivory/15 pl-6">
          {records.map((record, index) => (
            <li key={record.key} className="relative pb-6 last:pb-0">
              <span className="absolute -left-[0.42rem] top-1 size-3 rounded-full border border-copper bg-copper" />
              <article className="rounded-2xl bg-ink/55 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ivory">
                      {record.title}
                      {record.price ? ` · ${record.price}` : ""}
                    </h3>
                    <p className="mt-1 text-bone/70">{record.subtitle}</p>
                  </div>
                  <p className="text-bone/75">{record.date}</p>
                </div>
                {index === 0 ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-chartreuse">
                    Latest event
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState>
          No public transfer history is available from this collection endpoint
          yet. Marketplace actions still read from verified Arbitrum contracts.
        </EmptyState>
      )}
    </section>
  );
}

export function TokenCollectorNotesPanel({
  collection,
  token,
  detailHref,
  imageHref,
  videoHref,
}: {
  collection: Collection;
  token: MarketToken;
  detailHref: string;
  imageHref: string;
  videoHref?: string;
}) {
  const primaryTrait = primaryTokenTrait(token);
  const traits = visibleTokenTraits(token);
  const shareLinks = [
    { label: "detail link", value: detailHref },
    { label: "image link", value: imageHref },
    ...(videoHref ? [{ label: "video link", value: videoHref }] : []),
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
        <p className="text-sm uppercase tracking-[0.28em] text-copper">
          Collector notes
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-ivory">
          Metadata, provenance, and art system
        </h2>
        <p className="mt-4 text-sm leading-6 text-bone/78">
          {collection.shortName} metadata is normalized into a shared Axiom Zero
          token model, while trading actions are checked against verified
          Arbitrum contracts. This token belongs to {collection.name}, an art
          system described as {collection.artSystem.toLowerCase()}.
        </p>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <MarketStat
            label="Owner"
            value={
              <a
                href={arbiscanAddressUrl(token.owner)}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-ivory/25 underline-offset-4 transition hover:text-chartreuse"
              >
                {sameAddress(token.owner, collection.anchoringWalletAddress)
                  ? "Anchoring vault"
                  : shortenAddress(token.owner, 6)}
              </a>
            }
          />
          <MarketStat label={primaryTrait.label} value={primaryTrait.value} />
          <MarketStat
            label="Minted"
            value={formatFullDate(token.mintedAt)}
            termKey="minted"
          />
          <MarketStat
            label="Collection"
            value={collection.supplyNoun.singular}
          />
          <MarketStat
            label="Anchor status"
            value={
              token.anchored === undefined
                ? "Unknown"
                : anchorStatusLabel(
                    token.anchored,
                    sameAddress(
                      token.owner,
                      collection.anchoringWalletAddress,
                    ),
                  )
            }
            termKey="anchored"
          />
        </dl>

        <div className="mt-6">
          <ButtonLink
            href={collection.externalUrl}
            variant="secondary"
            target="_blank"
            rel="noreferrer"
          >
            Visit collection site
          </ButtonLink>
        </div>
      </section>

      <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
        <h2 className="text-xl font-semibold text-ivory">Traits and links</h2>
        {traits.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {traits.map((trait) => (
              <div
                key={`${trait.label}-${trait.value}`}
                className="rounded-2xl bg-ink/55 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-bone/60">
                  {trait.label}
                </p>
                <p className="mt-2 break-words font-semibold text-ivory">
                  {trait.value}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>
            No normalized traits are available for this token.
          </EmptyState>
        )}

        <div className="mt-5 rounded-2xl bg-ink/55 p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-bone/60">
            Seed
            <GlossaryTip termKey="seed" align="start" />
          </p>
          <p className="mt-2 break-all font-mono text-xs leading-6 text-bone/78">
            {token.seed || "Not available"}
          </p>
        </div>

        <div className="mt-5">
          <TokenShareActions
            links={shareLinks}
            detailHref={detailHref}
            title={token.name}
          />
        </div>
      </section>
    </div>
  );
}

function MarketStat({
  label,
  value,
  termKey,
}: {
  label: string;
  value: ReactNode;
  termKey?: GlossaryKey;
}) {
  return (
    <div className="rounded-[1.35rem] border border-ivory/10 bg-ink/40 p-4">
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.22em] text-bone/65">
        {label}
        {termKey ? <GlossaryTip termKey={termKey} align="start" /> : null}
      </dt>
      <dd className="mt-2 break-words font-semibold text-ivory">{value}</dd>
    </div>
  );
}

function OfferTable({
  title,
  empty,
  makerLabel,
  offers,
}: {
  title: string;
  empty: string;
  makerLabel: string;
  offers: MarketOffer[];
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-ivory/10">
      <div className="border-b border-ivory/10 bg-ink/35 px-4 py-3">
        <h3 className="font-semibold text-ivory">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ivory/10 text-left text-xs uppercase tracking-[0.18em] text-bone/65">
              <th className="px-4 py-3">{makerLabel}</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id} className="border-b border-ivory/10">
                <td className="px-4 py-4">{formatMaker(offer.maker)}</td>
                <td className="px-4 py-4 text-chartreuse">
                  {formatEth(offer.priceEth)}
                </td>
                <td className="px-4 py-4">{formatDate(offer.createdAt)}</td>
              </tr>
            ))}
            {!offers.length ? (
              <tr>
                <td className="px-4 py-4 text-bone/75" colSpan={3}>
                  {empty}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 rounded-2xl border border-ivory/10 bg-ink/45 p-4 text-sm leading-6 text-bone/75">
      {children}
    </p>
  );
}

function formatMaker(address: string) {
  if (address === "0x0000000000000000000000000000000000000000") {
    return "Unknown";
  }

  return (
    <a
      href={arbiscanAddressUrl(address)}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-ivory/25 underline-offset-4 transition hover:text-chartreuse"
    >
      {shortenAddress(address)}
    </a>
  );
}
