import type {
  MarketOffer,
  MarketToken,
  OfferKind,
  SortKey,
  TokenHistoryRecord,
  TokenMediaAssets,
} from "@/lib/marketplace/types";

const RANDOM_WALK_SITE_URL = "https://randomwalknft.com";
const RANDOM_WALK_API_URL = "https://api.randomwalknft.com:1443";
const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;
const RANDOM_WALK_REFRESH_SECONDS = 60;

type RandomWalkMetadata = {
  animation_url?: string;
  attributes?: Array<{ trait_type?: string; value?: string | number }>;
  image?: string;
  name?: string;
  properties?: { seed?: string };
};

type RandomWalkRawOffer = {
  id: number;
  offerId: number;
  tokenId: number;
  seller: string;
  buyer: string;
  price: number;
  active: boolean;
  createdAt: string;
  createdAtTimestamp: number;
  kind: OfferKind;
};

type RandomWalkRawHistory = {
  recordType: number;
  blockNumber: number;
  timestamp: number;
  dateTime: string;
  owner?: string;
  seller?: string;
  buyer?: string;
  price?: number;
  offerId?: number | string;
};

type RandomWalkDetailPayload = {
  nft: {
    id: number;
    name?: string;
    owner: string;
    seed: string;
    rating?: number;
    assets?: TokenMediaAssets;
    tokenHistory?: RandomWalkRawHistory[];
    mintedAt?: string;
  };
  buyOffers?: RandomWalkRawOffer[];
  sellOffers?: RandomWalkRawOffer[];
};

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

  const payload = JSON.parse(payloadText) as RandomWalkDetailPayload;
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

  const response = await fetch(
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
  const response = await fetch(`${RANDOM_WALK_SITE_URL}/detail/${tokenId}`, {
    next: { revalidate: RANDOM_WALK_REFRESH_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Random Walk token detail returned ${response.status}.`);
  }

  return parseRandomWalkDetailHtml(await response.text());
}

export async function fetchRandomWalkMetadata(tokenId: number) {
  const response = await fetch(
    `${RANDOM_WALK_API_URL}/api/randomwalk/metadata/${tokenId}`,
    { next: { revalidate: RANDOM_WALK_REFRESH_SECONDS } },
  );

  if (!response.ok) {
    throw new Error(`Random Walk metadata returned ${response.status}.`);
  }

  return tokenFromRandomWalkMetadata(
    tokenId,
    (await response.json()) as RandomWalkMetadata,
  );
}
