import { describe, expect, it } from "vitest";

import {
  collectionMarketHref,
  collectionPath,
  MY_NFTS_PATH,
  tokenPath,
} from "@/lib/marketplace/routes";

describe("marketplace route helpers", () => {
  it("builds public destination paths", () => {
    expect(MY_NFTS_PATH).toBe("/my-nfts");
    expect(collectionPath("random-walk")).toBe("/random-walk");
    expect(collectionPath("cosmic-signature")).toBe("/cosmic-signature");
    expect(tokenPath("random-walk", 7)).toBe("/token/random-walk/7");
  });

  it("defaults to the discover view when no view is requested", () => {
    expect(
      collectionMarketHref({
        collectionId: "random-walk",
        search: {},
      }),
    ).toBe("/random-walk?view=discover");
  });

  it("builds collection-scoped market links", () => {
    expect(
      collectionMarketHref({
        collectionId: "cosmic-signature",
        search: {
          collection: "cosmic-signature",
          view: "discover",
          query: "12",
          min: 0.5,
          max: 4,
          sort: "recent",
        },
        page: 2,
      }),
    ).toBe(
      "/cosmic-signature?view=discover&page=2&query=12&min=0.5&max=4&sort=recent",
    );

    expect(
      collectionMarketHref({
        collectionId: "random-walk",
        search: { collection: "random-walk", view: "listings" },
        view: "top-bids",
      }),
    ).toBe("/random-walk?view=top-bids&filter=buy&sort=price-desc");

    expect(
      collectionMarketHref({
        collectionId: "random-walk",
        search: {
          collection: "random-walk",
          view: "discover",
          listedOnly: true,
          pageSize: 24,
        },
      }),
    ).toBe("/random-walk?view=discover&pageSize=24&listedOnly=1");
  });

  it("preserves the anchor status filter across views and pagination", () => {
    expect(
      collectionMarketHref({
        collectionId: "random-walk",
        search: {
          collection: "random-walk",
          view: "discover",
          anchor: "never",
        },
        page: 3,
      }),
    ).toBe("/random-walk?view=discover&page=3&anchor=never");

    expect(
      collectionMarketHref({
        collectionId: "cosmic-signature",
        search: {
          collection: "cosmic-signature",
          view: "discover",
          anchor: "anchored",
        },
        view: "listings",
      }),
    ).toBe(
      "/cosmic-signature?view=listings&anchor=anchored&filter=sell&sort=price-asc",
    );
  });
});
