import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const contractMocks = vi.hoisted(() => ({
  fetchCollectionContractOffers: vi.fn(),
  fetchContractOffersForTokenId: vi.fn(),
}));

vi.mock("@/lib/marketplace/marketplace-contract-live", () => contractMocks);

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
  beforeEach(() => {
    contractMocks.fetchCollectionContractOffers.mockResolvedValue([]);
    contractMocks.fetchContractOffersForTokenId.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
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
      collection: "random-walk",
      kind: "all",
      min: 0.75,
      sort: "price-asc",
    });

    expect(offers.map((offer) => offer.id)).toEqual(["sell-1-1-1.0000"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetches marketplace offers from the requested Cosmic Signature source", async () => {
    contractMocks.fetchCollectionContractOffers.mockResolvedValueOnce([
      baseOffers[1],
    ]);

    const offers = await getMarketplaceOffers({
      collection: "cosmic-signature",
      kind: "buy",
      sort: "price-asc",
    });

    expect(offers.map((offer) => offer.id)).toEqual(["two"]);
    expect(contractMocks.fetchCollectionContractOffers).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionId: "cosmic-signature",
        nftAddress: "0xbb84Be3500A63581d3F2d5AC3bdF8685AAedad25",
        marketplaceAddress: "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08",
      }),
    );
  });

  it("merges both collection sources when all collections are selected", async () => {
    const sellHtml = String.raw`["$","div","sell-1",{"children":[["$","$L1f",null,{"id":1,"image":"sell.jpg","href":"/detail/1"}],["$","span",null,{"children":["#000001"," · ","1.0000 ETH"]}]]}]`;
    const fetchMock = vi.fn(async () => new Response(sellHtml));
    vi.stubGlobal("fetch", fetchMock);
    contractMocks.fetchCollectionContractOffers.mockResolvedValueOnce([
      baseOffers[1],
    ]);

    const offers = await getMarketplaceOffers({
      collection: "all",
      kind: "sell",
      sort: "price-asc",
    });

    expect(offers.map((offer) => offer.collectionId)).toEqual(["random-walk"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(contractMocks.fetchCollectionContractOffers).toHaveBeenCalledTimes(1);
  });

  it("reads token markets, offers, and metadata fallback through query helpers", async () => {
    const detailHtml = String.raw`
      self.__next_f.push([1,"{\"nft\":{\"id\":9,\"owner\":\"0x0000000000000000000000000000000000000001\",\"seed\":\"seed\"},\"buyOffers\":[{\"id\":2,\"offerId\":2,\"tokenId\":9,\"seller\":\"0x0000000000000000000000000000000000000000\",\"buyer\":\"0x0000000000000000000000000000000000000002\",\"price\":0.2,\"active\":true,\"createdAt\":\"2026-01-02T00:00:00.000Z\",\"createdAtTimestamp\":1,\"kind\":\"buy\"}],\"sellOffers\":[]}"]);
    `;
    const cosmicMetadata = {
      image: "cosmic.png",
      name: "Cosmic Signature #10",
      properties: {
        owner: "0x0000000000000000000000000000000000000003",
        seed: "seed",
        token_id: 10,
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(detailHtml))
      .mockResolvedValueOnce(new Response(detailHtml))
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ properties: { seed: "fallback" } })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(cosmicMetadata)))
      .mockResolvedValueOnce(new Response(JSON.stringify(cosmicMetadata)))
      .mockResolvedValueOnce(new Response(JSON.stringify(cosmicMetadata)));
    contractMocks.fetchContractOffersForTokenId.mockResolvedValue([
      baseOffers[1],
    ]);
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTokenMarket("random-walk", 9)).resolves.toMatchObject({
      token: { tokenId: 9 },
    });
    await expect(getOffersForToken("random-walk", 9)).resolves.toHaveLength(1);
    await expect(getToken("random-walk", 10)).resolves.toMatchObject({
      seed: "fallback",
    });
    await expect(getToken("cosmic-signature", 10)).resolves.toMatchObject({
      collectionId: "cosmic-signature",
      tokenId: 10,
      seed: "seed",
    });
    await expect(getOffersForToken("cosmic-signature", 10)).resolves.toEqual([
      baseOffers[1],
    ]);
    await expect(getTokenMarket("cosmic-signature", 10)).resolves.toMatchObject({
      token: { collectionId: "cosmic-signature", tokenId: 10 },
      offers: [baseOffers[1]],
    });
    expect(contractMocks.fetchContractOffersForTokenId).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionId: "cosmic-signature",
        tokenId: 10,
      }),
    );
  });
});
