import type { MarketplaceSearchParams } from "@/lib/marketplace/types";

export function MarketplaceControls({
  search,
  totalOffers,
}: {
  search: MarketplaceSearchParams;
  totalOffers: number;
}) {
  const activeKind = search.kind === "buy" ? "buy" : "sell";

  return (
    <form
      action="/marketplace"
      className="space-y-5 rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.22)]"
    >
      {search.collection && search.collection !== "all" ? (
        <input type="hidden" name="collection" value={search.collection} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-ivory">
            Marketplace controls
          </p>
          <p className="mt-1 text-sm text-bone/75">
            Filter by type, token, and price. Sorting updates instantly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-ivory/15 px-3 py-1 text-xs uppercase tracking-[0.24em] text-bone/75">
            {totalOffers} entries
          </span>
          <a
            href="/marketplace"
            className="rounded-full px-3 py-1 text-sm text-bone transition hover:bg-ivory/[0.07] hover:text-ivory"
          >
            Reset
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ivory/10 bg-ink/55 px-4 py-3">
        <span className="text-xs uppercase tracking-[0.22em] text-bone/75">
          Sort by
        </span>
        <select
          name="sort"
          defaultValue={search.sort ?? "price-asc"}
          aria-label="Sort marketplace offers"
          className="h-9 rounded-xl border border-ivory/10 bg-carbon px-3 text-sm text-ivory outline-none transition focus:border-chartreuse"
        >
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="recent">Most recent</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="filter"
          value="sell"
          className={`h-10 rounded-full px-4 text-sm font-semibold transition ${
            activeKind === "sell"
              ? "bg-copper text-ink"
              : "border border-ivory/15 text-ivory hover:bg-ivory/[0.07]"
          }`}
        >
          Sell listings
        </button>
        <button
          type="submit"
          name="filter"
          value="buy"
          className={`h-10 rounded-full px-4 text-sm font-semibold transition ${
            activeKind === "buy"
              ? "bg-copper text-ink"
              : "border border-ivory/15 text-ivory hover:bg-ivory/[0.07]"
          }`}
        >
          Buy offers
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-bone/75">
            Token ID
          </span>
          <input
            name="query"
            type="number"
            min={0}
            placeholder="Search token"
            defaultValue={search.query ?? ""}
            className="h-12 w-full rounded-2xl border border-ivory/10 bg-ink px-4 text-sm text-ivory outline-none transition placeholder:text-bone/35 focus:border-chartreuse"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-bone/75">
            Min ETH
          </span>
          <input
            name="min"
            type="number"
            min={0}
            step="0.001"
            defaultValue={search.min ?? ""}
            className="h-12 w-full rounded-2xl border border-ivory/10 bg-ink px-4 text-sm text-ivory outline-none transition focus:border-chartreuse"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-bone/75">
            Max ETH
          </span>
          <input
            name="max"
            type="number"
            min={0}
            step="0.001"
            defaultValue={search.max ?? ""}
            className="h-12 w-full rounded-2xl border border-ivory/10 bg-ink px-4 text-sm text-ivory outline-none transition focus:border-chartreuse"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            name="filter"
            value={activeKind}
            className="h-12 w-full rounded-2xl bg-copper px-5 text-sm font-semibold text-ink transition hover:bg-ember focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse"
          >
            Apply filters
          </button>
        </div>
      </div>
    </form>
  );
}
