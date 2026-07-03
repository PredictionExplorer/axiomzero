import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchCollectionContractOffers,
  fetchContractOffersForTokenId,
  normalizeContractOffer,
  resetMarketplaceOfferScanCacheForTests,
  type MarketplaceOfferTuple,
} from "@/lib/marketplace/marketplace-contract-live";
import { randomWalkTokenPreview } from "@/lib/marketplace/random-walk-live";

const cosmicNft = "0xbb84Be3500A63581d3F2d5AC3bdF8685AAedad25" as const;
const otherNft = "0x895a6F444BE4ba9d124F61DF736605792B35D66b" as const;
const marketplace = "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08" as const;
const zero = "0x0000000000000000000000000000000000000000" as const;
const seller = "0x0000000000000000000000000000000000000001" as const;
const buyer = "0x0000000000000000000000000000000000000002" as const;

function offer(
  overrides: Partial<{
    nftAddress: `0x${string}`;
    tokenId: bigint;
    price: bigint;
    seller: `0x${string}`;
    buyer: `0x${string}`;
    active: boolean;
  }> = {},
): MarketplaceOfferTuple {
  return [
    overrides.nftAddress ?? cosmicNft,
    overrides.tokenId ?? 1n,
    overrides.price ?? 1_000_000_000_000_000_000n,
    overrides.seller ?? seller,
    overrides.buyer ?? zero,
    overrides.active ?? true,
  ];
}

function mockClient(offers: Record<number, MarketplaceOfferTuple>) {
  const readContract = vi.fn(async (call: { functionName: string }) => {
    if (call.functionName === "numOffers") {
      return BigInt(Object.keys(offers).length);
    }

    if (call.functionName === "getSellOffers") {
      return [0n];
    }

    if (call.functionName === "getBuyOffers") {
      return [1n];
    }

    throw new Error(`Unexpected read ${call.functionName}`);
  });
  const multicall = vi.fn(
    async (call: {
      contracts: readonly {
        args?: readonly unknown[];
        functionName: string;
      }[];
    }) =>
      call.contracts.map((contract) => {
        const result = offers[Number(contract.args?.[0])];
        return result
          ? ({ status: "success", result } as const)
          : ({ status: "failure", error: new Error("missing") } as const);
      }),
  );

  return { readContract, multicall };
}

