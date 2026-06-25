import type {
  MarketOffer,
  MarketToken,
  OfferKind,
  SortKey,
  TokenHistoryRecord,
} from "@/lib/marketplace/types";
import { z } from "zod";

const RANDOM_WALK_SITE_URL =
  process.env.RANDOM_WALK_SITE_URL ??
  process.env.NEXT_PUBLIC_RANDOM_WALK_SITE_URL ??
  "https://randomwalknft.com";
const RANDOM_WALK_API_URL =
  process.env.RANDOM_WALK_API_URL ??
  process.env.NEXT_PUBLIC_RANDOM_WALK_API_URL ??
  "https://api.randomwalknft.com:1443";
const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;
const RANDOM_WALK_REFRESH_SECONDS = 60;
const RANDOM_WALK_TIMEOUT_MS = 8_000;

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

const randomWalkRawOfferSchema = z.object({
  id: z.number(),
  offerId: z.number(),
  tokenId: z.number(),
  seller: z.string(),
  buyer: z.string(),
  price: z.number(),
  active: z.boolean(),
  createdAt: z.string(),
  createdAtTimestamp: z.number(),
  kind: z.enum(["sell", "buy"]),
});

const randomWalkRawHistorySchema = z.object({
  recordType: z.number(),
  blockNumber: z.number(),
  timestamp: z.number(),
  dateTime: z.string(),
  owner: z.string().optional(),
  seller: z.string().optional(),
  buyer: z.string().optional(),
  price: z.number().optional(),
  offerId: z.union([z.number(), z.string()]).optional(),
});

const randomWalkDetailPayloadSchema = z.object({
  nft: z.object({
    id: z.number(),
    name: z.string().optional(),
    owner: z.string(),
    seed: z.string(),
    rating: z.number().optional(),
    assets: z
      .object({
        blackImage: z.string().optional(),
        blackThumb: z.string().optional(),
        blackSingleVideo: z.string().optional(),
        blackTripleVideo: z.string().optional(),
        whiteImage: z.string().optional(),
        whiteThumb: z.string().optional(),
        whiteSingleVideo: z.string().optional(),
        whiteTripleVideo: z.string().optional(),
      })
      .optional(),
    tokenHistory: z.array(randomWalkRawHistorySchema).optional(),
    mintedAt: z.string().optional(),
  }),
  buyOffers: z.array(randomWalkRawOfferSchema).optional(),
  sellOffers: z.array(randomWalkRawOfferSchema).optional(),
});

type RandomWalkMetadata = z.infer<typeof randomWalkMetadataSchema>;

type RandomWalkRawOffer = z.infer<typeof randomWalkRawOfferSchema>;

type RandomWalkRawHistory = z.infer<typeof randomWalkRawHistorySchema>;

async function fetchWithTimeout(
  input: string,
  init: RequestInit & { next?: { revalidate: number } },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RANDOM_WALK_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function decodeFlightMarkup(html: string) {
  return html.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/&amp;/g, "&");
}

function formatRandomWalkName(tokenId: number) {
  return `Random Walk #${String(tokenId).padStart(6, "0")}`;
}

function thumbUrl(tokenId: number) {
  return `${RANDOM_WALK_API_URL}/images/randomwalk/${String(tokenId).padStart(
    6,
    "0",
  )}_black_thumb.jpg`;
}

function coerceAddress(value: string | undefined): `0x${string}` | undefined {
  if (value?.startsWith("0x") && value.length === 42) {
    return value as `0x${string}`;
  }

  return undefined;
}

function normalizeUndefined<T>(value: T): T | undefined {
  return value === "$undefined" ? undefined : value;
}

function extractJsonObjectAt(text: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return undefined;
}

function normalizeHistory(
  records: RandomWalkRawHistory[] = [],
): TokenHistoryRecord[] {
  return records.map((record) => ({
    recordType: record.recordType,
    blockNumber: record.blockNumber,
    timestamp: record.timestamp,
    dateTime: record.dateTime,
    owner: coerceAddress(normalizeUndefined(record.owner)),
    seller: coerceAddress(normalizeUndefined(record.seller)),
    buyer: coerceAddress(normalizeUndefined(record.buyer)),
    price: record.price,
    offerId:
      typeof record.offerId === "number"
        ? record.offerId
        : Number.isFinite(Number(record.offerId))
          ? Number(record.offerId)
          : undefined,
  }));
}

