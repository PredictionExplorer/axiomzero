import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchCosmicSignatureOffers,
  fetchCosmicSignatureSales,
} from "@/lib/marketplace/cosmic-signature-market-live";
import {
  COSMIC_SIGNATURE_API,
  goApiErrorResponse,
  jsonResponse,
  routedFetchMock,
} from "../helpers/go-api-fixtures";

const SELLER = "0xe7eD7F31cd76CeD85861ec5bD37879cBA053e887";
const BUYER = "0x7406B34d25A9B7841CAC133E3173919e0af6Bc6c";
const ZERO = "0x0000000000000000000000000000000000000000";

function offersResponse(offers: unknown[]) {
  return { status: 1, error: "", Offers: offers, NftAid: 960, MarketAid: 1 };
}

describe("cosmic signature market adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps active sell and buy offers without artwork", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/cosmicgame\/marketplace\/current_offers\/\d+$/,
          () =>
            jsonResponse(
              offersResponse([
                {
                  OfferId: 452,
                  OfferType: 1,
                  SellerAddr: SELLER,
                  BuyerAddr: ZERO,
                  TokenId: 22,
                  Active: true,
                  Price: 0.475,
                  TimeStamp: 1782000000,
                },
                {
                  OfferId: 457,
                  OfferType: 0,
                  SellerAddr: ZERO,
                  BuyerAddr: BUYER,
                  TokenId: 11,
                  Active: true,
                  Price: 0.16,
                  TimeStamp: 1782100000,
                },
              ]),
            ),
        ],
      ]),
    );

    const offers = await fetchCosmicSignatureOffers();

    expect(offers).toEqual([
      expect.objectContaining({
        id: "cosmic-signature-sell-452",
        collectionId: "cosmic-signature",
        kind: "sell",
        tokenId: 22,
        priceEth: 0.475,
        maker: SELLER,
        active: true,
        createdAt: new Date(1782000000 * 1000).toISOString(),
      }),
      expect.objectContaining({
        id: "cosmic-signature-buy-457",
        kind: "buy",
        tokenId: 11,
        priceEth: 0.16,
        maker: BUYER,
      }),
    ]);
    // Artwork is attached by the caller (seed-derived), never by the adapter.
    expect(offers[0]?.artwork).toBeUndefined();
  });

  it("drops inactive, zero-price, and maker-less offers", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/cosmicgame\/marketplace\/current_offers\//,
          () =>
            jsonResponse(
              offersResponse([
                { OfferId: 1, OfferType: 1, SellerAddr: SELLER, TokenId: 1, Active: false, Price: 1 },
                { OfferId: 2, OfferType: 1, SellerAddr: SELLER, TokenId: 2, Active: true, Price: 0 },
                { OfferId: 3, OfferType: 1, SellerAddr: ZERO, TokenId: 3, Active: true, Price: 1 },
              ]),
            ),
        ],
      ]),
    );

    await expect(fetchCosmicSignatureOffers()).resolves.toEqual([]);
  });

  it("tolerates a null offers slice and surfaces API errors", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [/current_offers\//, () => jsonResponse(offersResponse(null as unknown as unknown[]))],
      ]),
    );
    await expect(fetchCosmicSignatureOffers()).resolves.toEqual([]);

    vi.stubGlobal(
      "fetch",
      routedFetchMock([[/current_offers\//, () => goApiErrorResponse("boom")]]),
    );
    await expect(fetchCosmicSignatureOffers()).rejects.toThrow(/boom/);
  });

  it("maps completed sales newest-first", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/cosmicgame\/marketplace\/trading\/sales\//,
          () =>
            jsonResponse({
              status: 1,
              error: "",
              Trading: [
                {
                  OfferId: 10,
                  OfferType: 1,
                  SellerAddr: SELLER,
                  BuyerAddr: BUYER,
                  TokenId: 4,
                  Price: 0.3,
                  BlockNum: 100,
                  TimeStamp: 1781000000,
                },
                {
                  OfferId: 11,
                  OfferType: 1,
                  SellerAddr: SELLER,
                  BuyerAddr: BUYER,
                  TokenId: 5,
                  Price: 1.2,
                  BlockNum: 500,
                  TimeStamp: 1781500000,
                },
              ],
            }),
        ],
      ]),
    );

    const sales = await fetchCosmicSignatureSales();

    expect(sales.map((sale) => sale.offerId)).toEqual([11, 10]);
    expect(sales[0]).toMatchObject({
      collectionId: "cosmic-signature",
      tokenId: 5,
      priceEth: 1.2,
      seller: SELLER,
      buyer: BUYER,
      blockNumber: 500,
      soldAt: new Date(1781500000 * 1000).toISOString(),
    });
  });

  it("builds URLs against the configured Cosmic Signature host", async () => {
    const fetchMock = routedFetchMock([
      [/current_offers\//, () => jsonResponse(offersResponse([]))],
    ]);
    vi.stubGlobal("fetch", fetchMock);

    await fetchCosmicSignatureOffers();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${COSMIC_SIGNATURE_API}/api/cosmicgame/marketplace/current_offers/0`,
    );
  });
});
