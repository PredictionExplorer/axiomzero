import { describe, expect, it } from "vitest";

import {
  buildTokenMediaModel,
  formatHistoryRecords,
  parseTokenDetailState,
  sortOffersForDisplay,
  tokenDetailHref,
} from "@/lib/marketplace/token-detail";
import type { MarketOffer, MarketToken } from "@/lib/marketplace/types";

function token(overrides: Partial<MarketToken> = {}): MarketToken {
  return {
    collectionId: "cosmic-signature",
    tokenId: 19,
    name: "NUMBA 19",
    owner: "0x0000000000000000000000000000000000000001",
    seed: "seed",
    traits: [{ label: "Round", value: "4" }],
    artwork: {
      image: "black.png",
      alt: "Token artwork",
    },
    assets: {
      blackImage: "black.png",
      whiteImage: "black.png",
      blackSingleVideo: "single.mp4",
      whiteSingleVideo: "single.mp4",
    },
    ...overrides,
  };
}

function offer(overrides: Partial<MarketOffer>): MarketOffer {
  return {
    id: "offer",
    collectionId: "random-walk",
    tokenId: 1,
    kind: "sell",
    priceEth: 1,
    maker: "0x0000000000000000000000000000000000000001",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("token detail helpers", () => {
  it("parses supported query params and falls back for unknown values", () => {
    expect(
      parseTokenDetailState({
        theme: "white",
        media: "triple",
        tab: "history",
      }),
    ).toEqual({ theme: "white", media: "triple", tab: "history" });
    expect(
      parseTokenDetailState({
        theme: "sepia",
        media: "cinema",
        tab: "activity",
      }),
    ).toEqual({ theme: "black", media: "image", tab: "market" });
  });

  it("hides non-meaningful Cosmic Signature light and triple controls", () => {
    const model = buildTokenMediaModel("cosmic-signature", token(), {
      theme: "white",
      media: "triple",
      tab: "market",
    });

    expect(model.state).toEqual({
      theme: "black",
      media: "image",
      tab: "market",
    });
    expect(model.selectedMedia).toMatchObject({
      type: "image",
      src: "black.png",
      unavailableMessage:
        "Triple video is not available for this token yet. Showing the still image instead.",
    });
    expect(model.themeOptions.map((option) => option.label)).toEqual(["Dark"]);
    expect(model.mediaOptions.map((option) => option.label)).toEqual([
      "Image",
      "Single video",
    ]);
  });

  it("exposes Random Walk theme and video modes from normalized assets", () => {
    const model = buildTokenMediaModel(
      "random-walk",
      token({
        collectionId: "random-walk",
        tokenId: 1233,
        name: "Random Walk #001233",
        assets: {
          blackImage: "black.png",
          whiteImage: "white.png",
          blackSingleVideo: "black-single.mp4",
          blackTripleVideo: "black-triple.mp4",
          whiteSingleVideo: "white-single.mp4",
          whiteTripleVideo: "white-triple.mp4",
        },
      }),
      { theme: "white", media: "triple", tab: "notes" },
    );

    expect(model.state).toEqual({
      theme: "white",
      media: "triple",
      tab: "notes",
    });
    expect(model.selectedMedia).toMatchObject({
      type: "video",
      src: "white-triple.mp4",
    });
    expect(model.themeOptions.map((option) => option.label)).toEqual([
      "Dark",
      "Light",
    ]);
    expect(model.mediaOptions.map((option) => option.label)).toEqual([
      "Image",
      "Single video",
      "Triple video",
    ]);
  });

  it("builds state-preserving detail hrefs", () => {
    expect(
      tokenDetailHref(
        "random-walk",
        7,
        { theme: "white", media: "single", tab: "history" },
        { media: "image" },
      ),
    ).toBe("/token/random-walk/7?theme=white&media=image&tab=history");
  });

  it("formats history and offer ordering for display", () => {
    const records = formatHistoryRecords([
      {
        recordType: 2,
        blockNumber: 10,
        timestamp: 100,
        dateTime: "2026-01-01T00:00:00.000Z",
        seller: "0x0000000000000000000000000000000000000001",
        buyer: "0x0000000000000000000000000000000000000002",
        price: 0.5,
      },
    ]);

    expect(records[0]).toMatchObject({
      title: "Sale",
      subtitle: "0x0000...0001 to 0x0000...0002",
      price: "0.5000 ETH",
    });
    expect(
      sortOffersForDisplay(
        [
          offer({ id: "low", kind: "buy", priceEth: 0.1 }),
          offer({
            id: "inactive-high",
            kind: "buy",
            priceEth: 10,
            active: false,
          }),
          offer({ id: "high", kind: "buy", priceEth: 2 }),
        ],
        "buy",
      ).map((sortedOffer) => sortedOffer.id),
    ).toEqual(["high", "low"]);
    expect(
      sortOffersForDisplay(
        [
          offer({ id: "expensive", kind: "sell", priceEth: 2 }),
          offer({
            id: "inactive-cheap",
            kind: "sell",
            priceEth: 0.01,
            active: false,
          }),
          offer({ id: "cheap", kind: "sell", priceEth: 1 }),
        ],
        "sell",
      ).map((sortedOffer) => sortedOffer.id),
    ).toEqual(["cheap", "expensive"]);
  });
});
