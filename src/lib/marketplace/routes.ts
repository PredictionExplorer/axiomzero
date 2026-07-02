import type {
  CollectionId,
  MarketplaceSearchParams,
  MarketplaceView,
} from "@/lib/marketplace/types";

export const MY_NFTS_PATH = "/my-nfts";

export const FAQ_PATH = "/faq";

export const collectionPaths = {
  "random-walk": "/random-walk",
  "cosmic-signature": "/cosmic-signature",
} satisfies Record<CollectionId, string>;

export function collectionPath(collectionId: CollectionId) {
  return collectionPaths[collectionId];
}

export function tokenPath(collectionId: CollectionId, tokenId: number) {
  return `/token/${collectionId}/${tokenId}`;
}

export function collectionMarketHref({
  collectionId,
  search,
  view,
  page,
}: {
  collectionId: CollectionId;
  search: MarketplaceSearchParams;
  view?: MarketplaceView;
  page?: number;
}) {
  const params = new URLSearchParams();
  const resolvedView = view ?? search.view ?? "discover";

  params.set("view", resolvedView);

  if (page !== undefined) {
    params.set("page", String(page));
  } else if (search.page && resolvedView === search.view) {
    params.set("page", String(search.page));
  }

  if (search.pageSize) {
    params.set("pageSize", String(search.pageSize));
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
  if (search.listedOnly) {
    params.set("listedOnly", "1");
  }

  if (resolvedView === "top-bids") {
    params.set("filter", "buy");
    params.set("sort", "price-desc");
  } else if (resolvedView === "listings") {
    params.set("filter", "sell");
    params.set("sort", "price-asc");
  } else if (search.sort) {
    params.set("sort", search.sort);
  }

  const query = params.toString();

  return `${collectionPath(collectionId)}${query ? `?${query}` : ""}`;
}
