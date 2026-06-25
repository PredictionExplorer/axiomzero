export type CollectionId = "random-walk" | "cosmic-signature";

export type OfferKind = "sell" | "buy";

export type SortKey = "price-asc" | "price-desc" | "recent";

export type MarketplaceView = "discover" | "listings" | "top-bids";

export type Collection = {
  id: CollectionId;
  name: string;
  shortName: string;
  description: string;
  artSystem: string;
  nftAddress: `0x${string}`;
  marketplaceAddress: `0x${string}`;
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

export type TokenHistoryRecord = {
  recordType: number;
  blockNumber: number;
  timestamp: number;
  dateTime: string;
  owner?: `0x${string}`;
  seller?: `0x${string}`;
  buyer?: `0x${string}`;
  price?: number;
  offerId?: number;
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
};

export type MarketplaceStats = {
  totalOffers: number;
  floorOffer?: MarketOffer;
  topBidOffer?: MarketOffer;
  sellListings: number;
  buyOffers: number;
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
