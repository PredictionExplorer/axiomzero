import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cosmicSignatureImageUrl,
  cosmicSignatureThumbUrl,
  fetchCosmicSignatureMetadata,
  tokenFromCosmicSignatureMetadata,
} from "@/lib/marketplace/cosmic-signature-live";

const metadata = {
  animation_url:
    "https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce.mp4",
  attributes: [
    { display_type: "number", trait_type: "Round", value: 0 },
    { display_type: "date", trait_type: "Imprinted", value: 1781506802 },
    {
      trait_type: "seed",
      value:
        "36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce",
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
      seed:
        "36794583b610f71be4a51d19a01af5bfe05b673c31d86f3f0c3310c3e4261fce",
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
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(metadata)),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCosmicSignatureMetadata(1)).resolves.toMatchObject({
      tokenId: 1,
      name: "NUMBA 1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://nfts.cosmicsignature.com/metadata/1",
      { next: { revalidate: 60 } },
    );
  });

  it("surfaces failed metadata fetches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );

    await expect(fetchCosmicSignatureMetadata(1)).rejects.toThrow(
      "Cosmic Signature metadata returned 503.",
    );
  });
});
