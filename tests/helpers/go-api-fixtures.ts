import { vi } from "vitest";

/**
 * Fixtures mirroring live responses from the PredictionExplorer Go backends
 * (captured from api.randomwalknft.com:1443 and nfts.cosmicsignature.com), and
 * a URL-routing fetch mock so tests can serve multiple endpoints at once.
 */

export const RANDOM_WALK_API = "https://api.randomwalknft.com:1443";
export const RANDOM_WALK_METADATA_API = "https://randomwalknft-api.com";
export const COSMIC_SIGNATURE_API = "https://nfts.cosmicsignature.com";

export function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

type RouteHandler = (
  match: RegExpMatchArray,
  url: string,
) => Response | Promise<Response>;

/**
 * Fetch mock that dispatches by URL pattern. Unmatched URLs throw so tests
 * fail loudly when code fetches something unexpected.
 */
export function routedFetchMock(routes: Array<[RegExp, RouteHandler]>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);

    for (const [pattern, handler] of routes) {
      const match = url.match(pattern);

      if (match) {
        return handler(match, url);
      }
    }

    throw new Error(`Unexpected fetch in test: ${url}`);
  });
}

export function randomWalkInfoResponse(
  tokenId: number,
  overrides: Partial<{
    CurOwnerAddr: string;
    SeedHex: string;
    CurName: string;
  }> = {},
) {
  return {
    TokenInfo: {
      TokenId: tokenId,
      CurOwnerAid: 873,
      CurOwnerAddr: "0xcc9C0DDF13EB1853185A51296FcEBec103b466e1",
      SeedHex:
        "86e6b608f61e95788b010714a97479e0520c5c20f2b70e26f267730d14a68030",
      SeedNum:
        "61017552894490818882718175695581172358344182690133073063610470987773650567216",
      LastPrice: 0.001006618176641971,
      TotalVolume: 0,
      NumTrades: 0,
      CurName: "",
      LastNameUpdateTs: 0,
      LastNameUpdateDate: "",
      ...overrides,
    },
    error: "",
    status: 1,
  };
}

/**
 * Live history of Random Walk token 5: a mint followed by a plain transfer.
 * The transfer record has no Price field — the exact case that used to
 * surface as "$undefined" in the scraped payload and broke parsing.
 */
export const randomWalkToken5HistoryResponse = {
  RWalkAddr: "0x895a6F444BE4ba9d124F61DF736605792B35D66b",
  RWalkAid: 2,
  TokenHistory: [
    {
      RecordType: 1,
      Record: {
        BlockNum: 2983683,
        TimeStamp: 1636675217,
        DateTime: "2021-11-12T00:00:17Z",
        ContractAid: 2,
        ContractAddr: "0x895a6F444BE4ba9d124F61DF736605792B35D66b",
        TokenId: 5,
        OwnerAid: 9,
        OwnerAddr: "0x6e6092EE787F2FBA1940d0a162aCdcFB2Bbb7Eff",
        SeedHex:
          "86e6b608f61e95788b010714a97479e0520c5c20f2b70e26f267730d14a68030",
        SeedNum:
          "61017552894490818882718175695581172358344182690133073063610470987773650567216",
        Price: 0.001006618176641971,
      },
    },
    {
      RecordType: 6,
      Record: {
        BlockNum: 49305544,
        TimeStamp: 1672192433,
        DateTime: "2022-12-28T01:53:53Z",
        ContractAid: 2,
        ContractAddr: "0x895a6F444BE4ba9d124F61DF736605792B35D66b",
        TokenId: 5,
        FromAid: 9,
        FromAddr: "0x6e6092EE787F2FBA1940d0a162aCdcFB2Bbb7Eff",
        ToAid: 873,
        ToAddr: "0xcc9C0DDF13EB1853185A51296FcEBec103b466e1",
        TransferId: 6819,
      },
    },
  ],
  TokenId: 5,
  error: "",
  status: 1,
};

export function emptyRandomWalkHistoryResponse(tokenId: number) {
  return {
    RWalkAddr: "0x895a6F444BE4ba9d124F61DF736605792B35D66b",
    RWalkAid: 2,
    TokenHistory: [],
    TokenId: tokenId,
    error: "",
    status: 1,
  };
}