describe("marketplace contract live adapter", () => {
  beforeEach(() => {
    resetMarketplaceOfferScanCacheForTests();
  });

  it("normalizes active sell and buy offers", () => {
    expect(
      normalizeContractOffer(3, offer(), "cosmic-signature", {
        image: "art.png",
        alt: "Cosmic Signature #1 artwork",
      }),
    ).toMatchObject({
      id: "cosmic-signature-sell-3",
      offerId: 3,
      collectionId: "cosmic-signature",
      tokenId: 1,
      kind: "sell",
      priceEth: 1,
      maker: seller,
      taker: zero,
      artwork: { image: "art.png" },
    });

    expect(
      normalizeContractOffer(
        4,
        offer({ seller: zero, buyer, price: 500_000_000_000_000_000n }),
        "cosmic-signature",
      ),
    ).toMatchObject({
      id: "cosmic-signature-buy-4",
      offerId: 4,
      kind: "buy",
      priceEth: 0.5,
      maker: buyer,
      taker: zero,
    });
  });

  it("drops inactive, free, and ambiguous offers", () => {
    expect(
      normalizeContractOffer(1, offer({ active: false }), "cosmic-signature"),
    ).toBeUndefined();
    expect(
      normalizeContractOffer(1, offer({ price: 0n }), "cosmic-signature"),
    ).toBeUndefined();
    expect(
      normalizeContractOffer(1, offer({ seller, buyer }), "cosmic-signature"),
    ).toBeUndefined();
  });

  it("reads token-specific sell and buy offer IDs before normalizing", async () => {
    const client = mockClient({
      0: offer({ tokenId: 7n }),
      1: offer({ tokenId: 7n, seller: zero, buyer }),
    });

    const offers = await fetchContractOffersForTokenId({
      collectionId: "cosmic-signature",
      nftAddress: cosmicNft,
      marketplaceAddress: marketplace,
      tokenId: 7,
      artwork: { image: "token.png", alt: "Cosmic Signature #7 artwork" },
      client,
    });

    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getSellOffers",
        args: [cosmicNft, 7n],
      }),
    );
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getBuyOffers",
        args: [cosmicNft, 7n],
      }),
    );
    expect(offers.map((marketOffer) => marketOffer.kind)).toEqual([
      "sell",
      "buy",
    ]);
    expect(offers[0]?.artwork?.image).toBe("token.png");
  });

  it("scans marketplace offers and keeps active offers for the target collection", async () => {
    const client = mockClient({
      0: offer({ tokenId: 1n }),
      1: offer({ tokenId: 2n, seller: zero, buyer }),
      2: offer({ tokenId: 3n, active: false }),
      3: offer({ nftAddress: otherNft, tokenId: 4n }),
    });
    const loadToken = vi.fn(async (tokenId: number) => ({
      collectionId: "cosmic-signature" as const,
      tokenId,
      name: `Cosmic Signature #${tokenId}`,
      owner: zero,
      seed: "seed",
      traits: [],
      artwork: {
        image: `token-${tokenId}.png`,
        alt: `Cosmic Signature #${tokenId} artwork`,
      },
    }));

    const offers = await fetchCollectionContractOffers({
      collectionId: "cosmic-signature",
      nftAddress: cosmicNft,
      marketplaceAddress: marketplace,
      loadToken,
      client,
    });

    expect(offers.map((marketOffer) => marketOffer.tokenId)).toEqual([1, 2]);
    expect(offers.map((marketOffer) => marketOffer.artwork?.image)).toEqual([
      "token-1.png",
      "token-2.png",
    ]);
    expect(loadToken).toHaveBeenCalledTimes(2);
  });

  it("scans Random Walk offers by NFT address and attaches deterministic previews", async () => {
    const client = mockClient({
      0: offer({ nftAddress: otherNft, tokenId: 1233n }),
      1: offer({ nftAddress: cosmicNft, tokenId: 2n, seller: zero, buyer }),
    });
    const loadToken = vi.fn(async (tokenId: number) =>
      randomWalkTokenPreview(tokenId),
    );

    const offers = await fetchCollectionContractOffers({
      collectionId: "random-walk",
      nftAddress: otherNft,
      marketplaceAddress: marketplace,
      loadToken,
      client,
    });

    expect(offers).toEqual([
      expect.objectContaining({
        id: "random-walk-sell-0",
        collectionId: "random-walk",
        tokenId: 1233,
        artwork: expect.objectContaining({
          image:
            "https://api.randomwalknft.com:1443/images/randomwalk/001233_black_thumb.jpg",
        }),
      }),
    ]);
    expect(loadToken).toHaveBeenCalledWith(1233);
  });

  it("shares one raw marketplace scan across both collections", async () => {
    const client = mockClient({
      0: offer({ nftAddress: cosmicNft, tokenId: 1n }),
      1: offer({ nftAddress: otherNft, tokenId: 1233n }),
    });

    const [cosmicOffers, randomWalkOffers] = await Promise.all([
      fetchCollectionContractOffers({
        collectionId: "cosmic-signature",
        nftAddress: cosmicNft,
        marketplaceAddress: marketplace,
        client,
      }),
      fetchCollectionContractOffers({
        collectionId: "random-walk",
        nftAddress: otherNft,
        marketplaceAddress: marketplace,
        client,
      }),
    ]);

    expect(cosmicOffers.map((marketOffer) => marketOffer.tokenId)).toEqual([
      1,
    ]);
    expect(randomWalkOffers.map((marketOffer) => marketOffer.tokenId)).toEqual(
      [1233],
    );
    // numOffers and the offer multicall each ran once for both collections.
    expect(client.readContract).toHaveBeenCalledTimes(1);
    expect(client.multicall).toHaveBeenCalledTimes(1);
  });

  it("returns no offers for an empty marketplace", async () => {
    const client = mockClient({});

    await expect(
      fetchCollectionContractOffers({
        collectionId: "cosmic-signature",
        nftAddress: cosmicNft,
        marketplaceAddress: marketplace,
        client,
      }),
    ).resolves.toEqual([]);
  });

  it("throws instead of resolving empty when every offer read fails", async () => {
    const readContract = vi.fn(async () => 3n);
    const multicall = vi.fn(
      async (call: { contracts: readonly unknown[] }) =>
        call.contracts.map(
          () =>
            ({
              status: "failure",
              error: new Error("rate limited"),
            }) as const,
        ),
    );

    await expect(
      fetchCollectionContractOffers({
        collectionId: "cosmic-signature",
        nftAddress: cosmicNft,
        marketplaceAddress: marketplace,
        client: { readContract, multicall },
      }),
    ).rejects.toThrow(/offer scan failed/i);
  });

  it("respects the collection scan limit", async () => {
    const client = mockClient({
      0: offer({ tokenId: 1n }),
      1: offer({ tokenId: 2n }),
      2: offer({ tokenId: 3n }),
    });

    await fetchCollectionContractOffers({
      collectionId: "cosmic-signature",
      nftAddress: cosmicNft,
      marketplaceAddress: marketplace,
      maxOffers: 2,
      client,
    });

    expect(client.multicall).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: [
          expect.objectContaining({ args: [1n] }),
          expect.objectContaining({ args: [2n] }),
        ],
      }),
    );
  });
});
