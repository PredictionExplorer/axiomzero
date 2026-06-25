import type {
  MarketToken,
  TokenMediaAssets,
} from "@/lib/marketplace/types";

const COSMIC_SIGNATURE_NFT_API_URL = "https://nfts.cosmicsignature.com";
const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;
const COSMIC_SIGNATURE_REFRESH_SECONDS = 60;

type CosmicSignatureMetadataAttribute = {
  display_type?: string;
  trait_type?: string;
  value?: string | number;
};

export type CosmicSignatureMetadata = {
  animation_url?: string;
  attributes?: CosmicSignatureMetadataAttribute[];
  image?: string;
  name?: string;
  properties?: {
    owner?: string;
    round_num?: number;
    seed?: string | number;
    token_id?: number;
  };
};

function formatCosmicSignatureName(tokenId: number) {
  return `Cosmic Signature #${tokenId}`;
}

function normalizeSeed(value: string | number | undefined) {
  if (value === undefined) {
    return "";
  }

  return String(value).replace(/^0x/i, "");
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

export async function fetchCosmicSignatureMetadata(tokenId: number) {
  const response = await fetch(
    `${COSMIC_SIGNATURE_NFT_API_URL}/metadata/${tokenId}`,
    { next: { revalidate: COSMIC_SIGNATURE_REFRESH_SECONDS } },
  );

  if (!response.ok) {
    throw new Error(`Cosmic Signature metadata returned ${response.status}.`);
  }

  return tokenFromCosmicSignatureMetadata(
    tokenId,
    (await response.json()) as CosmicSignatureMetadata,
  );
}