/** Marketplace record samples observed on the live backend (token 0 and 13). */
export const randomWalkMarketplaceHistoryRecords = [
  {
    RecordType: 2,
    Record: {
      BlockNum: 2987249,
      TimeStamp: 1636688251,
      DateTime: "2021-11-12T03:37:31Z",
      ContractAid: 1,
      ContractAddr: "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08",
      TokenId: 1233,
      BuyerAid: 3,
      BuyerAddr: "0x0000000000000000000000000000000000000000",
      SellerAid: 114,
      SellerAddr: "0x3CD1a28Be614136e26F867c9fE47821Fcf6dc7f6",
      OfferType: 1,
      OfferId: 12,
      Active: true,
      Price: 0.1,
    },
  },
  {
    RecordType: 2,
    Record: {
      BlockNum: 37204293,
      TimeStamp: 1668168199,
      DateTime: "2022-11-11T12:03:19Z",
      ContractAid: 1,
      ContractAddr: "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08",
      TokenId: 1233,
      BuyerAid: 858,
      BuyerAddr: "0xbC9f202d46fC4c6F3BdDd50eB43642C81bCe371c",
      SellerAid: 3,
      SellerAddr: "0x0000000000000000000000000000000000000000",
      OfferType: 0,
      OfferId: 346,
      Active: true,
      Price: 0.001,
    },
  },
  {
    RecordType: 3,
    Record: {
      BlockNum: 3045114,
      TimeStamp: 1636928506,
      DateTime: "2021-11-14T22:21:46Z",
      ContractAid: 1,
      ContractAddr: "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08",
      TokenId: 0,
      OfferCanceledId: 13,
      BuyerAid: 44,
      BuyerAddr: "0xad65de4D008311Bb97e8b2376b4172ea55f4d8Ae",
      SellerAid: 3,
      SellerAddr: "0x0000000000000000000000000000000000000000",
      OfferType: 0,
      OfferId: 13,
      Price: 0.05,
      Aid: 44,
      Address: "0xad65de4D008311Bb97e8b2376b4172ea55f4d8Ae",
    },
  },
  {
    RecordType: 4,
    Record: {
      BlockNum: 3544465,
      TimeStamp: 1638566745,
      DateTime: "2021-12-03T21:25:45Z",
      ContractAid: 1,
      ContractAddr: "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08",
      TokenId: 13,
      ItemBoughtId: 38,
      BuyerAid: 675,
      BuyerAddr: "0x85140917c4abA6627A824a252426CF25A6D338AD",
      SellerAid: 17,
      SellerAddr: "0xB96113296cE138E30F0Ffa7Ce459bA20f55572f9",
      OfferType: 1,
      OfferId: 188,
      Price: 0.0525,
      Aid: 675,
      Address: "0x85140917c4abA6627A824a252426CF25A6D338AD",
    },
  },
  {
    RecordType: 5,
    Record: {
      BlockNum: 2983928,
      TimeStamp: 1636675497,
      DateTime: "2021-11-12T00:04:57Z",
      ContractAid: 2,
      ContractAddr: "0x895a6F444BE4ba9d124F61DF736605792B35D66b",
      TokenId: 0,
      TokenName: "1 st Mint",
    },
  },
];

export function cosmicSignatureInfoResponse(
  tokenId: number,
  overrides: Partial<{
    CurOwnerAddr: string;
    Seed: string;
    TokenName: string;
    Staked: boolean;
  }> = {},
) {
  return {
    TokenInfo: {
      RecordId: 0,
      Tx: {
        EvtLogId: 18826,
        BlockNum: 473669120,
        TxId: 5545,
        TxHash:
          "0x83b8f2665bc1d4a4c0c2ce74918f7b6f31a6ab1c201028c8b9337f16ce80cfce",
        TimeStamp: 1781506802,
        DateTime: "2026-06-15T07:00:02Z",
      },
      ContractAddr: "",
      TokenId: tokenId,
      WinnerAid: 977,
      WinnerAddr: "0x30E6E8EEEC88aA8Ea35B54807671458B3F01665e",
      CurOwnerAid: 24,
      CurOwnerAddr: "0x6308A405B4FF1eA890870Efe2a6D036750B81F7C",
      Seed: "e29887e5f8aea85d6b775ab8dc95df16a5a0ad2979ace2b539058a0040aca67d",
      RoundNum: 0,
      RecordType: 1,
      TokenName: "",
      Staked: true,
      StakedOwnerAid: 977,
      StakedOwnerAddr: "0x30E6E8EEEC88aA8Ea35B54807671458B3F01665e",
      ...overrides,
    },
    error: "",
    status: 1,
  };
}

/** Live transfers of Cosmic Signature token 5: mint then transfer, newest first. */
export function cosmicSignatureTransfersResponse(tokenId: number) {
  return {
    Limit: 100,
    Offset: 0,
    TokenId: tokenId,
    TokenTransfers: [
      {
        RecordId: 28,
        Tx: {
          EvtLogId: 18919,
          BlockNum: 474485310,
          TxId: 5564,
          TxHash:
            "0xa085bc002caa94ab4c9f60b76f9faecdc19272b9fcd2d529c47e3705ad5df55e",
          TimeStamp: 1781712122,
          DateTime: "2026-06-17T16:02:02Z",
        },
        TokenId: tokenId,
        FromAddr: "0x30E6E8EEEC88aA8Ea35B54807671458B3F01665e",
        ToAddr: "0x6308A405B4FF1eA890870Efe2a6D036750B81F7C",
        FromAid: 977,
        ToAid: 24,
        TransferType: 0,
      },
      {
        RecordId: 6,
        Tx: {
          EvtLogId: 18825,
          BlockNum: 473669120,
          TxId: 5545,
          TxHash:
            "0x83b8f2665bc1d4a4c0c2ce74918f7b6f31a6ab1c201028c8b9337f16ce80cfce",
          TimeStamp: 1781506802,
          DateTime: "2026-06-15T07:00:02Z",
        },
        TokenId: tokenId,
        FromAddr: "0x0000000000000000000000000000000000000000",
        ToAddr: "0x30E6E8EEEC88aA8Ea35B54807671458B3F01665e",
        FromAid: 13,
        ToAid: 977,
        TransferType: 1,
      },
    ],
    error: "",
    status: 1,
  };
}

export function cosmicSignatureMetadataResponse(tokenId: number) {
  const seed =
    "e29887e5f8aea85d6b775ab8dc95df16a5a0ad2979ace2b539058a0040aca67d";

  return {
    animation_url: `https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x${seed}.mp4`,
    attributes: [
      { display_type: "number", trait_type: "Round", value: 0 },
      { display_type: "date", trait_type: "Imprinted", value: 1781506802 },
      { trait_type: "seed", value: seed },
    ],
    image: `https://nfts.cosmicsignature.com/images/new/cosmicsignature/0x${seed}.png`,
    name: `Cosmic Signature #${tokenId}`,
    properties: {
      owner: "0x6308A405B4FF1eA890870Efe2a6D036750B81F7C",
      round_num: 0,
      seed,
      token_id: tokenId,
    },
  };
}

export function goApiErrorResponse(error: string) {
  return jsonResponse({ error, status: 0 }, { status: 400 });
}
