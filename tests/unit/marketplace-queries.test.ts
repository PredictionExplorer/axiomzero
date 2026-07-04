import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const contractMocks = vi.hoisted(() => ({
  fetchCollectionContractOffers: vi.fn(),
  fetchContractOffersForTokenId: vi.fn(),
}));
const indexMocks = vi.hoisted(() => ({
  getCollectionTokenIds: vi.fn(),
  fetchCollectionTokenOwner: vi.fn(),
}));
const anchoringMocks = vi.hoisted(() => ({
  getAnchoredTokenIdSet: vi.fn(),
  getAnchorStatusForTokens: vi.fn(),
  getTokenAnchorStatus: vi.fn(),
}));

vi.mock("@/lib/marketplace/marketplace-contract-live", () => contractMocks);
vi.mock("@/lib/marketplace/collection-index-live", () => indexMocks);
vi.mock("@/lib/marketplace/anchoring-live", () => anchoringMocks);

import {
  filterOffers,
  getMarketplaceOffers,
  getMarketplaceStats,
  getMarketplaceTokenPage,
  getOffersForToken,
  getToken,
  getTokenMarket,
  isTokenNotFoundError,
  parseMarketplaceSearchParams,
  summarizeTokenMarket,
  sortOffers,
  TokenNotFoundError,
} from "@/lib/marketplace/queries";
import type { MarketOffer } from "@/lib/marketplace/types";
import {
  emptyRandomWalkHistoryResponse,
  jsonResponse,
  randomWalkInfoResponse,
  routedFetchMock,
} from "../helpers/go-api-fixtures";

type FetchRoutes = Parameters<typeof routedFetchMock>[0];

/** Standard Random Walk API routes serving any token id with empty history. */
function randomWalkApiRoutes(
  owner = "0x0000000000000000000000000000000000000001",
): FetchRoutes {
  return [
    [
      /\/api\/randomwalk\/tokens\/info\/(\d+)$/,
      (match) =>
        jsonResponse(
          randomWalkInfoResponse(Number(match[1]), {
            CurOwnerAddr: owner,
            SeedHex: `seed-${match[1]}`,
          }),
        ),
    ],
    [
      /\/api\/randomwalk\/tokens\/history\/(\d+)\//,
      (match) => jsonResponse(emptyRandomWalkHistoryResponse(Number(match[1]))),
    ],
  ];
}

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

describe("offer scans in production", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    indexMocks.getCollectionTokenIds.mockResolvedValue([]);
    anchoringMocks.getAnchoredTokenIdSet.mockResolvedValue(undefined);
    anchoringMocks.getAnchorStatusForTokens.mockResolvedValue(new Map());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  const search = {
    collection: "random-walk",
    kind: "sell",
    view: "discover",
    sort: "price-asc",
  } as const;

  it("reuses the offer scan within the TTL", async () => {
    contractMocks.fetchCollectionContractOffers.mockResolvedValue([
      baseOffers[0],
    ]);

    const first = await getMarketplaceOffers(search);
    const second = await getMarketplaceOffers(search);

    expect(first.map((offer) => offer.id)).toEqual(["one"]);
    expect(second.map((offer) => offer.id)).toEqual(["one"]);
    expect(contractMocks.fetchCollectionContractOffers).toHaveBeenCalledTimes(
      1,
    );
  });

  it("serves the last good offers when a refresh fails", async () => {
    vi.useFakeTimers();
    vi.advanceTimersByTime(31_000);
    contractMocks.fetchCollectionContractOffers.mockResolvedValueOnce([
      baseOffers[0],
    ]);

    await getMarketplaceOffers(search);

    vi.advanceTimersByTime(31_000);
    contractMocks.fetchCollectionContractOffers.mockRejectedValueOnce(
      new Error("scan failed"),
    );

    const stale = await getMarketplaceOffers(search);

    expect(stale.map((offer) => offer.id)).toEqual(["one"]);
    expect(contractMocks.fetchCollectionContractOffers).toHaveBeenCalledTimes(
      2,
    );
  });

  it("serves stale offers when a refresh exceeds the time budget", async () => {
    vi.useFakeTimers();
    vi.advanceTimersByTime(31_000);
    contractMocks.fetchCollectionContractOffers.mockResolvedValueOnce([
      { ...baseOffers[1], collectionId: "cosmic-signature" },
    ]);

    const cosmicSearch = { ...search, collection: "cosmic-signature" } as const;

    await getMarketplaceOffers({ ...cosmicSearch, kind: "buy" });

    vi.advanceTimersByTime(31_000);
    contractMocks.fetchCollectionContractOffers.mockImplementationOnce(
      () => new Promise(() => {}),
    );

    const pending = getMarketplaceOffers({ ...cosmicSearch, kind: "buy" });
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(pending).resolves.toMatchObject([{ id: "two" }]);
  });
});

