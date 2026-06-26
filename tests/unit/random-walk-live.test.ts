import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchRandomWalkMarketplaceOffers,
  fetchRandomWalkMetadata,
  fetchRandomWalkTokenDetail,
  parseRandomWalkDetailHtml,
  parseRandomWalkMarketplaceHtml,
  tokenFromRandomWalkMetadata,
} from "@/lib/marketplace/random-walk-live";

describe("Random Walk live data adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses marketplace sell listings from serialized page output", () => {
    const html = String.raw`
      ["$","div","sell-381",{"className":"space-y-3","children":[
        ["$","$L1f",null,{"id":1271,"image":"https://api.randomwalknft.com:1443/images/randomwalk/001271_black_thumb.jpg","href":"/detail/1271"}],
        ["$","span",null,{"children":["#001271"," · ","0.1000 ETH"]}]
      ]}]
    `;

    expect(parseRandomWalkMarketplaceHtml(html, "sell")).toEqual([
      expect.objectContaining({
        id: "sell-381-1271-0.1000",
        offerId: 381,
        collectionId: "random-walk",
        tokenId: 1271,
        kind: "sell",
        priceEth: 0.1,
        artwork: expect.objectContaining({
          image:
            "https://api.randomwalknft.com:1443/images/randomwalk/001271_black_thumb.jpg",
        }),
      }),
    ]);
  });

  it("parses marketplace buy offers and ignores the other offer type", () => {
    const html = String.raw`
      ["$","div","sell-1",{"children":[["$","$L1f",null,{"id":1,"image":"sell.jpg","href":"/detail/1"}],["$","span",null,{"children":["#000001"," · ","1.0000 ETH"]}]]}]
      ["$","div","buy-319",{"children":[["$","$L1f",null,{"id":3435,"image":"buy.jpg","href":"/detail/3435"}],["$","span",null,{"children":["#003435"," · ","0.0010 ETH"]}]]}]
    `;

    expect(parseRandomWalkMarketplaceHtml(html, "buy")).toEqual([
      expect.objectContaining({
        id: "buy-319-3435-0.0010",
        tokenId: 3435,
        kind: "buy",
        priceEth: 0.001,
      }),
    ]);
  });

  it("deduplicates repeated card payloads", () => {
    const card = String.raw`["$","div","sell-381",{"children":[["$","$L1f",null,{"id":1271,"image":"thumb.jpg","href":"/detail/1271"}],["$","span",null,{"children":["#001271"," · ","0.1000 ETH"]}]]}]`;

    expect(
      parseRandomWalkMarketplaceHtml(`${card}${card}`, "sell"),
    ).toHaveLength(1);
  });

  it("falls back to rendered card HTML when flight chunks are split", () => {
    const html = String.raw`
      ["$","div","sell-157",{"children":[["$","$L1f",null,{"id":3409,"image":"https://api.randomwalknft.com:1443/images/randomwalk/003409_black_thumb.jpg","href":"/detail/3409"}],
      </script><script>self.__next_f.push([1,":["#002771"," · ","0.1190 ETH"]}]
      <a href="/detail/3409"><div><img alt="Preview image for NFT #003409" src="https://api.randomwalknft.com:1443/images/randomwalk/003409_black_thumb.jpg"/></div></a>
      <div class="flex items-center justify-between"><div>Sell listing</div><span>#003409<!-- --> · <!-- -->0.1180 ETH</span></div>
      <a href="/detail/2771"><div><img alt="Preview image for NFT #002771" src="https://api.randomwalknft.com:1443/images/randomwalk/002771_black_thumb.jpg"/></div></a>
      <div class="flex items-center justify-between"><div>Sell listing</div><span>#002771<!-- --> · <!-- -->0.1190 ETH</span></div>
    `;

    expect(parseRandomWalkMarketplaceHtml(html, "sell")).toEqual([
      expect.objectContaining({
        id: "sell-rendered-3409-0.1180",
        tokenId: 3409,
        priceEth: 0.118,
      }),
      expect.objectContaining({
        id: "sell-rendered-2771-0.1190",
        tokenId: 2771,
        priceEth: 0.119,
      }),
    ]);
  });

  it("parses token detail payloads with live offer IDs and history", () => {
    const html = String.raw`
      self.__next_f.push([1,"{\"nft\":{\"id\":1233,\"owner\":\"0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08\",\"seed\":\"2993ea\",\"rating\":0,\"assets\":{\"blackImage\":\"https://api.randomwalknft.com:1443/images/randomwalk/001233_black.png\",\"blackThumb\":\"https://api.randomwalknft.com:1443/images/randomwalk/001233_black_thumb.jpg\",\"blackSingleVideo\":\"https://api.randomwalknft.com:1443/images/randomwalk/001233_black_single.mp4\"},\"tokenHistory\":[{\"recordType\":2,\"blockNumber\":37204293,\"timestamp\":1668168199,\"dateTime\":\"2022-11-11T12:03:19Z\",\"seller\":\"0x0000000000000000000000000000000000000000\",\"buyer\":\"0xbC9f202d46fC4c6F3BdDd50eB43642C81bCe371c\",\"price\":0.001,\"offerId\":346}],\"mintedAt\":\"2021-11-12T03:20:16Z\"},\"buyOffers\":[{\"id\":347,\"offerId\":346,\"tokenId\":1233,\"seller\":\"0x0000000000000000000000000000000000000000\",\"buyer\":\"0xbC9f202d46fC4c6F3BdDd50eB43642C81bCe371c\",\"price\":0.001,\"active\":true,\"createdAt\":\"2022-11-11T12:03:19Z\",\"createdAtTimestamp\":1668168199,\"kind\":\"buy\"}],\"sellOffers\":[{\"id\":13,\"offerId\":12,\"tokenId\":1233,\"seller\":\"0x3CD1a28Be614136e26F867c9fE47821Fcf6dc7f6\",\"buyer\":\"0x0000000000000000000000000000000000000000\",\"price\":0.1,\"active\":true,\"createdAt\":\"2021-11-12T03:37:31Z\",\"createdAtTimestamp\":1636688251,\"kind\":\"sell\"}],\"message\":\"$undefined\"}]]"]);
    `;

    const result = parseRandomWalkDetailHtml(html);

    expect(result.token).toMatchObject({
      collectionId: "random-walk",
      tokenId: 1233,
      name: "Random Walk #001233",
      seed: "2993ea",
      mintedAt: "2021-11-12T03:20:16Z",
    });
    expect(result.offers).toEqual([
      expect.objectContaining({ id: "sell-12", offerId: 12, kind: "sell" }),
      expect.objectContaining({ id: "buy-346", offerId: 346, kind: "buy" }),
    ]);
    expect(result.token.tokenHistory?.[0]?.buyer).toBe(
      "0xbC9f202d46fC4c6F3BdDd50eB43642C81bCe371c",
    );
  });

  it("drops inactive detail offers before they reach pricing displays", () => {
    const html = JSON.stringify({
      nft: {
        id: 1233,
        owner: "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08",
        seed: "2993ea",
      },
      buyOffers: [
        {
          id: 1,
          offerId: 1,
          tokenId: 1233,
          seller: "0x0000000000000000000000000000000000000000",
          buyer: "0x0000000000000000000000000000000000000001",
          price: 10,
          active: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          createdAtTimestamp: 1,
          kind: "buy",
        },
        {
          id: 2,
          offerId: 2,
          tokenId: 1233,
          seller: "0x0000000000000000000000000000000000000000",
          buyer: "0x0000000000000000000000000000000000000002",
          price: 2,
          active: true,
          createdAt: "2026-01-02T00:00:00.000Z",
          createdAtTimestamp: 2,
          kind: "buy",
        },
      ],
      sellOffers: [
        {
          id: 3,
          offerId: 3,
          tokenId: 1233,
          seller: "0x0000000000000000000000000000000000000003",
          buyer: "0x0000000000000000000000000000000000000000",
          price: 0.01,
          active: false,
          createdAt: "2026-01-03T00:00:00.000Z",
          createdAtTimestamp: 3,
          kind: "sell",
        },
        {
          id: 4,
          offerId: 4,
          tokenId: 1233,
          seller: "0x0000000000000000000000000000000000000004",
          buyer: "0x0000000000000000000000000000000000000000",
          price: 1.25,
          active: true,
          createdAt: "2026-01-04T00:00:00.000Z",
          createdAtTimestamp: 4,
          kind: "sell",
        },
      ],
    });

    expect(
      parseRandomWalkDetailHtml(html).offers.map((offer) => offer.id),
    ).toEqual(["sell-4", "buy-2"]);
  });

  it("uses safe defaults when optional detail fields are missing", () => {
    const html = String.raw`
      self.__next_f.push([1,"{\"nft\":{\"id\":6,\"name\":\"\",\"owner\":\"not-an-address\",\"seed\":\"abc\"},\"message\":\"$undefined\"}"]);
    `;

    const result = parseRandomWalkDetailHtml(html);

    expect(result.token).toMatchObject({
      tokenId: 6,
      owner: "0x0000000000000000000000000000000000000000",
      artwork: {
        image:
          "https://api.randomwalknft.com:1443/images/randomwalk/000006_black_thumb.jpg",
      },
      traits: [{ label: "Beauty score", value: "0.00" }],
      tokenHistory: [],
    });
    expect(result.offers).toEqual([]);
  });

  it("throws a clear error when detail payloads are missing", () => {
    expect(() =>
      parseRandomWalkDetailHtml("<html>No token here</html>"),
    ).toThrow("Random Walk detail payload was not found.");
  });

  it("builds a token from public metadata when detail parsing is unavailable", () => {
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

  it("fetches marketplace offers with Random Walk query parameters", async () => {
    const html = String.raw`
      ["$","div","buy-319",{"children":[["$","$L1f",null,{"id":3435,"image":"buy.jpg","href":"/detail/3435"}],["$","span",null,{"children":["#003435"," · ","0.0010 ETH"]}]]}]
    `;
    const fetchMock = vi.fn(async () => new Response(html));
    vi.stubGlobal("fetch", fetchMock);

    const offers = await fetchRandomWalkMarketplaceOffers("buy", "price-desc");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://randomwalknft.com/marketplace?filter=buy&sort=price-desc",
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
    expect(offers[0]).toMatchObject({
      id: "buy-319-3435-0.0010",
      priceEth: 0.001,
    });
  });

  it("surfaces failed marketplace, detail, and metadata fetches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(fetchRandomWalkMarketplaceOffers()).rejects.toThrow(
      "Random Walk marketplace returned 500.",
    );
    await expect(fetchRandomWalkTokenDetail(1)).rejects.toThrow(
      "Random Walk token detail returned 500.",
    );
    await expect(fetchRandomWalkMetadata(1)).rejects.toThrow(
      "Random Walk metadata returned 500.",
    );
  });

  it("fetches token detail and metadata successfully", async () => {
    const detailHtml = String.raw`
      self.__next_f.push([1,"{\"nft\":{\"id\":8,\"owner\":\"0x0000000000000000000000000000000000000001\",\"seed\":\"seed\"},\"sellOffers\":[],\"buyOffers\":[]}"]);
    `;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(detailHtml))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: "Random Walk #000008",
            properties: { seed: "metadata-seed" },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRandomWalkTokenDetail(8)).resolves.toMatchObject({
      token: { tokenId: 8, seed: "seed" },
    });
    await expect(fetchRandomWalkMetadata(8)).resolves.toMatchObject({
      tokenId: 8,
      seed: "metadata-seed",
    });
  });
});
