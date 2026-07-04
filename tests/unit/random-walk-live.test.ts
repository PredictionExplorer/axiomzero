import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchRandomWalkMetadata,
  fetchRandomWalkTokenDetail,
  fetchRandomWalkTokenHistory,
  normalizeRandomWalkHistory,
  randomWalkArtwork,
  randomWalkAssets,
  randomWalkTokenPreview,
  tokenFromRandomWalkMetadata,
  type RandomWalkHistoryEntry,
} from "@/lib/marketplace/random-walk-live";
import { GoApiError } from "@/lib/marketplace/go-api";
import {
  emptyRandomWalkHistoryResponse,
  goApiErrorResponse,
  jsonResponse,
  randomWalkInfoResponse,
  randomWalkMarketplaceHistoryRecords,
  randomWalkToken5HistoryResponse,
  routedFetchMock,
} from "../helpers/go-api-fixtures";

describe("Random Walk live data adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the full deterministic media set from the API host", () => {
    expect(randomWalkAssets(5)).toEqual({
      blackImage:
        "https://api.randomwalknft.com:1443/images/randomwalk/000005_black.png",
      blackThumb:
        "https://api.randomwalknft.com:1443/images/randomwalk/000005_black_thumb.jpg",
      blackSingleVideo:
        "https://api.randomwalknft.com:1443/images/randomwalk/000005_black_single.mp4",
      blackTripleVideo:
        "https://api.randomwalknft.com:1443/images/randomwalk/000005_black_triple.mp4",
      whiteImage:
        "https://api.randomwalknft.com:1443/images/randomwalk/000005_white.png",
      whiteThumb:
        "https://api.randomwalknft.com:1443/images/randomwalk/000005_white_thumb.jpg",
      whiteSingleVideo:
        "https://api.randomwalknft.com:1443/images/randomwalk/000005_white_single.mp4",
      whiteTripleVideo:
        "https://api.randomwalknft.com:1443/images/randomwalk/000005_white_triple.mp4",
    });
  });

  it("builds deterministic artwork and preview tokens without fetching", () => {
    expect(randomWalkArtwork(7)).toEqual({
      image:
        "https://api.randomwalknft.com:1443/images/randomwalk/000007_black_thumb.jpg",
      alt: "Random Walk #000007 artwork",
    });
    expect(randomWalkTokenPreview(7)).toMatchObject({
      collectionId: "random-walk",
      tokenId: 7,
      name: "Random Walk #000007",
      owner: "0x0000000000000000000000000000000000000000",
      seed: "",
      artwork: {
        image:
          "https://api.randomwalknft.com:1443/images/randomwalk/000007_black_thumb.jpg",
      },
    });
  });

  it("fetches token detail from tokens/info and tokens/history", async () => {
    const fetchMock = routedFetchMock([
      [
        /\/api\/randomwalk\/tokens\/info\/5$/,
        () => jsonResponse(randomWalkInfoResponse(5)),
      ],
      [
        /\/api\/randomwalk\/tokens\/history\/5\/0\/1000$/,
        () => jsonResponse(randomWalkToken5HistoryResponse),
      ],
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const token = await fetchRandomWalkTokenDetail(5);

    expect(token).toMatchObject({
      collectionId: "random-walk",
      tokenId: 5,
      name: "Random Walk #000005",
      owner: "0xcc9C0DDF13EB1853185A51296FcEBec103b466e1",
      seed: "86e6b608f61e95788b010714a97479e0520c5c20f2b70e26f267730d14a68030",
      mintedAt: "2021-11-12T00:00:17Z",
    });
    expect(token.assets?.whiteTripleVideo).toBe(
      "https://api.randomwalknft.com:1443/images/randomwalk/000005_white_triple.mp4",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.randomwalknft.com:1443/api/randomwalk/tokens/info/5",
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
  });

  it("normalizes the mint and price-less transfer history of token 5", async () => {
    // Regression: the transfer record carries no price. The scraped RSC
    // payload used to serialize it as the string "$undefined" and fail
    // validation, silently degrading the whole token to zero-owner metadata.
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/tokens\/history\/5\//,
          () => jsonResponse(randomWalkToken5HistoryResponse),
        ],
      ]),
    );

    const history = await fetchRandomWalkTokenHistory(5);

    expect(history).toEqual([
      {
        kind: "mint",
        recordType: 1,
        blockNumber: 2983683,
        timestamp: 1636675217,
        dateTime: "2021-11-12T00:00:17Z",
        owner: "0x6e6092EE787F2FBA1940d0a162aCdcFB2Bbb7Eff",
        seller: undefined,
        buyer: undefined,
        from: undefined,
        to: undefined,
        price: 0.001006618176641971,
        offerId: undefined,
        name: undefined,
      },
      {
        kind: "transfer",
        recordType: 6,
        blockNumber: 49305544,
        timestamp: 1672192433,
        dateTime: "2022-12-28T01:53:53Z",
        owner: undefined,
        seller: undefined,
        buyer: undefined,
        from: "0x6e6092EE787F2FBA1940d0a162aCdcFB2Bbb7Eff",
        to: "0xcc9C0DDF13EB1853185A51296FcEBec103b466e1",
        price: undefined,
        offerId: undefined,
        name: undefined,
      },
    ]);
  });

  it("maps every observed marketplace record type to a semantic kind", () => {
    const normalized = normalizeRandomWalkHistory(
      randomWalkMarketplaceHistoryRecords as RandomWalkHistoryEntry[],
    );

    expect(normalized.map((record) => record.kind)).toEqual([
      "listing",
      "bid",
      "offer-canceled",
      "sale",
      "named",
    ]);
    expect(normalized[0]).toMatchObject({
      seller: "0x3CD1a28Be614136e26F867c9fE47821Fcf6dc7f6",
      buyer: undefined,
      offerId: 12,
      price: 0.1,
    });
    expect(normalized[1]).toMatchObject({
      buyer: "0xbC9f202d46fC4c6F3BdDd50eB43642C81bCe371c",
      seller: undefined,
      offerId: 346,
    });
    expect(normalized[3]).toMatchObject({
      buyer: "0x85140917c4abA6627A824a252426CF25A6D338AD",
      seller: "0xB96113296cE138E30F0Ffa7Ce459bA20f55572f9",
      price: 0.0525,
    });
    expect(normalized[4]).toMatchObject({
      kind: "named",
      name: "1 st Mint",
    });
  });

  it("maps unknown record types to a generic kind instead of failing", () => {
    const normalized = normalizeRandomWalkHistory([
      {
        RecordType: 99,
        Record: {
          BlockNum: 1,
          TimeStamp: 2,
          DateTime: "2026-01-01T00:00:00Z",
        },
      },
    ]);

    expect(normalized[0]).toMatchObject({ kind: "other", recordType: 99 });
  });

  it("keeps custom token names from the API", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/tokens\/info\/0$/,
          () => jsonResponse(randomWalkInfoResponse(0, { CurName: "1 st Mint" })),
        ],
        [
          /\/tokens\/history\/0\//,
          () => jsonResponse(emptyRandomWalkHistoryResponse(0)),
        ],
      ]),
    );

    await expect(fetchRandomWalkTokenDetail(0)).resolves.toMatchObject({
      tokenId: 0,
      name: "1 st Mint",
      mintedAt: undefined,
      tokenHistory: [],
    });
  });

  it("degrades to a history-less token when only the history call fails", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/tokens\/info\/5$/,
          () => jsonResponse(randomWalkInfoResponse(5)),
        ],
        [
          /\/tokens\/history\/5\//,
          () => new Response("", { status: 503 }),
        ],
      ]),
    );

    const token = await fetchRandomWalkTokenDetail(5);

    expect(token.owner).toBe("0xcc9C0DDF13EB1853185A51296FcEBec103b466e1");
    expect(token.tokenHistory).toBeUndefined();
    expect(token.mintedAt).toBeUndefined();
  });

  it("tolerates a null history slice from the Go backend", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/tokens\/history\/9\//,
          () =>
            jsonResponse({
              ...emptyRandomWalkHistoryResponse(9),
              TokenHistory: null,
            }),
        ],
      ]),
    );

    await expect(fetchRandomWalkTokenHistory(9)).resolves.toEqual([]);
  });

  it("surfaces missing tokens with the backend error message", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/tokens\/info\/99999$/,
          () =>
            goApiErrorResponse(
              "Error during query execution: sql: no rows in result set",
            ),
        ],
        [
          /\/tokens\/history\/99999\//,
          () => jsonResponse(emptyRandomWalkHistoryResponse(99999)),
        ],
      ]),
    );

    const failure = await fetchRandomWalkTokenDetail(99999).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(GoApiError);
    expect((failure as GoApiError).httpStatus).toBe(400);
    expect((failure as GoApiError).apiError).toContain("no rows");
  });

  it("rejects envelope failures even when the HTTP status is 200", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/tokens\/info\/1$/,
          () => jsonResponse({ error: "backend exploded", status: 0 }),
        ],
        [
          /\/tokens\/history\/1\//,
          () => jsonResponse(emptyRandomWalkHistoryResponse(1)),
        ],
      ]),
    );

    await expect(fetchRandomWalkTokenDetail(1)).rejects.toThrow(
      "backend exploded",
    );
  });

  it("builds a token from public metadata when the API is unavailable", () => {
    const token = tokenFromRandomWalkMetadata(1271, {
      image:
        "https://nfts.randomwalknft.com/images/randomwalk/001271_black.png",
      name: "Random Walk #001271",
      properties: {
        seed: "663ec50027f5a99f370ed4335dc7be82740ff78c6060e8e0fa898dd9834ce466",
      },
    });

    expect(token).toMatchObject({
      tokenId: 1271,
      name: "Random Walk #001271",
      owner: "0x0000000000000000000000000000000000000000",
      seed: "663ec50027f5a99f370ed4335dc7be82740ff78c6060e8e0fa898dd9834ce466",
      artwork: {
        image:
          "https://nfts.randomwalknft.com/images/randomwalk/001271_black.png",
      },
    });
  });

  it("uses metadata attributes as seed and trait fallback", () => {
    const token = tokenFromRandomWalkMetadata(7, {
      attributes: [
        { trait_type: "seed", value: "from-attributes" },
        { trait_type: undefined, value: undefined },
      ],
    });

    expect(token.seed).toBe("from-attributes");
    expect(token.traits).toEqual([
      { label: "seed", value: "from-attributes" },
      { label: "Trait", value: "" },
    ]);
    expect(token.artwork.image).toBe(
      "https://api.randomwalknft.com:1443/images/randomwalk/000007_black_thumb.jpg",
    );
  });

  it("tries the secondary metadata host before giving up", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(
        jsonResponse({
          name: "Random Walk #000008",
          properties: { seed: "metadata-seed" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRandomWalkMetadata(8)).resolves.toMatchObject({
      tokenId: 8,
      seed: "metadata-seed",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://randomwalknft-api.com/metadata/8",
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.randomwalknft.com:1443/api/randomwalk/metadata/8",
      expect.anything(),
    );
  });

  it("surfaces the last error when every metadata host fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(fetchRandomWalkMetadata(1)).rejects.toThrow(
      "Go API request failed (500)",
    );
  });
});