describe("marketplace queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    indexMocks.getCollectionTokenIds.mockImplementation(
      async (collectionId: string) =>
        collectionId === "random-walk"
          ? [0, 1, 2, 7, 8, 9, 10, 3456, 4085]
          : [0, 1, 2, 10, 23],
    );
    contractMocks.fetchCollectionContractOffers.mockResolvedValue([]);
    contractMocks.fetchContractOffersForTokenId.mockResolvedValue([]);
    indexMocks.fetchCollectionTokenOwner.mockResolvedValue(undefined);
    anchoringMocks.getAnchoredTokenIdSet.mockResolvedValue(undefined);
    anchoringMocks.getAnchorStatusForTokens.mockResolvedValue(new Map());
    anchoringMocks.getTokenAnchorStatus.mockResolvedValue(undefined);
  });

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
        page: "3",
        pageSize: "18",
      }),
    ).toEqual({
      collection: "all",
      kind: "buy",
      view: "discover",
      min: 0.5,
      max: 5,
      sort: "recent",
      query: undefined,
      page: 3,
      pageSize: 18,
      listedOnly: false,
    });

    expect(
      parseMarketplaceSearchParams({
        collection: "privileged",
        kind: "vip",
        min: "-1",
        sort: "mystery",
        view: "my-nfts",
      }),
    ).toMatchObject({
      collection: "all",
      kind: "sell",
      view: "discover",
      sort: "price-asc",
      min: undefined,
      page: 1,
      pageSize: 12,
    });
  });

  it("parses listed-only discover filters", () => {
    expect(
      parseMarketplaceSearchParams({
        listedOnly: "1",
      }),
    ).toMatchObject({
      listedOnly: true,
    });
  });

  it("uses view-specific marketplace defaults", () => {
    expect(parseMarketplaceSearchParams({ view: "top-bids" })).toMatchObject({
      view: "top-bids",
      kind: "buy",
      sort: "price-desc",
    });
    expect(parseMarketplaceSearchParams({ view: "listings" })).toMatchObject({
      view: "listings",
      kind: "sell",
      sort: "price-asc",
    });
    expect(
      parseMarketplaceSearchParams({ pageSize: "999", page: "-4" }),
    ).toMatchObject({
      page: 1,
      pageSize: 24,
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
    expect(parseMarketplaceSearchParams({ kind: "all" })).toMatchObject({
      kind: "all",
    });
  });

  it("parses anchor status filters and drops unknown values", () => {
    expect(parseMarketplaceSearchParams({ anchor: "never" })).toMatchObject({
      anchor: "never",
    });
    expect(parseMarketplaceSearchParams({ anchor: "anchored" })).toMatchObject({
      anchor: "anchored",
    });
    expect(
      parseMarketplaceSearchParams({ anchor: "sometimes" }).anchor,
    ).toBeUndefined();
    expect(parseMarketplaceSearchParams({}).anchor).toBeUndefined();
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

  it("calculates marketplace stats from sale listings and bids separately", () => {
    const cheapBid = baseOffers[1];
    const expensiveListing = baseOffers[0];
    const floorListing = {
      id: "floor",
      collectionId: "random-walk",
      tokenId: 3,
      kind: "sell",
      priceEth: 1.5,
      maker: "0x0000000000000000000000000000000000000003",
      createdAt: "2026-01-03T00:00:00.000Z",
    } satisfies MarketOffer;
    const topBid = {
      id: "top-bid",
      collectionId: "cosmic-signature",
      tokenId: 4,
      kind: "buy",
      priceEth: 5,
      maker: "0x0000000000000000000000000000000000000004",
      createdAt: "2026-01-04T00:00:00.000Z",
    } satisfies MarketOffer;
    const inactiveLowListing = {
      ...floorListing,
      id: "inactive-low-listing",
      priceEth: 0.01,
      active: false,
    } satisfies MarketOffer;
    const inactiveHighBid = {
      ...topBid,
      id: "inactive-high-bid",
      priceEth: 25,
      active: false,
    } satisfies MarketOffer;

    expect(
      getMarketplaceStats([
        expensiveListing,
        cheapBid,
        floorListing,
        topBid,
        inactiveLowListing,
        inactiveHighBid,
      ]),
    ).toEqual({
      totalOffers: 4,
      floorOffer: floorListing,
      topBidOffer: topBid,
      sellListings: 2,
      buyOffers: 2,
    });

    expect(getMarketplaceStats([])).toEqual({
      totalOffers: 0,
      floorOffer: undefined,
      topBidOffer: undefined,
      sellListings: 0,
      buyOffers: 0,
    });
  });

  it("summarizes token markets with the cheapest listing and highest bid", () => {
    const summary = summarizeTokenMarket({
      token: {
        collectionId: "random-walk",
        tokenId: 1,
        name: "Random Walk #000001",
        owner: "0x0000000000000000000000000000000000000001",
        seed: "seed",
        traits: [],
        artwork: { image: "token.png", alt: "Token artwork" },
      },
      offers: [
        baseOffers[0],
        {
          ...baseOffers[0],
          id: "inactive-floor",
          priceEth: 0.01,
          active: false,
        },
        {
          id: "bid",
          collectionId: "random-walk",
          tokenId: 1,
          kind: "buy",
          priceEth: 5,
          maker: "0x0000000000000000000000000000000000000004",
          createdAt: "2026-01-04T00:00:00.000Z",
        },
        {
          id: "inactive-top-bid",
          collectionId: "random-walk",
          tokenId: 1,
          kind: "buy",
          priceEth: 50,
          maker: "0x0000000000000000000000000000000000000005",
          createdAt: "2026-01-05T00:00:00.000Z",
          active: false,
        },
      ],
    });

    expect(summary.activeSellOffer?.id).toBe("one");
    expect(summary.highestBid?.id).toBe("bid");
    expect(summary.offers.map((offer) => offer.id)).toEqual(["one", "bid"]);
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

  it("filters marketplace offers by anchor status using the anchored set", async () => {
    contractMocks.fetchCollectionContractOffers.mockResolvedValue([
      baseOffers[0],
      {
        id: "anchored-listing",
        collectionId: "random-walk",
        tokenId: 7,
        kind: "sell",
        priceEth: 0.9,
        maker: "0x0000000000000000000000000000000000000003",
        createdAt: "2026-01-03T00:00:00.000Z",
      },
    ]);
    anchoringMocks.getAnchoredTokenIdSet.mockResolvedValue(new Set([7]));

    const neverAnchored = await getMarketplaceOffers({
      collection: "random-walk",
      kind: "sell",
      sort: "price-asc",
      anchor: "never",
    });

    expect(neverAnchored.map((offer) => offer.id)).toEqual(["one"]);

    const anchored = await getMarketplaceOffers({
      collection: "random-walk",
      kind: "sell",
      sort: "price-asc",
      anchor: "anchored",
    });

    expect(anchored.map((offer) => offer.id)).toEqual(["anchored-listing"]);
  });

  it("keeps offers visible when the anchored set is unavailable", async () => {
    contractMocks.fetchCollectionContractOffers.mockResolvedValue([
      baseOffers[0],
    ]);
    anchoringMocks.getAnchoredTokenIdSet.mockResolvedValue(undefined);

    const offers = await getMarketplaceOffers({
      collection: "random-walk",
      kind: "sell",
      sort: "price-asc",
      anchor: "never",
    });

    expect(offers.map((offer) => offer.id)).toEqual(["one"]);
  });

  it("filters discover token pages by anchor status", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValue([5, 7]);
    anchoringMocks.getAnchoredTokenIdSet.mockResolvedValue(new Set([5]));
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    const page = await getMarketplaceTokenPage({
      collection: "random-walk",
      view: "discover",
      anchor: "never",
      page: 1,
      pageSize: 12,
    });

    expect(page.totalItems).toBe(1);
    expect(page.items[0]?.token.tokenId).toBe(7);
  });

  it("stamps token markets with their on-chain anchor status", async () => {
    anchoringMocks.getTokenAnchorStatus.mockResolvedValue(true);
    const cosmicMetadata = {
      image: "cosmic.png",
      name: "Cosmic Signature #10",
      properties: {
        owner: "0x0000000000000000000000000000000000000003",
        seed: "seed",
        token_id: 10,
      },
    };
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [/\/metadata\/10$/, () => jsonResponse(cosmicMetadata)],
        [/\/api\/cosmicgame\//, () => new Response("", { status: 503 })],
      ]),
    );

    await expect(getTokenMarket("cosmic-signature", 10)).resolves.toMatchObject(
      {
        token: { tokenId: 10, anchored: true },
      },
    );
    expect(anchoringMocks.getTokenAnchorStatus).toHaveBeenCalledWith(
      "cosmic-signature",
      10,
    );
  });

  it("fetches and filters Random Walk offers from the marketplace contract", async () => {
    contractMocks.fetchCollectionContractOffers.mockResolvedValueOnce([
      baseOffers[0],
      {
        id: "bid",
        collectionId: "random-walk",
        tokenId: 2,
        kind: "buy",
        priceEth: 0.5,
        maker: "0x0000000000000000000000000000000000000002",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const offers = await getMarketplaceOffers({
      collection: "random-walk",
      kind: "all",
      min: 0.75,
      sort: "price-asc",
    });

    expect(offers.map((offer) => offer.id)).toEqual(["one"]);
    expect(contractMocks.fetchCollectionContractOffers).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionId: "random-walk",
        nftAddress: "0x895a6F444BE4ba9d124F61DF736605792B35D66b",
        marketplaceAddress: "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08",
        loadToken: expect.any(Function),
      }),
    );
  });

  it("loads a small token discovery page from token search", async () => {
    contractMocks.fetchContractOffersForTokenId.mockResolvedValueOnce([
      {
        id: "contract-bid",
        collectionId: "random-walk",
        tokenId: 9,
        kind: "buy",
        priceEth: 0.4,
        maker: "0x0000000000000000000000000000000000000004",
        createdAt: "1970-01-01T00:00:00.000Z",
      },
    ]);
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    const page = await getMarketplaceTokenPage({
      collection: "random-walk",
      query: "9",
      view: "discover",
      page: 1,
      pageSize: 12,
    });

    expect(page).toMatchObject({
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
    });
    expect(page.items[0]?.token.tokenId).toBe(9);
    expect(page.items[0]?.highestBid?.priceEth).toBe(0.4);
  });

  it("builds discovery pages from the live minted token index", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValue([5, 7]);
    const fetchMock = routedFetchMock(randomWalkApiRoutes());
    vi.stubGlobal("fetch", fetchMock);

    const page = await getMarketplaceTokenPage({
      collection: "random-walk",
      view: "discover",
      page: 1,
      pageSize: 12,
    });

    expect(page).toMatchObject({
      totalItems: 2,
      totalPages: 1,
    });
    expect(page.items.map((item) => item.token.tokenId)).toEqual([5, 7]);
    // One tokens/info plus one tokens/history call per token.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("filters discover pages by listing status and price", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValue([5, 7]);
    contractMocks.fetchCollectionContractOffers.mockResolvedValue([
      {
        id: "sell-5",
        collectionId: "random-walk",
        tokenId: 5,
        kind: "sell",
        priceEth: 0.5,
        maker: "0x0000000000000000000000000000000000000001",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "sell-7",
        collectionId: "random-walk",
        tokenId: 7,
        kind: "sell",
        priceEth: 2,
        maker: "0x0000000000000000000000000000000000000002",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    contractMocks.fetchContractOffersForTokenId.mockResolvedValue([
      {
        id: "sell-5",
        collectionId: "random-walk",
        tokenId: 5,
        kind: "sell",
        priceEth: 0.5,
        maker: "0x0000000000000000000000000000000000000001",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    const page = await getMarketplaceTokenPage({
      collection: "random-walk",
      view: "discover",
      listedOnly: true,
      min: 0.4,
      max: 0.6,
      sort: "price-asc",
      page: 1,
      pageSize: 12,
    });

    expect(page.totalItems).toBe(1);
    expect(page.items[0]?.token.tokenId).toBe(5);
  });

  it("dedupes listed tokens and applies default paging on listed views", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValue([5]);
    contractMocks.fetchCollectionContractOffers.mockResolvedValue([
      {
        id: "sell-5-low",
        collectionId: "random-walk",
        tokenId: 5,
        kind: "sell",
        priceEth: 0.5,
        maker: "0x0000000000000000000000000000000000000001",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "sell-5-high",
        collectionId: "random-walk",
        tokenId: 5,
        kind: "sell",
        priceEth: 1,
        maker: "0x0000000000000000000000000000000000000002",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    contractMocks.fetchContractOffersForTokenId.mockResolvedValue([]);
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    const page = await getMarketplaceTokenPage({
      collection: "random-walk",
      view: "discover",
      listedOnly: true,
    });

    expect(page).toMatchObject({ page: 1, pageSize: 12, totalItems: 1 });
    expect(page.items.map((item) => item.token.tokenId)).toEqual([5]);
  });

  it("orders discover pages newest-first for the recent sort", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValue([5, 7]);
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    const page = await getMarketplaceTokenPage({
      collection: "random-walk",
      view: "discover",
      sort: "recent",
    });

    expect(page.items.map((item) => item.token.tokenId)).toEqual([7, 5]);
  });

  it("sorts discover pages by listing price descending", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValue([5, 7]);
    contractMocks.fetchCollectionContractOffers.mockResolvedValue([
      {
        id: "sell-5",
        collectionId: "random-walk",
        tokenId: 5,
        kind: "sell",
        priceEth: 0.5,
        maker: "0x0000000000000000000000000000000000000001",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "sell-7",
        collectionId: "random-walk",
        tokenId: 7,
        kind: "sell",
        priceEth: 2,
        maker: "0x0000000000000000000000000000000000000002",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    contractMocks.fetchContractOffersForTokenId.mockResolvedValue([]);
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    const page = await getMarketplaceTokenPage({
      collection: "random-walk",
      view: "discover",
      listedOnly: true,
      sort: "price-desc",
      page: 1,
      pageSize: 12,
    });

    expect(page.items.map((item) => item.token.tokenId)).toEqual([7, 5]);
  });

  it("falls back to Random Walk metadata and contract orders when detail loading fails", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValueOnce([3456]);
    contractMocks.fetchContractOffersForTokenId.mockResolvedValueOnce([
      {
        id: "contract-bid",
        collectionId: "random-walk",
        tokenId: 3456,
        kind: "buy",
        priceEth: 0.8,
        maker: "0x0000000000000000000000000000000000000002",
        createdAt: "1970-01-01T00:00:00.000Z",
      },
    ]);
    indexMocks.fetchCollectionTokenOwner.mockResolvedValue(
      "0x00000000000000000000000000000000000000aa",
    );
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [/\/api\/randomwalk\/tokens\//, () => new Response("", { status: 503 })],
        [
          /randomwalknft-api\.com\/metadata\/3456$/,
          () =>
            jsonResponse({
              name: "Random Walk #003456",
              properties: { seed: "metadata-seed" },
            }),
        ],
      ]),
    );

    await expect(getTokenMarket("random-walk", 3456)).resolves.toMatchObject({
      token: {
        tokenId: 3456,
        seed: "metadata-seed",
        // The zero-address metadata owner is replaced by the on-chain read.
        owner: "0x00000000000000000000000000000000000000aa",
      },
      offers: [
        expect.objectContaining({
          kind: "buy",
          tokenId: 3456,
          priceEth: 0.8,
        }),
      ],
    });
    expect(indexMocks.fetchCollectionTokenOwner).toHaveBeenCalledWith({
      collectionId: "random-walk",
      tokenId: 3456,
    });
  });

  it("keeps the zero-address owner when the on-chain read also fails", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValueOnce([3456]);
    indexMocks.fetchCollectionTokenOwner.mockRejectedValue(
      new Error("RPC unavailable"),
    );
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [/\/api\/randomwalk\/tokens\//, () => new Response("", { status: 503 })],
        [
          /randomwalknft-api\.com\/metadata\/3456$/,
          () => jsonResponse({ properties: { seed: "metadata-seed" } }),
        ],
      ]),
    );

    await expect(getTokenMarket("random-walk", 3456)).resolves.toMatchObject({
      token: {
        tokenId: 3456,
        owner: "0x0000000000000000000000000000000000000000",
      },
    });
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
    contractMocks.fetchCollectionContractOffers
      .mockResolvedValueOnce([baseOffers[0]])
      .mockResolvedValueOnce([baseOffers[1]]);

    const offers = await getMarketplaceOffers({
      collection: "all",
      kind: "sell",
      sort: "price-asc",
    });

    expect(offers.map((offer) => offer.collectionId)).toEqual(["random-walk"]);
    expect(contractMocks.fetchCollectionContractOffers).toHaveBeenCalledTimes(
      2,
    );
  });

  it("identifies token-not-found failures with a typed error", () => {
    const error = new TokenNotFoundError("random-walk", 999999);

    expect(error.message).toBe("random-walk token 999999 was not found.");
    expect(error.name).toBe("TokenNotFoundError");
    expect(isTokenNotFoundError(error)).toBe(true);
    expect(isTokenNotFoundError(new Error("other"))).toBe(false);
  });

  it("honors the legacy sell filter param", () => {
    expect(parseMarketplaceSearchParams({ filter: "sell" })).toMatchObject({
      kind: "sell",
      view: "discover",
    });
  });

  it("returns an empty page when the searched token is unminted", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValue([5, 7]);

    const page = await getMarketplaceTokenPage({
      collection: "random-walk",
      query: "999",
      view: "discover",
      page: 1,
      pageSize: 12,
    });

    expect(page).toMatchObject({ totalItems: 0, items: [] });
  });

  it("builds discovery pages across every collection by default", async () => {
    indexMocks.getCollectionTokenIds.mockImplementation(
      async (collectionId: string) =>
        collectionId === "random-walk" ? [5] : [],
    );
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    const page = await getMarketplaceTokenPage({
      view: "discover",
      page: 1,
      pageSize: 12,
    });

    expect(page.totalItems).toBe(1);
    expect(indexMocks.getCollectionTokenIds).toHaveBeenCalledWith(
      "random-walk",
    );
    expect(indexMocks.getCollectionTokenIds).toHaveBeenCalledWith(
      "cosmic-signature",
    );
  });

  it("unwraps repeated query params to their first value", () => {
    const search = parseMarketplaceSearchParams({
      collection: ["cosmic-signature", "random-walk"],
      kind: ["buy"],
      view: ["top-bids"],
      sort: ["recent"],
      anchor: ["never"],
      query: ["  #23  "],
      min: ["0.5"],
      max: ["2"],
    });

    expect(search).toMatchObject({
      collection: "cosmic-signature",
      kind: "buy",
      view: "top-bids",
      sort: "recent",
      anchor: "never",
      query: "#23",
      min: 0.5,
      max: 2,
    });
  });

  it("rejects offer lookups for unminted or fractional token ids", async () => {
    await expect(getOffersForToken("random-walk", 1.5)).rejects.toThrow(
      TokenNotFoundError,
    );
    await expect(getOffersForToken("random-walk", 999999)).rejects.toThrow(
      "random-walk token 999999 was not found.",
    );
  });

  it("hides inactive offers from the marketplace views", () => {
    expect(
      filterOffers(
        [{ ...baseOffers[0], active: false }],
        { collection: "all", kind: "all" },
      ),
    ).toEqual([]);
  });

  it("returns an empty discover page for non-numeric token searches", async () => {
    const page = await getMarketplaceTokenPage({
      collection: "random-walk",
      query: "not-a-token",
      view: "discover",
      page: 1,
      pageSize: 12,
    });

    expect(page).toMatchObject({ totalItems: 0, totalPages: 1, items: [] });
  });

  it("keeps every candidate when the anchor scan is unavailable", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValue([5, 7]);
    anchoringMocks.getAnchoredTokenIdSet.mockRejectedValue(
      new Error("anchors down"),
    );
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    const page = await getMarketplaceTokenPage({
      collection: "random-walk",
      view: "discover",
      anchor: "never",
      page: 1,
      pageSize: 12,
    });

    expect(page.items.map((item) => item.token.tokenId)).toEqual([5, 7]);
  });

  it("skips tokens whose market cannot be summarized", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValue([0, 1]);
    // Every Cosmic Signature data source is down, so token loading throws.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );

    const page = await getMarketplaceTokenPage({
      collection: "cosmic-signature",
      view: "discover",
      page: 1,
      pageSize: 12,
    });

    expect(page.totalItems).toBe(2);
    expect(page.items).toEqual([]);
  });

  it("exposes the Random Walk preview loader to the offer scanner", async () => {
    contractMocks.fetchCollectionContractOffers.mockImplementationOnce(
      async ({
        loadToken,
      }: {
        loadToken?: (tokenId: number) => Promise<unknown>;
      }) => {
        await loadToken?.(1233);
        return [];
      },
    );

    await getMarketplaceOffers({
      collection: "random-walk",
      kind: "sell",
      sort: "price-asc",
    });

    expect(contractMocks.fetchCollectionContractOffers).toHaveBeenCalledTimes(
      1,
    );
  });

  it("returns the token market without an anchor stamp when the status read fails", async () => {
    anchoringMocks.getTokenAnchorStatus.mockRejectedValueOnce(
      new Error("anchor read down"),
    );
    contractMocks.fetchContractOffersForTokenId.mockResolvedValueOnce([]);
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    const market = await getTokenMarket("random-walk", 9);

    expect(market.token.tokenId).toBe(9);
    expect(market.token.anchored).toBeUndefined();
  });

  it("serves token markets with empty offers when the contract read fails", async () => {
    contractMocks.fetchContractOffersForTokenId.mockRejectedValueOnce(
      new Error("contract read down"),
    );
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    await expect(getTokenMarket("random-walk", 9)).resolves.toMatchObject({
      token: { tokenId: 9 },
      offers: [],
    });
  });

  it("caches per-token offer reads in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("fetch", routedFetchMock(randomWalkApiRoutes()));

    try {
      contractMocks.fetchContractOffersForTokenId.mockRejectedValueOnce(
        new Error("first read failed"),
      );
      // A failed read must not poison the cache.
      await expect(getOffersForToken("random-walk", 7)).rejects.toThrow(
        "first read failed",
      );

      contractMocks.fetchContractOffersForTokenId.mockResolvedValue([
        baseOffers[0],
      ]);
      await expect(getOffersForToken("random-walk", 7)).resolves.toEqual([
        baseOffers[0],
      ]);
      await expect(getOffersForToken("random-walk", 7)).resolves.toEqual([
        baseOffers[0],
      ]);

      // One failed and one successful fetch; the third call hit the cache.
      expect(
        contractMocks.fetchContractOffersForTokenId,
      ).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reads token markets, offers, and metadata fallback through query helpers", async () => {
    const cosmicMetadata = {
      image: "cosmic.png",
      name: "Cosmic Signature #10",
      properties: {
        owner: "0x0000000000000000000000000000000000000003",
        seed: "seed",
        token_id: 10,
      },
    };
    const fetchMock = routedFetchMock([
      // Token 10 falls back to static metadata when the API is down. This
      // route must precede the generic Random Walk routes below.
      [
        /\/api\/randomwalk\/tokens\/(?:info|history)\/10(?:$|\/)/,
        () => new Response("", { status: 503 }),
      ],
      // Other Random Walk tokens (token 9) resolve through the Go API.
      ...randomWalkApiRoutes(),
      [
        /randomwalknft-api\.com\/metadata\/10$/,
        () => jsonResponse({ properties: { seed: "fallback" } }),
      ],
      // Cosmic Signature 10: metadata resolves, the API is down.
      [
        /nfts\.cosmicsignature\.com\/metadata\/10$/,
        () => jsonResponse(cosmicMetadata),
      ],
      [/\/api\/cosmicgame\//, () => new Response("", { status: 503 })],
    ]);
    contractMocks.fetchContractOffersForTokenId.mockResolvedValue([
      baseOffers[1],
    ]);
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTokenMarket("random-walk", 9)).resolves.toMatchObject({
      token: { tokenId: 9, seed: "seed-9" },
    });
    await expect(getOffersForToken("random-walk", 9)).resolves.toHaveLength(1);
    await expect(getToken("random-walk", 10)).resolves.toMatchObject({
      seed: "fallback",
    });
    await expect(getToken("cosmic-signature", 10)).resolves.toMatchObject({
      collectionId: "cosmic-signature",
      tokenId: 10,
      seed: "seed",
      owner: "0x0000000000000000000000000000000000000003",
    });
    await expect(getOffersForToken("cosmic-signature", 10)).resolves.toEqual([
      baseOffers[1],
    ]);
    await expect(getTokenMarket("cosmic-signature", 10)).resolves.toMatchObject(
      {
        token: { collectionId: "cosmic-signature", tokenId: 10 },
        offers: [baseOffers[1]],
      },
    );
    expect(contractMocks.fetchContractOffersForTokenId).toHaveBeenCalledTimes(
      4,
    );
    expect(contractMocks.fetchContractOffersForTokenId).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionId: "random-walk",
        tokenId: 9,
      }),
    );
    expect(contractMocks.fetchContractOffersForTokenId).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionId: "cosmic-signature",
        tokenId: 10,
      }),
    );
  });
});
