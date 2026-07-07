import { z } from "zod";

import type {
  MarketToken,
  TokenArtwork,
  TokenHistoryEventKind,
  TokenHistoryRecord,
  TokenMediaAssets,
} from "@/lib/marketplace/types";
import { participantAddress, ZERO_ADDRESS } from "@/lib/marketplace/eth";
import { fetchGoApiJson } from "@/lib/marketplace/go-api";
import { logMarketplaceDegradation } from "@/lib/marketplace/log";

/**
 * Random Walk data comes straight from the collection's Go backend (the same
 * API that powers randomwalknft.com): `tokens/info` for current ownership and
 * `tokens/history` for full provenance. Media URLs are deterministic per
 * token id on the same host.
 */

const RANDOM_WALK_API_URL =
  process.env.RANDOM_WALK_API_URL ??
  process.env.NEXT_PUBLIC_RANDOM_WALK_API_URL ??
  "https://api.randomwalknft.com:1443";
const RANDOM_WALK_METADATA_URL =
  process.env.RANDOM_WALK_METADATA_URL ??
  process.env.NEXT_PUBLIC_RANDOM_WALK_METADATA_URL ??
  "https://randomwalknft-api.com";
const RANDOM_WALK_REFRESH_SECONDS = 60;
const RANDOM_WALK_HISTORY_PAGE_SIZE = 1_000;

