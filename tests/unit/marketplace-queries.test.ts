import { describe, expect, it } from "vitest";

import {
  filterOffers,
  getOffersForToken,
  getMarketplaceStats,
  getToken,
  parseMarketplaceSearchParams,
  sortOffers,
} from "@/lib/marketplace/queries";
import type { MarketOffer } from "@/lib/marketplace/types";

const baseOffers = [
  {
    id: "one",
    collectionId: "random-walk",
    tokenId: 1,
    kind: "sell",
    priceEth: 2,
    maker: "0x0000000000000000000000000000000000000001",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "two",
    collectionId: "cosmic-signature",
    tokenId: 2,
    kind: "buy",
    priceEth: 1,
    maker: "0x0000000000000000000000000000000000000002",
    createdAt: "2026-01-02T00:00:00.000Z",
  },
] satisfies MarketOffer[];

describe("marketplace queries", () => {
  it("parses supported query state and normalizes invalid values", () => {
    expect(
      parseMarketplaceSearchParams({
        collection: "cosmic-signature",
        kind: "buy",
        min: "0.5",
        max: "5",
        sort: "recent",
      }),
    ).toEqual({
      collection: "cosmic-signature",
      kind: "buy",
      min: 0.5,
      max: 5,
      sort: "recent",
      query: undefined,
    });

    expect(
      parseMarketplaceSearchParams({
        collection: "privileged",
        kind: "vip",
        min: "-1",
        sort: "mystery",
      }),
    ).toMatchObject({
      collection: "all",
      kind: "all",
      sort: "price-asc",
      min: undefined,
    });
  });

  it("filters by collection, kind, token, and price", () => {
    const result = filterOffers(baseOffers, {
      collection: "cosmic-signature",
      kind: "buy",
      query: "#2",
      min: 0.5,
      max: 2,
      sort: "price-asc",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("two");
  });

  it("rejects non-numeric token queries and applies min/max bounds", () => {
    expect(filterOffers(baseOffers, { query: "not-a-token" })).toEqual([]);
    expect(filterOffers(baseOffers, { min: 1.5 }).map((offer) => offer.id)).toEqual([
      "one",
    ]);
    expect(filterOffers(baseOffers, { max: 1.5 }).map((offer) => offer.id)).toEqual([
      "two",
    ]);
  });

  it("sorts by price and recency", () => {
    expect(sortOffers(baseOffers, "price-asc").map((offer) => offer.id)).toEqual([
      "two",
      "one",
    ]);
    expect(sortOffers(baseOffers, "price-desc").map((offer) => offer.id)).toEqual([
      "one",
      "two",
    ]);
    expect(sortOffers(baseOffers, "recent").map((offer) => offer.id)).toEqual([
      "two",
      "one",
    ]);
  });

  it("calculates marketplace stats", () => {
    expect(getMarketplaceStats(baseOffers)).toEqual({
      totalOffers: 2,
      lowestPrice: 1,
      highestPrice: 2,
      sellListings: 1,
      buyOffers: 1,
    });

    expect(getMarketplaceStats([])).toEqual({
      totalOffers: 0,
      lowestPrice: undefined,
      highestPrice: undefined,
      sellListings: 0,
      buyOffers: 0,
    });
  });

  it("looks up fixture tokens and token offers", () => {
    expect(getToken("random-walk", 1271)?.name).toBe("Random Walk #001271");
    expect(getToken("random-walk", 999_999)).toBeUndefined();
    expect(getOffersForToken("cosmic-signature", 11)).toHaveLength(1);
  });
});