function normalizeOffer(
  offer: RandomWalkRawOffer,
  artwork?: MarketOffer["artwork"],
): MarketOffer {
  const maker = coerceAddress(
    offer.kind === "sell" ? offer.seller : offer.buyer,
  );
  const taker = coerceAddress(
    offer.kind === "sell" ? offer.buyer : offer.seller,
  );

  return {
    id: `${offer.kind}-${offer.offerId}`,
    offerId: offer.offerId,
    collectionId: "random-walk",
    tokenId: offer.tokenId,
    kind: offer.kind,
    priceEth: offer.price,
    maker: maker ?? ZERO_ADDRESS,
    taker,
    createdAt: offer.createdAt,
    active: offer.active,
    artwork,
  };
}

export function parseRandomWalkMarketplaceHtml(
  html: string,
  requestedKind: OfferKind = "sell",
): MarketOffer[] {
  const decoded = decodeFlightMarkup(html);
  const offers = new Map<string, MarketOffer>();
  const visibleKeys = new Set<string>();
  const cardPattern =
    /"(sell|buy)-(\d+)"[\s\S]{0,900}?"id":(\d+),"image":"([^"]+)"[\s\S]{0,1000}?"children":\["#\d{6}"," · ","([0-9]+(?:\.[0-9]+)?) ETH"\]/g;

  for (const match of decoded.matchAll(cardPattern)) {
    const [, kind, offerId, tokenId, image, price] = match;
    const parsedKind = kind as OfferKind;
    const parsedTokenId = Number(tokenId);
    const parsedOfferId = Number(offerId);

    if (
      parsedKind !== requestedKind ||
      !Number.isFinite(parsedTokenId) ||
      match[0]?.includes("</script>")
    ) {
      continue;
    }

    const offer: MarketOffer = {
      id: `${parsedKind}-${parsedOfferId}-${parsedTokenId}-${price}`,
      offerId: Number.isFinite(parsedOfferId) ? parsedOfferId : undefined,
      collectionId: "random-walk",
      tokenId: parsedTokenId,
      kind: parsedKind,
      priceEth: Number(price),
      maker: ZERO_ADDRESS,
      createdAt: "1970-01-01T00:00:00.000Z",
      active: true,
      artwork: {
        image,
        alt: `${formatRandomWalkName(parsedTokenId)} thumbnail`,
      },
    };

    offers.set(`${offer.id}-${image}`, offer);
    visibleKeys.add(`${parsedKind}-${parsedTokenId}-${price}`);
  }

  const renderedCardPattern =
    /<a href="\/detail\/(\d+)">[\s\S]{0,1400}?<img[^>]+src="([^"]+)"[\s\S]{0,1800}?(Sell listing|Buy offer)<\/div><span[^>]*>#\d{6}<!-- --> · <!-- -->([0-9]+(?:\.[0-9]+)?) ETH<\/span>/g;

  for (const match of decoded.matchAll(renderedCardPattern)) {
    const [, tokenId, image, label, price] = match;
    const parsedKind: OfferKind = label === "Buy offer" ? "buy" : "sell";
    const parsedTokenId = Number(tokenId);
    const visibleKey = `${parsedKind}-${parsedTokenId}-${price}`;

    if (
      parsedKind !== requestedKind ||
      !Number.isFinite(parsedTokenId) ||
      visibleKeys.has(visibleKey)
    ) {
      continue;
    }

    const offer: MarketOffer = {
      id: `${parsedKind}-rendered-${parsedTokenId}-${price}`,
      collectionId: "random-walk",
      tokenId: parsedTokenId,
      kind: parsedKind,
      priceEth: Number(price),
      maker: ZERO_ADDRESS,
      createdAt: "1970-01-01T00:00:00.000Z",
      active: true,
      artwork: {
        image,
        alt: `${formatRandomWalkName(parsedTokenId)} thumbnail`,
      },
    };

    offers.set(`${offer.id}-${image}`, offer);
    visibleKeys.add(visibleKey);
  }

  return [...offers.values()];
}

