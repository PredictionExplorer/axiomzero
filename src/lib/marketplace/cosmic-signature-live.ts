import { z } from "zod";

import type {
  MarketToken,
  TokenHistoryRecord,
  TokenMediaAssets,
} from "@/lib/marketplace/types";
import {
  coerceAddress,
  isZeroAddress,
  participantAddress,
  ZERO_ADDRESS,
} from "@/lib/marketplace/eth";
import { fetchGoApiJson } from "@/lib/marketplace/go-api";
import { logMarketplaceDegradation } from "@/lib/marketplace/log";

const COSMIC_SIGNATURE_NFT_API_URL = "https://nfts.cosmicsignature.com";
const COSMIC_SIGNATURE_APP_URL = "https://app.cosmicsignature.com";
/**
 * Cosmic Signature runs the same Go "webserv" backend as Random Walk; its
 * JSON API lives under /api/cosmicgame on the NFT host.
 */
const COSMIC_SIGNATURE_API_URL =
  process.env.COSMIC_SIGNATURE_API_URL ??
  process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_API_URL ??
  COSMIC_SIGNATURE_NFT_API_URL;
const COSMIC_SIGNATURE_REFRESH_SECONDS = 60;
const COSMIC_SIGNATURE_TIMEOUT_MS = 8_000;
const COSMIC_SIGNATURE_HISTORY_PAGE_SIZE = 1_000;
const COSMIC_SIGNATURE_TOKEN_LIST_PAGE_SIZE = 10_000;

