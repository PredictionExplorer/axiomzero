import { collections } from "@/config/collections";
import type { MarketplaceSearchParams } from "@/lib/marketplace/types";

export function MarketplaceControls({
  search,
}: {
  search: MarketplaceSearchParams;
}) {
  return (
    <form
      action="/marketplace"
      className="grid gap-3 rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.22)] lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.8fr_0.8fr_auto]"
    >
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.24em] text-bone/75">
          Collection
        </span>
        <select
          name="collection"
          defaultValue={search.collection ?? "all"}
          className="h-12 w-full rounded-2xl border border-ivory/10 bg-ink px-4 text-sm text-ivory outline-none transition focus:border-chartreuse"
        >
          <option value="all">All collections</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.shortName}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.24em] text-bone/75">
          Offer type
        </span>
        <select
          name="kind"
          defaultValue={search.kind ?? "all"}
          className="h-12 w-full rounded-2xl border border-ivory/10 bg-ink px-4 text-sm text-ivory outline-none transition focus:border-chartreuse"
        >
          <option value="all">Listings and bids</option>
          <option value="sell">Sell listings</option>
          <option value="buy">Buy offers</option>
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.24em] text-bone/75">
          Token
        </span>
        <input
          name="query"
          placeholder="#001271"
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
          inputMode="decimal"
          defaultValue={search.min ?? ""}
          className="h-12 w-full rounded-2xl border border-ivory/10 bg-ink px-4 text-sm text-ivory outline-none transition focus:border-chartreuse"
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.24em] text-bone/75">
          Sort
        </span>
        <select
          name="sort"
          defaultValue={search.sort ?? "price-asc"}
          className="h-12 w-full rounded-2xl border border-ivory/10 bg-ink px-4 text-sm text-ivory outline-none transition focus:border-chartreuse"
        >
          <option value="price-asc">Price low</option>
          <option value="price-desc">Price high</option>
          <option value="recent">Recent</option>
        </select>
      </label>

      <div className="flex items-end">
        <button className="h-12 w-full rounded-2xl bg-copper px-5 text-sm font-semibold text-ink transition hover:bg-ember focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse">
          Apply
        </button>
      </div>
    </form>
  );
}