const randomWalkMetadataSchema = z.object({
  animation_url: z.string().optional(),
  attributes: z
    .array(
      z.object({
        trait_type: z.string().optional(),
        value: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .optional(),
  image: z.string().optional(),
  name: z.string().optional(),
  properties: z.object({ seed: z.string().optional() }).optional(),
});

const randomWalkTokenInfoResponseSchema = z.object({
  TokenInfo: z.object({
    TokenId: z.number(),
    CurOwnerAddr: z.string(),
    SeedHex: z.string(),
    CurName: z.string().optional(),
  }),
});

/**
 * One provenance record from `tokens/history`. Field presence varies by
 * RecordType (mints carry OwnerAddr, transfers FromAddr/ToAddr, marketplace
 * records Buyer/Seller/OfferId), so everything event-specific is optional.
 */
const randomWalkHistoryEntrySchema = z.object({
  RecordType: z.number(),
  Record: z
    .object({
      BlockNum: z.number().optional(),
      TimeStamp: z.number(),
      DateTime: z.string(),
      OwnerAddr: z.string().optional(),
      SellerAddr: z.string().optional(),
      BuyerAddr: z.string().optional(),
      FromAddr: z.string().optional(),
      ToAddr: z.string().optional(),
      Price: z.number().optional(),
      OfferId: z.number().optional(),
      OfferType: z.number().optional(),
      TokenName: z.string().optional(),
    })
    .passthrough(),
});

const randomWalkTokenHistoryResponseSchema = z.object({
  // The Go backend encodes a nil slice as JSON null.
  TokenHistory: z.array(randomWalkHistoryEntrySchema).nullish(),
});

type RandomWalkMetadata = z.infer<typeof randomWalkMetadataSchema>;

export type RandomWalkHistoryEntry = z.infer<
  typeof randomWalkHistoryEntrySchema
>;

function formatRandomWalkName(tokenId: number) {
  return `Random Walk #${String(tokenId).padStart(6, "0")}`;
}

export function randomWalkApiPath(path: string) {
  return `${RANDOM_WALK_API_URL}/api/randomwalk/${path}`;
}

/** Full media set served by the Random Walk backend, keyed by token id. */
export function randomWalkAssets(tokenId: number): Required<TokenMediaAssets> {
  const fileName = String(tokenId).padStart(6, "0");
  const base = `${RANDOM_WALK_API_URL}/images/randomwalk/${fileName}`;

  return {
    blackImage: `${base}_black.png`,
    blackThumb: `${base}_black_thumb.jpg`,
    blackSingleVideo: `${base}_black_single.mp4`,
    blackTripleVideo: `${base}_black_triple.mp4`,
    whiteImage: `${base}_white.png`,
    whiteThumb: `${base}_white_thumb.jpg`,
    whiteSingleVideo: `${base}_white_single.mp4`,
    whiteTripleVideo: `${base}_white_triple.mp4`,
  };
}

export function randomWalkArtwork(tokenId: number): TokenArtwork {
  return {
    image: randomWalkAssets(tokenId).blackThumb,
    alt: `${formatRandomWalkName(tokenId)} artwork`,
  };
}

export function randomWalkTokenPreview(tokenId: number): MarketToken {
  const artwork = randomWalkArtwork(tokenId);

  return {
    collectionId: "random-walk",
    tokenId,
    name: formatRandomWalkName(tokenId),
    owner: ZERO_ADDRESS,
    seed: "",
    traits: [],
    artwork,
    assets: {
      blackThumb: artwork.image,
    },
  };
}

/**
 * RecordType values observed on the live backend: 1 mint, 2 offer created
 * (OfferType 1 = sell listing, 0 = buy bid), 3 offer canceled, 4 item bought,
 * 5 token renamed, 6 transfer. Unknown types map to "other" so new backend
 * record types degrade to a generic entry instead of breaking parsing.
 */
function randomWalkHistoryKind(
  recordType: number,
  offerType: number | undefined,
): TokenHistoryEventKind {
  switch (recordType) {
    case 1:
      return "mint";
    case 2:
      return offerType === 1 ? "listing" : "bid";
    case 3:
      return "offer-canceled";
    case 4:
      return "sale";
    case 5:
      return "named";
    case 6:
      return "transfer";
    default:
      return "other";
  }
}

export function normalizeRandomWalkHistory(
  entries: readonly RandomWalkHistoryEntry[] = [],
): TokenHistoryRecord[] {
  return entries.map(({ RecordType, Record }) => ({
    kind: randomWalkHistoryKind(RecordType, Record.OfferType),
    recordType: RecordType,
    blockNumber: Record.BlockNum ?? 0,
    timestamp: Record.TimeStamp,
    dateTime: Record.DateTime,
    owner: participantAddress(Record.OwnerAddr),
    seller: participantAddress(Record.SellerAddr),
    buyer: participantAddress(Record.BuyerAddr),
    from: participantAddress(Record.FromAddr),
    to: participantAddress(Record.ToAddr),
    price:
      typeof Record.Price === "number" && Number.isFinite(Record.Price)
        ? Record.Price
        : undefined,
    offerId: Record.OfferId,
    name: Record.TokenName,
  }));
}

async function fetchRandomWalkTokenInfo(tokenId: number) {
  const response = await fetchGoApiJson(
    randomWalkApiPath(`tokens/info/${tokenId}`),
    randomWalkTokenInfoResponseSchema,
    { revalidate: RANDOM_WALK_REFRESH_SECONDS },
  );

  return response.TokenInfo;
}

export async function fetchRandomWalkTokenHistory(
  tokenId: number,
): Promise<TokenHistoryRecord[]> {
  const response = await fetchGoApiJson(
    randomWalkApiPath(
      `tokens/history/${tokenId}/0/${RANDOM_WALK_HISTORY_PAGE_SIZE}`,
    ),
    randomWalkTokenHistoryResponseSchema,
    { revalidate: RANDOM_WALK_REFRESH_SECONDS },
  );

  return normalizeRandomWalkHistory(response.TokenHistory ?? []);
}

/**
 * Canonical token detail from the Random Walk Go API. Ownership and seed come
 * from `tokens/info`; provenance and the mint date from `tokens/history`. A
 * history failure degrades to a token without provenance rather than failing
 * the whole detail load.
 */
export async function fetchRandomWalkTokenDetail(
  tokenId: number,
): Promise<MarketToken> {
  const [info, tokenHistory] = await Promise.all([
    fetchRandomWalkTokenInfo(tokenId),
    fetchRandomWalkTokenHistory(tokenId).catch((error) => {
      logMarketplaceDegradation(
        `random-walk token ${tokenId} history unavailable`,
        error,
      );
      return undefined;
    }),
  ]);
  const assets = randomWalkAssets(info.TokenId);
  const mintedAt = tokenHistory?.find((record) => record.kind === "mint")
    ?.dateTime;
  const rating = 0;

  return {
    collectionId: "random-walk",
    tokenId: info.TokenId,
    name: info.CurName?.trim() || formatRandomWalkName(info.TokenId),
    owner: participantAddress(info.CurOwnerAddr) ?? ZERO_ADDRESS,
    seed: info.SeedHex,
    traits: [
      { label: "Beauty score", value: rating.toFixed(2) },
      ...(mintedAt ? [{ label: "Minted", value: mintedAt }] : []),
    ],
    artwork: {
      image: assets.blackImage,
      alt: `${formatRandomWalkName(info.TokenId)} artwork`,
    },
    assets,
    rating,
    mintedAt,
    tokenHistory,
  };
}

export function tokenFromRandomWalkMetadata(
  tokenId: number,
  metadata: RandomWalkMetadata,
): MarketToken {
  const seed =
    metadata.properties?.seed ??
    metadata.attributes?.find((attribute) => attribute.trait_type === "seed")
      ?.value ??
    "";

  return {
    collectionId: "random-walk",
    tokenId,
    name: metadata.name?.trim() || formatRandomWalkName(tokenId),
    owner: ZERO_ADDRESS,
    seed: String(seed),
    traits: metadata.attributes?.map((attribute) => ({
      label: attribute.trait_type ?? "Trait",
      value: String(attribute.value ?? ""),
    })) ?? [{ label: "Seed", value: String(seed) }],
    artwork: {
      image: metadata.image ?? randomWalkArtwork(tokenId).image,
      alt: `${formatRandomWalkName(tokenId)} artwork`,
    },
    assets: {
      blackImage: metadata.image,
      blackThumb: randomWalkArtwork(tokenId).image,
      blackSingleVideo: metadata.animation_url,
    },
  };
}

/**
 * Static metadata fallback for when the Go API is unreachable. It has no
 * ownership, mint date, or provenance data; callers enrich the owner from the
 * chain where possible.
 */
export async function fetchRandomWalkMetadata(tokenId: number) {
  const metadataUrls = [
    `${RANDOM_WALK_METADATA_URL}/metadata/${tokenId}`,
    randomWalkApiPath(`metadata/${tokenId}`),
  ];
  let lastError: Error | undefined;

  for (const url of [...new Set(metadataUrls)]) {
    try {
      const metadata = await fetchGoApiJson(url, randomWalkMetadataSchema, {
        revalidate: RANDOM_WALK_REFRESH_SECONDS,
      });

      return tokenFromRandomWalkMetadata(tokenId, metadata);
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Random Walk metadata could not be loaded.");
    }
  }

  throw lastError ?? new Error("Random Walk metadata could not be loaded.");
}
