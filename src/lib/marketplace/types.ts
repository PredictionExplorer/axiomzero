export type CollectionId = "random-walk" | "cosmic-signature";

export type OfferKind = "sell" | "buy";

export type SortKey = "price-asc" | "price-desc" | "recent";

export type MarketplaceView = "discover" | "listings" | "top-bids";

/**
 * Anchor status filter: "never" keeps tokens that were never anchored on
 * cosmicsignature.com, "anchored" keeps tokens whose one-time anchor is used.
 */
export type AnchorStatusFilter = "never" | "anchored";

export type Collection = {
  id: CollectionId;
  name: string;
  shortName: string;
  description: string;
  artSystem: string;
  nftAddress: `0x${string}`;
  marketplaceAddress: `0x${string}`;
  /**
   * Cosmic Signature anchoring wallet that tracks the collection's one-time
   * anchor usage on-chain (usedNfts mapping).
   */
  anchoringWalletAddress: `0x${string}`;
  externalUrl: string;
  accent: string;
  supplyNoun: {
    singular: string;
    plural: string;
  };
  tokenRange: {
    start: number;
    end: number;
  };
};

export type MarketOffer = {
  id: string;
  offerId?: number;
  collectionId: CollectionId;
  tokenId: number;
  kind: OfferKind;
  priceEth: number;
  maker: `0x${string}`;
  taker?: `0x${string}`;
  createdAt: string;
  active?: boolean;
  artwork?: TokenArtwork;
};

export type TokenArtwork = {
  image: string;
  alt: string;
};

export type TokenMediaAssets = {
  blackImage?: string;
  blackThumb?: string;
  blackSingleVideo?: string;
  blackTripleVideo?: string;
  whiteImage?: string;
  whiteThumb?: string;
  whiteSingleVideo?: string;
  whiteTripleVideo?: string;
};

/**
 * Semantic event type of a provenance record, normalized across the
 * per-collection Go backends. "other" covers record types the backend may add
 * later; renderers must handle it.
 */
export type TokenHistoryEventKind =
  | "mint"
  | "transfer"
  | "listing"
  | "bid"
  | "sale"
  | "offer-canceled"
  | "named"
  | "other";

export type TokenHistoryRecord = {
  kind: TokenHistoryEventKind;
  recordType: number;
  blockNumber: number;
  timestamp: number;
  dateTime: string;
  owner?: `0x${string}`;
  seller?: `0x${string}`;
  buyer?: `0x${string}`;
  from?: `0x${string}`;
  to?: `0x${string}`;
  price?: number;
  offerId?: number;
  /** New token name for "named" records. */
  name?: string;
};

export type MarketToken = {
  collectionId: CollectionId;
  tokenId: number;
  name: string;
  owner: `0x${string}`;
  seed: string;
  traits: Array<{ label: string; value: string }>;
  artwork: TokenArtwork;
  assets?: TokenMediaAssets;
  rating?: number;
  mintedAt?: string;
  tokenHistory?: TokenHistoryRecord[];
  /**
   * Whether this token's one-time cosmicsignature.com anchor has been used.
   * Undefined when the on-chain anchoring status could not be read.
   */
  anchored?: boolean;
};

export type MarketplaceSearchParams = {
  collection?: CollectionId | "all";
  kind?: OfferKind | "all";
  view?: MarketplaceView;
  query?: string;
  min?: number;
  max?: number;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  listedOnly?: boolean;
  anchor?: AnchorStatusFilter;
};

export type MarketplaceStats = {
  totalOffers: number;
  floorOffer?: MarketOffer;
  topBidOffer?: MarketOffer;
  sellListings: number;
  buyOffers: number;
};

/**
 * A completed marketplace sale reconstructed from an on-chain ItemBought
 * event joined with its offer record.
 */
export type MarketSale = {
  collectionId: CollectionId;
  tokenId: number;
  offerId: number;
  priceEth: number;
  seller: `0x${string}`;
  buyer: `0x${string}`;
  blockNumber: number;
  /** ISO timestamp; only enriched for the most recent sales. */
  soldAt?: string;
};

export type SalesSummary = {
  count: number;
  volumeEth: number;
  /** Most recent sale. */
  lastSale?: MarketSale;
  /** Highest-priced sale. */
  topSale?: MarketSale;
};

export type TokenMarketSummary = {
  token: MarketToken;
  activeSellOffer?: MarketOffer;
  highestBid?: MarketOffer;
  offers: MarketOffer[];
};

export type MarketplaceTokenPage = {
  items: TokenMarketSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