const cosmicSignatureMetadataAttributeSchema = z
  .object({
    display_type: z.string().optional(),
    trait_type: z.string().optional(),
    value: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

const cosmicSignatureMetadataSchema = z
  .object({
    animation_url: z.string().optional(),
    attributes: z.array(cosmicSignatureMetadataAttributeSchema).optional(),
    image: z.string().optional(),
    name: z.string().optional(),
    properties: z
      .object({
        owner: z.string().optional(),
        round_num: z.number().optional(),
        seed: z.union([z.string(), z.number()]).optional(),
        token_id: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const cosmicSignatureJsonLdProductSchema = z
  .object({
    "@type": z.union([z.string(), z.array(z.string())]).optional(),
    image: z.string(),
    name: z.string().optional(),
  })
  .passthrough();

const cosmicSignatureTxSchema = z
  .object({
    BlockNum: z.number().optional(),
    TimeStamp: z.number().optional(),
    DateTime: z.string().optional(),
  })
  .passthrough();

const cosmicSignatureTokenInfoResponseSchema = z.object({
  TokenInfo: z
    .object({
      TokenId: z.number(),
      CurOwnerAddr: z.string(),
      Seed: z.string().optional(),
      TokenName: z.string().optional(),
      RoundNum: z.number().optional(),
      Staked: z.boolean().optional(),
      StakedOwnerAddr: z.string().optional(),
      WinnerAddr: z.string().optional(),
      Tx: cosmicSignatureTxSchema.optional(),
    })
    .passthrough(),
});

const cosmicSignatureTransferSchema = z
  .object({
    TransferType: z.number(),
    FromAddr: z.string().optional(),
    ToAddr: z.string().optional(),
    Tx: cosmicSignatureTxSchema,
  })
  .passthrough();

const cosmicSignatureTransfersResponseSchema = z.object({
  // The Go backend encodes a nil slice as JSON null.
  TokenTransfers: z.array(cosmicSignatureTransferSchema).nullish(),
});

const cosmicSignatureTokenListResponseSchema = z.object({
  CosmicSignatureTokenList: z
    .array(z.object({ TokenId: z.number() }).passthrough())
    .nullish(),
});

type CosmicSignatureMetadataAttribute = z.infer<
  typeof cosmicSignatureMetadataAttributeSchema
>;

export type CosmicSignatureMetadata = z.infer<
  typeof cosmicSignatureMetadataSchema
>;

export type CosmicSignatureTokenInfo = z.infer<
  typeof cosmicSignatureTokenInfoResponseSchema
>["TokenInfo"];

export type CosmicSignatureTransfer = z.infer<
  typeof cosmicSignatureTransferSchema
>;

function formatCosmicSignatureName(tokenId: number) {
  return `Cosmic Signature #${tokenId}`;
}

function normalizeSeed(value: string | number | undefined) {
  if (value === undefined) {
    return "";
  }

  return String(value).replace(/^0x/i, "");
}

function cosmicSignatureApiPath(path: string) {
  return `${COSMIC_SIGNATURE_API_URL}/api/cosmicgame/${path}`;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit & { next?: { revalidate: number } },
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    COSMIC_SIGNATURE_TIMEOUT_MS,
  );

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function attributeValue(attribute: CosmicSignatureMetadataAttribute) {
  if (
    attribute.display_type === "date" &&
    typeof attribute.value === "number"
  ) {
    return new Date(attribute.value * 1000).toISOString();
  }

  return String(attribute.value ?? "");
}

function seedFromMetadata(metadata: CosmicSignatureMetadata) {
  return normalizeSeed(
    metadata.properties?.seed ??
      metadata.attributes?.find(
        (attribute) => attribute.trait_type?.toLowerCase() === "seed",
      )?.value,
  );
}

function mintedAtFromMetadata(metadata: CosmicSignatureMetadata) {
  const imprinted = metadata.attributes?.find(
    (attribute) =>
      attribute.trait_type?.toLowerCase() === "imprinted" &&
      attribute.display_type === "date",
  );

  return typeof imprinted?.value === "number"
    ? new Date(imprinted.value * 1000).toISOString()
    : undefined;
}

export function cosmicSignatureImageUrl(seed: string) {
  return `${COSMIC_SIGNATURE_NFT_API_URL}/images/new/cosmicsignature/0x${normalizeSeed(
    seed,
  )}.png`;
}

export function cosmicSignatureThumbUrl(seed: string, theme = "black") {
  return `${COSMIC_SIGNATURE_NFT_API_URL}/images/new/cosmicsignature/0x${normalizeSeed(
    seed,
  )}/thumb_${theme}.webp`;
}

function cosmicSignatureVideoUrl(seed: string) {
  return `${COSMIC_SIGNATURE_NFT_API_URL}/images/new/cosmicsignature/0x${normalizeSeed(
    seed,
  )}.mp4`;
}

function seedFromImageUrl(image: string) {
  return image.match(/\/0x([a-fA-F0-9]+)\.png(?:\?|$)/)?.[1] ?? "";
}

function mediaAssetsForSeed(
  seed: string,
  overrides: { image?: string; animationUrl?: string } = {},
): TokenMediaAssets {
  const image =
    overrides.image ?? (seed ? cosmicSignatureImageUrl(seed) : "");
  const animationUrl =
    overrides.animationUrl ?? (seed ? cosmicSignatureVideoUrl(seed) : undefined);

  return {
    blackImage: image,
    blackThumb: seed ? cosmicSignatureThumbUrl(seed, "black") : image,
    blackSingleVideo: animationUrl,
    whiteImage: image,
    whiteThumb: seed ? cosmicSignatureThumbUrl(seed, "white") : image,
    whiteSingleVideo: animationUrl,
  };
}

export function tokenFromCosmicSignatureMetadata(
  requestedTokenId: number,
  metadata: CosmicSignatureMetadata,
): MarketToken {
  const tokenId = metadata.properties?.token_id ?? requestedTokenId;
  const seed = seedFromMetadata(metadata);
  const fallbackImage = seed
    ? cosmicSignatureImageUrl(seed)
    : "https://cosmicsignature.com/favicon.ico";
  const traits =
    metadata.attributes?.map((attribute) => ({
      label: attribute.trait_type ?? "Trait",
      value: attributeValue(attribute),
    })) ?? [];

  return {
    collectionId: "cosmic-signature",
    tokenId,
    name: metadata.name?.trim() || formatCosmicSignatureName(tokenId),
    owner: coerceAddress(metadata.properties?.owner) ?? ZERO_ADDRESS,
    seed,
    traits: traits.length ? traits : [{ label: "Seed", value: seed }],
    artwork: {
      image: metadata.image ?? fallbackImage,
      alt: `${formatCosmicSignatureName(tokenId)} artwork`,
    },
    assets: mediaAssetsForSeed(seed, {
      image: metadata.image,
      animationUrl: metadata.animation_url,
    }),
    mintedAt: mintedAtFromMetadata(metadata),
  };
}

export function tokenFromCosmicSignatureAppHtml(
  tokenId: number,
  html: string,
): MarketToken {
  const products = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ]
    .map((match) => {
      try {
        return cosmicSignatureJsonLdProductSchema.parse(JSON.parse(match[1]));
      } catch {
        return undefined;
      }
    })
    .filter(
      (
        product,
      ): product is z.infer<typeof cosmicSignatureJsonLdProductSchema> =>
        Boolean(product),
    );
  const product = products.find((entry) => {
    const type = entry["@type"];

    return Array.isArray(type) ? type.includes("Product") : type === "Product";
  });

  if (!product) {
    throw new Error("Cosmic Signature app metadata was not found.");
  }

  const seed = seedFromImageUrl(product.image);

  return tokenFromCosmicSignatureMetadata(tokenId, {
    animation_url: seed ? cosmicSignatureVideoUrl(seed) : undefined,
    attributes: seed ? [{ trait_type: "seed", value: seed }] : undefined,
    image: product.image,
    name: product.name,
    properties: {
      seed,
      token_id: tokenId,
    },
  });
}

async function fetchCosmicSignatureAppMetadata(tokenId: number) {
  const response = await fetchWithTimeout(
    `${COSMIC_SIGNATURE_APP_URL}/detail/${tokenId}`,
    { next: { revalidate: COSMIC_SIGNATURE_REFRESH_SECONDS } },
  );

  if (!response.ok) {
    throw new Error(`Cosmic Signature app detail returned ${response.status}.`);
  }

  return tokenFromCosmicSignatureAppHtml(tokenId, await response.text());
}

export async function fetchCosmicSignatureMetadata(tokenId: number) {
  try {
    const response = await fetchWithTimeout(
      `${COSMIC_SIGNATURE_NFT_API_URL}/metadata/${tokenId}`,
      { next: { revalidate: COSMIC_SIGNATURE_REFRESH_SECONDS } },
    );

    if (!response.ok) {
      throw new Error(`Cosmic Signature metadata returned ${response.status}.`);
    }

    return tokenFromCosmicSignatureMetadata(
      tokenId,
      cosmicSignatureMetadataSchema.parse(await response.json()),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Cosmic Signature metadata returned 404."
    ) {
      throw error;
    }

    return fetchCosmicSignatureAppMetadata(tokenId);
  }
}

/**
 * TransferType 1 marks the mint (from the zero address); 0 is a regular
 * transfer. The API returns newest-first, so records are reversed into
 * chronological order to match Random Walk history.
 */
export function normalizeCosmicSignatureHistory(
  transfers: readonly CosmicSignatureTransfer[] = [],
): TokenHistoryRecord[] {
  return transfers
    .map((transfer): TokenHistoryRecord => {
      const from = participantAddress(transfer.FromAddr);
      const to = participantAddress(transfer.ToAddr);
      const isMint =
        transfer.TransferType === 1 || isZeroAddress(transfer.FromAddr);

      return {
        kind: isMint ? "mint" : "transfer",
        recordType: transfer.TransferType,
        blockNumber: transfer.Tx.BlockNum ?? 0,
        timestamp: transfer.Tx.TimeStamp ?? 0,
        dateTime: transfer.Tx.DateTime ?? "",
        owner: isMint ? to : undefined,
        from,
        to,
      };
    })
    .sort((left, right) => left.timestamp - right.timestamp);
}

async function fetchCosmicSignatureTokenInfo(tokenId: number) {
  const response = await fetchGoApiJson(
    cosmicSignatureApiPath(`cst/info/${tokenId}`),
    cosmicSignatureTokenInfoResponseSchema,
    { revalidate: COSMIC_SIGNATURE_REFRESH_SECONDS },
  );

  return response.TokenInfo;
}

export async function fetchCosmicSignatureTokenHistory(
  tokenId: number,
): Promise<TokenHistoryRecord[]> {
  const response = await fetchGoApiJson(
    cosmicSignatureApiPath(
      `cst/transfers/all/${tokenId}/0/${COSMIC_SIGNATURE_HISTORY_PAGE_SIZE}`,
    ),
    cosmicSignatureTransfersResponseSchema,
    { revalidate: COSMIC_SIGNATURE_REFRESH_SECONDS },
  );

  return normalizeCosmicSignatureHistory(response.TokenTransfers ?? []);
}

/** All minted Cosmic Signature token ids, ascending, from the Go API. */
export async function fetchCosmicSignatureTokenIds(): Promise<number[]> {
  const response = await fetchGoApiJson(
    cosmicSignatureApiPath(
      `cst/list/all/0/${COSMIC_SIGNATURE_TOKEN_LIST_PAGE_SIZE}`,
    ),
    cosmicSignatureTokenListResponseSchema,
    { revalidate: COSMIC_SIGNATURE_REFRESH_SECONDS },
  );
  const tokenIds = (response.CosmicSignatureTokenList ?? []).map(
    (token) => token.TokenId,
  );

  return [...new Set(tokenIds)].sort((left, right) => left - right);
}

function tokenFromCosmicSignatureInfo(
  info: CosmicSignatureTokenInfo,
): MarketToken {
  const seed = normalizeSeed(info.Seed);

  return {
    collectionId: "cosmic-signature",
    tokenId: info.TokenId,
    name: info.TokenName?.trim() || formatCosmicSignatureName(info.TokenId),
    owner: participantAddress(info.CurOwnerAddr) ?? ZERO_ADDRESS,
    seed,
    traits: [
      ...(info.RoundNum !== undefined
        ? [{ label: "Round", value: String(info.RoundNum) }]
        : []),
      { label: "Seed", value: seed },
    ],
    artwork: {
      image: seed
        ? cosmicSignatureImageUrl(seed)
        : "https://cosmicsignature.com/favicon.ico",
      alt: `${formatCosmicSignatureName(info.TokenId)} artwork`,
    },
    assets: mediaAssetsForSeed(seed),
    mintedAt: info.Tx?.DateTime,
  };
}

/**
 * Canonical Cosmic Signature token detail: metadata provides traits and
 * media, `cst/info` authoritative ownership and naming, and
 * `cst/transfers/all` the provenance timeline. Each source degrades
 * independently; the detail only fails when both metadata and the API are
 * unavailable.
 */
export async function fetchCosmicSignatureTokenDetail(
  tokenId: number,
): Promise<MarketToken> {
  const [metadataToken, info, tokenHistory] = await Promise.all([
    fetchCosmicSignatureMetadata(tokenId).catch((error) => {
      logMarketplaceDegradation(
        `cosmic-signature token ${tokenId} metadata unavailable`,
        error,
      );
      return undefined;
    }),
    fetchCosmicSignatureTokenInfo(tokenId).catch((error) => {
      logMarketplaceDegradation(
        `cosmic-signature token ${tokenId} info unavailable`,
        error,
      );
      return undefined;
    }),
    fetchCosmicSignatureTokenHistory(tokenId).catch((error) => {
      logMarketplaceDegradation(
        `cosmic-signature token ${tokenId} history unavailable`,
        error,
      );
      return undefined;
    }),
  ]);

  if (!metadataToken && !info) {
    throw new Error(
      `Cosmic Signature token ${tokenId} could not be loaded from metadata or the API.`,
    );
  }

  const base = metadataToken ?? tokenFromCosmicSignatureInfo(info!);
  const infoOwner = participantAddress(info?.CurOwnerAddr);
  const mintedAt =
    tokenHistory?.find((record) => record.kind === "mint")?.dateTime ??
    base.mintedAt ??
    info?.Tx?.DateTime;

  return {
    ...base,
    name: info?.TokenName?.trim() || base.name,
    owner: infoOwner ?? base.owner,
    traits: [
      ...base.traits,
      ...(info?.Staked !== undefined
        ? [{ label: "Staked", value: info.Staked ? "Yes" : "No" }]
        : []),
    ],
    mintedAt,
    tokenHistory,
  };
}
