import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchRandomWalkOffers,
  fetchRandomWalkSales,
  fetchRandomWalkTokenIds,
  fetchRandomWalkTokensByUser,
} from "@/lib/marketplace/random-walk-market-live";
import {
  RANDOM_WALK_API,
  goApiErrorResponse,
  jsonResponse,
  routedFetchMock,
} from "../helpers/go-api-fixtures";

const SELLER = "0x3CD1a28Be614136e26F867c9fE47821Fcf6dc7f6";
const BUYER = "0xbC9f202d46fC4c6F3BdDd50eB43642C81bCe371c";
const ZERO = "0x0000000000000000000000000000000000000000";
const OWNER = "0xcc9C0DDF13EB1853185A51296FcEBec103b466e1";

function offersResponse(offers: unknown[]) {
  return { status: 1, error: "", Offers: offers, RWalkAid: 2, MarketAid: 1 };
}

describe("random walk market adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps active sell and buy offers with deterministic previews", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/randomwalk\/current_offers\/\d+$/,
          () =>
            jsonResponse(
              offersResponse([
                {
                  OfferId: 12,
                  OfferType: 1,
                  SellerAddr: SELLER,
                  BuyerAddr: ZERO,
                  TokenId: 1233,
                  Active: true,
                  Price: 0.1,
                  TimeStamp: 1636688251,
                },
                {
                  OfferId: 346,
                  OfferType: 0,
                  SellerAddr: ZERO,
                  BuyerAddr: BUYER,
                  TokenId: 1233,
                  Active: true,
                  Price: 0.001,
                  TimeStamp: 1668168199,
                },
              ]),
            ),
        ],
      ]),
    );

    const offers = await fetchRandomWalkOffers();

    expect(offers).toEqual([
      expect.objectContaining({
        id: "random-walk-sell-12",
        offerId: 12,
        collectionId: "random-walk",
        tokenId: 1233,
        kind: "sell",
        priceEth: 0.1,
        maker: SELLER,
        taker: undefined,
        active: true,
        createdAt: new Date(1636688251 * 1000).toISOString(),
      }),
      expect.objectContaining({
        id: "random-walk-buy-346",
        kind: "buy",
        maker: BUYER,
        priceEth: 0.001,
      }),
    ]);
    expect(offers[0]?.artwork?.image).toContain("001233_black_thumb.jpg");
  });

  it("drops inactive, canceled, zero-price, and maker-less offers", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/randomwalk\/current_offers\//,
          () =>
            jsonResponse(
              offersResponse([
                { OfferId: 1, OfferType: 1, SellerAddr: SELLER, TokenId: 1, Active: false, Price: 1 },
                { OfferId: 2, OfferType: 1, SellerAddr: SELLER, TokenId: 2, Active: true, Price: 1, WasCanceled: true },
                { OfferId: 3, OfferType: 1, SellerAddr: SELLER, TokenId: 3, Active: true, Price: 0 },
                { OfferId: 4, OfferType: 1, SellerAddr: ZERO, TokenId: 4, Active: true, Price: 1 },
              ]),
            ),
        ],
      ]),
    );

    await expect(fetchRandomWalkOffers()).resolves.toEqual([]);
  });

  it("tolerates a null offers slice", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [/\/api\/randomwalk\/current_offers\//, () => jsonResponse(offersResponse(null as unknown as unknown[]))],
      ]),
    );

    await expect(fetchRandomWalkOffers()).resolves.toEqual([]);
  });

  it("surfaces Go API error envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [/\/api\/randomwalk\/current_offers\//, () => goApiErrorResponse("boom")],
      ]),
    );

    await expect(fetchRandomWalkOffers()).rejects.toThrow(/boom/);
  });

  it("maps completed sales newest-first with sold timestamps", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/randomwalk\/trading\/sales\//,
          () =>
            jsonResponse({
              status: 1,
              error: "",
              Trading: [
                {
                  OfferId: 188,
                  OfferType: 1,
                  SellerAddr: SELLER,
                  BuyerAddr: BUYER,
                  TokenId: 13,
                  Price: 0.0525,
                  BlockNum: 3544465,
                  TimeStamp: 1638566745,
                },
                {
                  OfferId: 400,
                  OfferType: 1,
                  SellerAddr: SELLER,
                  BuyerAddr: BUYER,
                  TokenId: 21,
                  Price: 1.5,
                  BlockNum: 9000000,
                  TimeStamp: 1700000000,
                },
              ],
            }),
        ],
      ]),
    );

    const sales = await fetchRandomWalkSales();

    expect(sales.map((sale) => sale.offerId)).toEqual([400, 188]);
    expect(sales[0]).toMatchObject({
      collectionId: "random-walk",
      tokenId: 21,
      priceEth: 1.5,
      seller: SELLER,
      buyer: BUYER,
      blockNumber: 9000000,
      soldAt: new Date(1700000000 * 1000).toISOString(),
    });
  });

  it("reads and de-duplicates the minted token index", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/randomwalk\/tokens\/list\/sequential$/,
          () =>
            jsonResponse({
              status: 1,
              error: "",
              MintedTokens: [{ TokenId: 5 }, { TokenId: 0 }, { TokenId: 5 }, { TokenId: 2 }],
            }),
        ],
      ]),
    );

    await expect(fetchRandomWalkTokenIds()).resolves.toEqual([0, 2, 5]);
  });

  it("reads a user's owned token ids via a raw address", async () => {
    const fetchMock = routedFetchMock([
      [
        /\/api\/randomwalk\/tokens\/by_user\/(0x[0-9a-fA-F]+)$/,
        () =>
          jsonResponse({
            status: 1,
            error: "",
            UserTokens: [{ TokenId: 9 }, { TokenId: 1 }],
            UserAddr: OWNER,
          }),
      ],
    ]);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRandomWalkTokensByUser(OWNER)).resolves.toEqual([1, 9]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${RANDOM_WALK_API}/api/randomwalk/tokens/by_user/${OWNER}`,
    );
  });
});
