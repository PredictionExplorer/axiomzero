import type {
  CollectionId,
  MarketOffer,
  MarketToken,
  TokenHistoryRecord,
} from "@/lib/marketplace/types";
import { isDisplayableOffer } from "@/lib/marketplace/offers";
import { formatEth, shortenAddress } from "@/lib/utils";

export type TokenTheme = "black" | "white";
export type TokenMediaMode = "image" | "single" | "triple";
export type TokenDetailTab = "market" | "history" | "notes";

export type TokenDetailState = {
  theme: TokenTheme;
  media: TokenMediaMode;
  tab: TokenDetailTab;
};

export type TokenMediaSelection =
  | {
      type: "image";
      src: string;
      theme: TokenTheme;
      media: "image";
      requestedMedia: TokenMediaMode;
      unavailableMessage?: string;
    }
  | {
      type: "video";
      src: string;
      theme: TokenTheme;
      media: "single" | "triple";
      requestedMedia: TokenMediaMode;
      unavailableMessage?: string;
    };

export type TokenMediaOption = {
  id: TokenMediaMode;
  label: string;
  href: string;
  isActive: boolean;
};

export type TokenThemeOption = {
  id: TokenTheme;
  label: string;
  href: string;
  isActive: boolean;
};

export type TokenHistoryViewRecord = {
  key: string;
  title: string;
  subtitle: string;
  date: string;
  price?: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const defaultState: TokenDetailState = {
  theme: "black",
  media: "image",
  tab: "market",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isDistinct(left: string | undefined, right: string | undefined) {
  return Boolean(left && left !== right);
}

function mediaLabel(media: TokenMediaMode) {
  if (media === "single") {
    return "Single video";
  }
  if (media === "triple") {
    return "Triple video";
  }

  return "Image";
}

function imageForTheme(token: MarketToken, theme: TokenTheme) {
  if (theme === "white") {
    return token.assets?.whiteImage ?? token.artwork.image;
  }

  return token.assets?.blackImage ?? token.artwork.image;
}

function videoForTheme(
  token: MarketToken,
  theme: TokenTheme,
  media: Exclude<TokenMediaMode, "image">,
) {
  if (theme === "white") {
    return media === "single"
      ? token.assets?.whiteSingleVideo
      : token.assets?.whiteTripleVideo;
  }

  return media === "single"
    ? token.assets?.blackSingleVideo
    : token.assets?.blackTripleVideo;
}

function historyTitle(record: TokenHistoryRecord) {
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const hasPrice = record.price !== undefined && record.price > 0;
  const hasBuyer = Boolean(record.buyer && record.buyer !== zeroAddress);
  const hasSeller = Boolean(record.seller && record.seller !== zeroAddress);

  if (hasPrice && hasBuyer && hasSeller) {
    return "Sale";
  }
  if (hasPrice && hasBuyer) {
    return "Mint";
  }
  if (record.owner) {
    return "Transfer";
  }

  return `Record ${record.recordType}`;
}

function participantSummary(record: TokenHistoryRecord) {
  if (record.buyer && record.seller) {
    return `${shortenAddress(record.seller)} to ${shortenAddress(record.buyer)}`;
  }
  if (record.buyer) {
    return `Buyer ${shortenAddress(record.buyer)}`;
  }
  if (record.owner) {
    return `Owner ${shortenAddress(record.owner)}`;
  }
  if (record.seller) {
    return `Seller ${shortenAddress(record.seller)}`;
  }

  return `Block ${record.blockNumber.toLocaleString("en-US")}`;
}

export function parseTokenDetailState(searchParams: SearchParams) {
  const requestedTheme = firstValue(searchParams.theme);
  const requestedMedia = firstValue(searchParams.media);
  const requestedTab = firstValue(searchParams.tab);

  return {
    theme: requestedTheme === "white" ? "white" : defaultState.theme,
    media:
      requestedMedia === "single" || requestedMedia === "triple"
        ? requestedMedia
        : defaultState.media,
    tab:
      requestedTab === "history" || requestedTab === "notes"
        ? requestedTab
        : defaultState.tab,
  } satisfies TokenDetailState;
}

export function tokenDetailHref(
  collectionId: CollectionId,
  tokenId: number,
  state: TokenDetailState,
  overrides: Partial<TokenDetailState> = {},
) {
  const nextState = { ...state, ...overrides };
  const params = new URLSearchParams({
    theme: nextState.theme,
    media: nextState.media,
    tab: nextState.tab,
  });

  return `/token/${collectionId}/${tokenId}?${params.toString()}`;
}

export function availableThemes(token: MarketToken) {
  const assets = token.assets;
  const hasMeaningfulWhiteTheme =
    isDistinct(assets?.whiteImage, assets?.blackImage ?? token.artwork.image) ||
    isDistinct(assets?.whiteSingleVideo, assets?.blackSingleVideo) ||
    isDistinct(assets?.whiteTripleVideo, assets?.blackTripleVideo);

  return hasMeaningfulWhiteTheme
    ? (["black", "white"] as const)
    : (["black"] as const);
}

export function availableMediaModes(token: MarketToken, theme: TokenTheme) {
  const modes: TokenMediaMode[] = ["image"];

  if (videoForTheme(token, theme, "single")) {
    modes.push("single");
  }
  if (videoForTheme(token, theme, "triple")) {
    modes.push("triple");
  }

  return modes;
}

export function resolveTokenMedia(
  token: MarketToken,
  requestedState: TokenDetailState,
): TokenMediaSelection {
  const themes = availableThemes(token);
  const theme = themes.some(
    (availableTheme) => availableTheme === requestedState.theme,
  )
    ? requestedState.theme
    : "black";
  const modes = availableMediaModes(token, theme);

  if (
    requestedState.media !== "image" &&
    modes.includes(requestedState.media)
  ) {
    return {
      type: "video",
      src: videoForTheme(token, theme, requestedState.media)!,
      theme,
      media: requestedState.media,
      requestedMedia: requestedState.media,
    };
  }

  const unavailableMessage =
    requestedState.media !== "image"
      ? `${mediaLabel(requestedState.media)} is not available for this token yet. Showing the still image instead.`
      : undefined;

  return {
    type: "image",
    src: imageForTheme(token, theme),
    theme,
    media: "image",
    requestedMedia: requestedState.media,
    unavailableMessage,
  };
}

export function buildTokenMediaModel(
  collectionId: CollectionId,
  token: MarketToken,
  requestedState: TokenDetailState,
) {
  const selectedMedia = resolveTokenMedia(token, requestedState);
  const resolvedState = {
    ...requestedState,
    theme: selectedMedia.theme,
    media: selectedMedia.media,
  } satisfies TokenDetailState;

  return {
    state: resolvedState,
    selectedMedia,
    themeOptions: availableThemes(token).map((theme) => ({
      id: theme,
      label: theme === "black" ? "Dark" : "Light",
      href: tokenDetailHref(collectionId, token.tokenId, resolvedState, {
        theme,
        media: "image",
      }),
      isActive: theme === selectedMedia.theme,
    })) satisfies TokenThemeOption[],
    mediaOptions: availableMediaModes(token, selectedMedia.theme).map(
      (media) => ({
        id: media,
        label: mediaLabel(media),
        href: tokenDetailHref(collectionId, token.tokenId, resolvedState, {
          media,
        }),
        isActive: media === selectedMedia.media,
      }),
    ) satisfies TokenMediaOption[],
  };
}

export function formatFullDate(value: string | undefined) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function primaryTokenTrait(token: MarketToken) {
  if (token.rating !== undefined) {
    return {
      label: "Beauty score",
      value: token.rating.toFixed(2),
    };
  }

  const primaryTrait = token.traits.find(
    (trait) => trait.label.toLowerCase() !== "seed",
  );

  return {
    label: primaryTrait?.label ?? "Primary trait",
    value: primaryTrait?.value ?? "Not available",
  };
}

export function visibleTokenTraits(token: MarketToken) {
  const hiddenLabels = new Set(["seed"]);

  return token.traits.filter(
    (trait) => !hiddenLabels.has(trait.label.toLowerCase()),
  );
}

export function formatHistoryRecords(records: TokenHistoryRecord[] = []) {
  return records
    .slice()
    .reverse()
    .map((record) => ({
      key: `${record.blockNumber}-${record.timestamp}-${record.offerId ?? record.recordType}`,
      title: historyTitle(record),
      subtitle: participantSummary(record),
      date: formatFullDate(record.dateTime),
      price: record.price ? formatEth(record.price) : undefined,
    })) satisfies TokenHistoryViewRecord[];
}

export function sortOffersForDisplay(
  offers: MarketOffer[],
  kind: "buy" | "sell",
) {
  return offers
    .filter((offer) => offer.kind === kind && isDisplayableOffer(offer))
    .sort((left, right) =>
      kind === "buy"
        ? right.priceEth - left.priceEth
        : left.priceEth - right.priceEth,
    );
}
