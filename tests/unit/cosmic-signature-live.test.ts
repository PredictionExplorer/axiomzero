import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cosmicSignatureImageUrl,
  cosmicSignatureThumbUrl,
  fetchCosmicSignatureMetadata,
  fetchCosmicSignatureTokenDetail,
  fetchCosmicSignatureTokenHistory,
  fetchCosmicSignatureTokenIds,
  normalizeCosmicSignatureHistory,
  tokenFromCosmicSignatureAppHtml,
  tokenFromCosmicSignatureMetadata,
} from "@/lib/marketplace/cosmic-signature-live";
import {
  cosmicSignatureInfoResponse,
  cosmicSignatureMetadataResponse,
  cosmicSignatureTransfersResponse,
  jsonResponse,
  routedFetchMock,
} from "../helpers/go-api-fixtures";

const metadata = {
  animation_url:
    "https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce.mp4",
  attributes: [
    { display_type: "number", trait_type: "Round", value: 0 },
    { display_type: "date", trait_type: "Imprinted", value: 1781506802 },
    {
      trait_type: "seed",
      value: "36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce",
    },
  ],
  image:
    "https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce.png",
  name: "NUMBA 1",
  properties: {
    owner: "0x30E6E8EEEC88aA8Ea35B54807671458B3F01665e",
    round_num: 0,
    seed: "36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce",
    token_id: 1,
  },
};