export function parseRandomWalkDetailHtml(html: string): {
  token: MarketToken;
  offers: MarketOffer[];
} {
  const decoded = decodeFlightMarkup(html);
  const payloadStart = decoded.indexOf('{"nft":');
  const payloadText =
    payloadStart >= 0 ? extractJsonObjectAt(decoded, payloadStart) : undefined;

  if (!payloadText) {
    throw new Error("Random Walk detail payload was not found.");
  }

  const payload = randomWalkDetailPayloadSchema.parse(JSON.parse(payloadText));
  const tokenId = payload.nft.id;
  const artwork = {
    image:
      payload.nft.assets?.blackImage ??
      payload.nft.assets?.blackThumb ??
      thumbUrl(tokenId),
    alt: `${formatRandomWalkName(tokenId)} artwork`,
  };
  const offers = [
    ...(payload.sellOffers ?? []),
    ...(payload.buyOffers ?? []),
  ].map((offer) => normalizeOffer(offer, artwork));

  return {
    token: {
      collectionId: "random-walk",
      tokenId,
      name: payload.nft.name?.trim() || formatRandomWalkName(tokenId),
      owner: coerceAddress(payload.nft.owner) ?? ZERO_ADDRESS,
      seed: payload.nft.seed,
      traits: [
        {
          label: "Beauty score",
          value: (payload.nft.rating ?? 0).toFixed(2),
        },
        ...(payload.nft.mintedAt
          ? [{ label: "Minted", value: payload.nft.mintedAt }]
          : []),
      ],
      artwork,
      assets: payload.nft.assets,
      rating: payload.nft.rating,
      mintedAt: payload.nft.mintedAt,
      tokenHistory: normalizeHistory(payload.nft.tokenHistory),
    },
    offers,
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
      image: metadata.image ?? thumbUrl(tokenId),
      alt: `${formatRandomWalkName(tokenId)} artwork`,
    },
    assets: {
      blackImage: metadata.image,
      blackThumb: thumbUrl(tokenId),
      blackSingleVideo: metadata.animation_url,
    },
  };
}

export async function fetchRandomWalkMarketplaceOffers(
  kind: OfferKind = "sell",
  sort: SortKey = "price-asc",
) {
  const params = new URLSearchParams();

  if (kind === "buy") {
    params.set("filter", "buy");
  }

  if (sort !== "price-asc") {
    params.set("sort", sort);
  }

  const response = await fetchWithTimeout(
    `${RANDOM_WALK_SITE_URL}/marketplace${
      params.size ? `?${params.toString()}` : ""
    }`,
    { next: { revalidate: RANDOM_WALK_REFRESH_SECONDS } },
  );

  if (!response.ok) {
    throw new Error(`Random Walk marketplace returned ${response.status}.`);
  }

  return parseRandomWalkMarketplaceHtml(await response.text(), kind);
}

export async function fetchRandomWalkTokenDetail(tokenId: number) {
  const response = await fetchWithTimeout(`${RANDOM_WALK_SITE_URL}/detail/${tokenId}`, {
    next: { revalidate: RANDOM_WALK_REFRESH_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Random Walk token detail returned ${response.status}.`);
  }

  return parseRandomWalkDetailHtml(await response.text());
}

export async function fetchRandomWalkMetadata(tokenId: number) {
  const response = await fetchWithTimeout(
    `${RANDOM_WALK_API_URL}/api/randomwalk/metadata/${tokenId}`,
    { next: { revalidate: RANDOM_WALK_REFRESH_SECONDS } },
  );

  if (!response.ok) {
    throw new Error(`Random Walk metadata returned ${response.status}.`);
  }

  return tokenFromRandomWalkMetadata(
    tokenId,
    randomWalkMetadataSchema.parse(await response.json()),
  );
}
