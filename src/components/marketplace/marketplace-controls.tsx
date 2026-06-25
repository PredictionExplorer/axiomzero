import type { MarketplaceSearchParams } from "@/lib/marketplace/types";

const views = [
  {
    id: "discover",
    label: "Discover",
    description: "Browse small curated pages",
  },
  {
    id: "listings",
    label: "Listings",
    description: "NFTs available to buy",
  },
  {
    id: "top-bids",
    label: "Top bids",
    description: "Highest bids first",
  },
  {
    id: "my-nfts",
    label: "My NFTs",
    description: "List owned tokens",
  },
] as const;

function viewHref(view: (typeof views)[number]["id"], search: MarketplaceSearchParams) {
  const params = new URLSearchParams();

  params.set("view", view);
  if (search.collection && search.collection !== "all") {
    params.set("collection", search.collection);
  }
  if (search.query) {
    params.set("query", search.query);
  }
  if (search.min !== undefined) {
    params.set("min", String(search.min));
  }
  if (search.max !== undefined) {
    params.set("max", String(search.max));
  }
  if (view === "top-bids") {
    params.set("filter", "buy");
    params.set("sort", "price-desc");
  } else if (view === "listings") {
    params.set("filter", "sell");
    params.set("sort", "price-asc");
  } else if (search.sort) {
    params.set("sort", search.sort);
  }

  return `/marketplace?${params.toString()}`;
}

export function MarketplaceControls({
  search,
  totalOffers,
}: {
  search: MarketplaceSearchParams;
  totalOffers: number;
}) {
  const activeView = search.view ?? "discover";

  return (
    <form
      action="/marketplace"
      className="space-y-5 rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.22)]"
    >
      <input type="hidden" name="view" value={activeView} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-ivory">
            Browse controls
          </p>
          <p className="mt-1 text-sm text-bone/75">
            Move between discovery, listings, bids, and owned NFTs without
            opening an endless grid.
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

      <div className="grid gap-3 md:grid-cols-4">
        {views.map((view) => (
          <a
            key={view.id}
            href={viewHref(view.id, search)}
            className={`rounded-2xl border p-4 transition ${
              activeView === view.id
                ? "border-copper/50 bg-copper/12 text-ivory"
                : "border-ivory/10 bg-ink/45 text-bone hover:border-ivory/20 hover:bg-ivory/[0.06]"
            }`}
          >
            <span className="text-sm font-semibold">{view.label}</span>
            <span className="mt-1 block text-xs leading-5 text-bone/72">
              {view.description}
            </span>
          </a>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-bone/75">
            Collection
          </span>
          <select
            name="collection"
            defaultValue={search.collection ?? "all"}
            aria-label="Filter by collection"
            className="h-12 w-full rounded-2xl border border-ivory/10 bg-ink px-4 text-sm text-ivory outline-none transition focus:border-chartreuse"
          >
            <option value="all">All collections</option>
            <option value="random-walk">Random Walk</option>
            <option value="cosmic-signature">Cosmic Signature</option>
          </select>
        </label>
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
            Sort
          </span>
          <select
            name="sort"
            defaultValue={search.sort ?? "price-asc"}
            aria-label="Sort marketplace"
            className="h-12 w-full rounded-2xl border border-ivory/10 bg-ink px-4 text-sm text-ivory outline-none transition focus:border-chartreuse"
          >
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="recent">Most recent</option>
          </select>
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
            className="h-12 w-full rounded-2xl bg-copper px-5 text-sm font-semibold text-ink transition hover:bg-ember focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse"
          >
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}
