import type { MarketToken, TokenMediaAssets } from "@/lib/marketplace/types";
import { z } from "zod";

const COSMIC_SIGNATURE_NFT_API_URL = "https://nfts.cosmicsignature.com";
const COSMIC_SIGNATURE_APP_URL = "https://app.cosmicsignature.com";
const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;
const COSMIC_SIGNATURE_REFRESH_SECONDS = 60;
const COSMIC_SIGNATURE_TIMEOUT_MS = 8_000;

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

type CosmicSignatureMetadataAttribute = z.infer<
  typeof cosmicSignatureMetadataAttributeSchema
>;

export type CosmicSignatureMetadata = z.infer<
  typeof cosmicSignatureMetadataSchema
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

function coerceAddress(value: string | undefined): `0x${string}` | undefined {
  if (value?.startsWith("0x") && value.length === 42) {
    return value as `0x${string}`;
  }

  return undefined;
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

function mediaAssetsForMetadata(
  metadata: CosmicSignatureMetadata,
  seed: string,
): TokenMediaAssets {
  const image = metadata.image ?? (seed ? cosmicSignatureImageUrl(seed) : "");

  return {
    blackImage: image,
    blackThumb: seed ? cosmicSignatureThumbUrl(seed, "black") : image,
    blackSingleVideo: metadata.animation_url,
    whiteImage: image,
    whiteThumb: seed ? cosmicSignatureThumbUrl(seed, "white") : image,
    whiteSingleVideo: metadata.animation_url,
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
    assets: mediaAssetsForMetadata(metadata, seed),
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
