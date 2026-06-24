import { afterEach, describe, expect, it, vi } from "vitest";

import {
  filterOffers,
  getMarketplaceOffers,
  getMarketplaceStats,
  getOffersForToken,
  getToken,
  getTokenMarket,
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses supported query state and normalizes invalid values", () => {
    expect(
      parseMarketplaceSearchParams({
        filter: "buy",
        min: "0.5",
        max: "5",
        sort: "recent",
      }),
    ).toEqual({
      collection: "all",
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
      kind: "sell",
      sort: "price-asc",
      min: undefined,
    });
  });

  it("prefers explicit kind values over filter aliases", () => {
    expect(
      parseMarketplaceSearchParams({
        kind: "sell",
        filter: "buy",
      }),
    ).toMatchObject({
      kind: "sell",
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
    expect(
      filterOffers(baseOffers, { min: 1.5 }).map((offer) => offer.id),
    ).toEqual(["one"]);
    expect(
      filterOffers(baseOffers, { max: 1.5 }).map((offer) => offer.id),
    ).toEqual(["two"]);
  });

  it("sorts by price and recency", () => {
    expect(
      sortOffers(baseOffers, "price-asc").map((offer) => offer.id),
    ).toEqual(["two", "one"]);
    expect(
      sortOffers(baseOffers, "price-desc").map((offer) => offer.id),
    ).toEqual(["one", "two"]);
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

  it("filters duplicate token IDs independently by offer type", () => {
    const duplicateTokenOffers = [
      ...baseOffers,
      {
        id: "three",
        collectionId: "random-walk",
        tokenId: 1,
        kind: "buy",
        priceEth: 3,
        maker: "0x0000000000000000000000000000000000000003",
        createdAt: "2026-01-03T00:00:00.000Z",
      },
    ] satisfies MarketOffer[];

    expect(
      filterOffers(duplicateTokenOffers, {
        query: "1",
        kind: "sell",
      }).map((offer) => offer.id),
    ).toEqual(["one"]);
  });

  it("fetches and filters live Random Walk marketplace offers", async () => {
    const sellHtml = String.raw`["$","div","sell-1",{"children":[["$","$L1f",null,{"id":1,"image":"sell.jpg","href":"/detail/1"}],["$","span",null,{"children":["#000001"," · ","1.0000 ETH"]}]]}]`;
    const buyHtml = String.raw`["$","div","buy-2",{"children":[["$","$L1f",null,{"id":2,"image":"buy.jpg","href":"/detail/2"}],["$","span",null,{"children":["#000002"," · ","0.5000 ETH"]}]]}]`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(sellHtml))
      .mockResolvedValueOnce(new Response(buyHtml));
    vi.stubGlobal("fetch", fetchMock);

    const offers = await getMarketplaceOffers({
      kind: "all",
      min: 0.75,
      sort: "price-asc",
    });

    expect(offers.map((offer) => offer.id)).toEqual(["sell-1-1-1.0000"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads token markets, offers, and metadata fallback through query helpers", async () => {
    const detailHtml = String.raw`
      self.__next_f.push([1,"{\"nft\":{\"id\":9,\"owner\":\"0x0000000000000000000000000000000000000001\",\"seed\":\"seed\"},\"buyOffers\":[{\"id\":2,\"offerId\":2,\"tokenId\":9,\"seller\":\"0x0000000000000000000000000000000000000000\",\"buyer\":\"0x0000000000000000000000000000000000000002\",\"price\":0.2,\"active\":true,\"createdAt\":\"2026-01-02T00:00:00.000Z\",\"createdAtTimestamp\":1,\"kind\":\"buy\"}],\"sellOffers\":[]}"]);
    `;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(detailHtml))
      .mockResolvedValueOnce(new Response(detailHtml))
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ properties: { seed: "fallback" } })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTokenMarket("random-walk", 9)).resolves.toMatchObject({
      token: { tokenId: 9 },
    });
    await expect(getOffersForToken("random-walk", 9)).resolves.toHaveLength(1);
    await expect(getToken("random-walk", 10)).resolves.toMatchObject({
      seed: "fallback",
    });
    await expect(getToken("cosmic-signature", 10)).resolves.toBeUndefined();
    await expect(getOffersForToken("cosmic-signature", 10)).resolves.toEqual(
      [],
    );
    await expect(
      getTokenMarket("cosmic-signature", 10),
    ).resolves.toBeUndefined();
  });
});