describe("Cosmic Signature live data adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps public metadata into a market token", () => {
    const token = tokenFromCosmicSignatureMetadata(1, metadata);

    expect(token).toMatchObject({
      collectionId: "cosmic-signature",
      tokenId: 1,
      name: "NUMBA 1",
      owner: "0x30E6E8EEEC88aA8Ea35B54807671458B3F01665e",
      seed: "36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce",
      artwork: {
        image: metadata.image,
        alt: "Cosmic Signature #1 artwork",
      },
      assets: {
        blackImage: metadata.image,
        blackSingleVideo: metadata.animation_url,
        whiteSingleVideo: metadata.animation_url,
      },
      mintedAt: new Date(1781506802 * 1000).toISOString(),
    });
    expect(token.traits).toEqual([
      { label: "Round", value: "0" },
      { label: "Imprinted", value: new Date(1781506802 * 1000).toISOString() },
      {
        label: "seed",
        value:
          "36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce",
      },
    ]);
  });

  it("builds deterministic image and thumbnail URLs from seeds", () => {
    const seed =
      "0x36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce";

    expect(cosmicSignatureImageUrl(seed)).toBe(
      "https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce.png",
    );
    expect(cosmicSignatureThumbUrl(seed, "white")).toBe(
      "https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce/thumb_white.webp",
    );
  });

  it("uses safe defaults for partial metadata", () => {
    const token = tokenFromCosmicSignatureMetadata(7, {
      attributes: [{ trait_type: undefined, value: undefined }],
      properties: { owner: "not-an-address" },
    });

    expect(token).toMatchObject({
      tokenId: 7,
      name: "Cosmic Signature #7",
      owner: "0x0000000000000000000000000000000000000000",
      seed: "",
      artwork: {
        image: "https://cosmicsignature.com/favicon.ico",
      },
      traits: [{ label: "Trait", value: "" }],
      mintedAt: undefined,
    });
  });

  it("fetches metadata with the Cosmic Signature endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(metadata)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCosmicSignatureMetadata(1)).resolves.toMatchObject({
      tokenId: 1,
      name: "NUMBA 1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://nfts.cosmicsignature.com/metadata/1",
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
  });

  it("builds token metadata from app-page JSON-LD fallback", () => {
    const token = tokenFromCosmicSignatureAppHtml(
      0,
      `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Cosmic Signature NFT #0",
        image:
          "https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x2a345aa3f8a0419fc11cd031c98c49d171f3dd2151d9c06fd327e9254e1db962.png",
      })}</script>`,
    );

    expect(token).toMatchObject({
      tokenId: 0,
      name: "Cosmic Signature NFT #0",
      seed: "2a345aa3f8a0419fc11cd031c98c49d171f3dd2151d9c06fd327e9254e1db962",
      artwork: {
        image:
          "https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x2a345aa3f8a0419fc11cd031c98c49d171f3dd2151d9c06fd327e9254e1db962.png",
      },
      assets: {
        blackSingleVideo:
          "https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x2a345aa3f8a0419fc11cd031c98c49d171f3dd2151d9c06fd327e9254e1db962.mp4",
      },
    });
  });

  it("falls back to app-page metadata when the JSON endpoint is broken", async () => {
    const appHtml = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "Cosmic Signature NFT #0",
      image:
        "https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x2a345aa3f8a0419fc11cd031c98c49d171f3dd2151d9c06fd327e9254e1db962.png",
    })}</script>`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 400 }))
      .mockResolvedValueOnce(new Response(appHtml));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCosmicSignatureMetadata(0)).resolves.toMatchObject({
      tokenId: 0,
      seed: "2a345aa3f8a0419fc11cd031c98c49d171f3dd2151d9c06fd327e9254e1db962",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://app.cosmicsignature.com/detail/0",
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
  });

  it("surfaces not found metadata responses without app fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );

    await expect(fetchCosmicSignatureMetadata(1)).rejects.toThrow(
      "Cosmic Signature metadata returned 404.",
    );
  });

  it("normalizes newest-first transfers into chronological mint and transfer records", () => {
    const history = normalizeCosmicSignatureHistory(
      cosmicSignatureTransfersResponse(5).TokenTransfers,
    );

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      kind: "mint",
      timestamp: 1781506802,
      dateTime: "2026-06-15T07:00:02Z",
      owner: "0x30E6E8EEEC88aA8Ea35B54807671458B3F01665e",
      to: "0x30E6E8EEEC88aA8Ea35B54807671458B3F01665e",
      from: undefined,
    });
    expect(history[1]).toMatchObject({
      kind: "transfer",
      timestamp: 1781712122,
      from: "0x30E6E8EEEC88aA8Ea35B54807671458B3F01665e",
      to: "0x6308A405B4FF1eA890870Efe2a6D036750B81F7C",
    });
  });

  it("fetches token history from cst/transfers", async () => {
    const fetchMock = routedFetchMock([
      [
        /\/api\/cosmicgame\/cst\/transfers\/all\/5\/0\/1000$/,
        () => jsonResponse(cosmicSignatureTransfersResponse(5)),
      ],
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const history = await fetchCosmicSignatureTokenHistory(5);

    expect(history.map((record) => record.kind)).toEqual([
      "mint",
      "transfer",
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://nfts.cosmicsignature.com/api/cosmicgame/cst/transfers/all/5/0/1000",
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
  });

  it("composes token detail from metadata, cst/info, and transfers", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/metadata\/5$/,
          () => jsonResponse(cosmicSignatureMetadataResponse(5)),
        ],
        [
          /\/api\/cosmicgame\/cst\/info\/5$/,
          () => jsonResponse(cosmicSignatureInfoResponse(5)),
        ],
        [
          /\/api\/cosmicgame\/cst\/transfers\/all\/5\//,
          () => jsonResponse(cosmicSignatureTransfersResponse(5)),
        ],
      ]),
    );

    const token = await fetchCosmicSignatureTokenDetail(5);

    expect(token).toMatchObject({
      collectionId: "cosmic-signature",
      tokenId: 5,
      name: "Cosmic Signature #5",
      // cst/info is authoritative for the current owner.
      owner: "0x6308A405B4FF1eA890870Efe2a6D036750B81F7C",
      seed: "e29887e5f8aea85d6b775ab8dc95df16a5a0ad2979ace2b539058a0040aca67d",
      mintedAt: "2026-06-15T07:00:02Z",
    });
    expect(token.tokenHistory?.map((record) => record.kind)).toEqual([
      "mint",
      "transfer",
    ]);
    expect(token.traits).toEqual(
      expect.arrayContaining([{ label: "Staked", value: "Yes" }]),
    );
  });

  it("keeps metadata ownership when cst/info is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/metadata\/5$/,
          () => jsonResponse(cosmicSignatureMetadataResponse(5)),
        ],
        [
          /\/api\/cosmicgame\/cst\/info\/5$/,
          () => new Response("", { status: 503 }),
        ],
        [
          /\/api\/cosmicgame\/cst\/transfers\/all\/5\//,
          () => new Response("", { status: 503 }),
        ],
      ]),
    );

    const token = await fetchCosmicSignatureTokenDetail(5);

    expect(token.owner).toBe("0x6308A405B4FF1eA890870Efe2a6D036750B81F7C");
    expect(token.tokenHistory).toBeUndefined();
    // The Imprinted metadata attribute still supplies the mint date.
    expect(token.mintedAt).toBe(new Date(1781506802 * 1000).toISOString());
  });

  it("builds an API-only token when every metadata source fails", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [/\/metadata\/5$/, () => new Response("", { status: 500 })],
        [
          /app\.cosmicsignature\.com\/detail\/5$/,
          () => new Response("", { status: 500 }),
        ],
        [
          /\/api\/cosmicgame\/cst\/info\/5$/,
          () => jsonResponse(cosmicSignatureInfoResponse(5)),
        ],
        [
          /\/api\/cosmicgame\/cst\/transfers\/all\/5\//,
          () => jsonResponse(cosmicSignatureTransfersResponse(5)),
        ],
      ]),
    );

    const token = await fetchCosmicSignatureTokenDetail(5);

    expect(token).toMatchObject({
      tokenId: 5,
      name: "Cosmic Signature #5",
      owner: "0x6308A405B4FF1eA890870Efe2a6D036750B81F7C",
      artwork: {
        image:
          "https://nfts.cosmicsignature.com/images/new/cosmicsignature/0xe29887e5f8aea85d6b775ab8dc95df16a5a0ad2979ace2b539058a0040aca67d.png",
      },
      mintedAt: "2026-06-15T07:00:02Z",
    });
  });

  it("fails token detail only when metadata and the API are both down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(fetchCosmicSignatureTokenDetail(5)).rejects.toThrow(
      "Cosmic Signature token 5 could not be loaded",
    );
  });

  it("lists minted token ids ascending from cst/list", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/cosmicgame\/cst\/list\/all\/0\/10000$/,
          () =>
            jsonResponse({
              CosmicSignatureTokenList: [
                { TokenId: 23 },
                { TokenId: 22 },
                { TokenId: 0 },
                { TokenId: 22 },
              ],
              error: "",
              status: 1,
            }),
        ],
      ]),
    );

    await expect(fetchCosmicSignatureTokenIds()).resolves.toEqual([0, 22, 23]);
  });

  it("treats a null token list as empty", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/cosmicgame\/cst\/list\/all\//,
          () =>
            jsonResponse({
              CosmicSignatureTokenList: null,
              error: "",
              status: 1,
            }),
        ],
      ]),
    );

    await expect(fetchCosmicSignatureTokenIds()).resolves.toEqual([]);
  });
});
