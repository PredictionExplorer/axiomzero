import { cache } from "react";

import { collections, requireCollection } from "@/config/collections";
import {
  getMarketplaceOffers,
  getMarketplaceStats,
  getToken,
} from "@/lib/marketplace/queries";
import { getCollectionSupply } from "@/lib/marketplace/collection-index-live";
import { fallbackCollectionSupply } from "@/lib/marketplace/collection-supply";
import {
  getCollectionSales,
  summarizeSales,
} from "@/lib/marketplace/sales-live";
import { fetchCosmicSignatureMetadata } from "@/lib/marketplace/cosmic-signature-live";
import { randomWalkTokenPreview } from "@/lib/marketplace/random-walk-live";
import type {
  CollectionId,
  MarketOffer,
  MarketSale,
  SalesSummary,
  TokenArtwork,
} from "@/lib/marketplace/types";

export type HomeCollectionPulse = {
  collectionId: CollectionId;
  shortName: string;
  supply: number;
  stats: ReturnType<typeof getMarketplaceStats>;
  /** Undefined when the on-chain sales scan is unavailable. */
  sales?: SalesSummary;
};

export type HomeArtworkItem = {
  collectionId: CollectionId;
  tokenId: number;
  name: string;
  artwork: TokenArtwork;
  priceEth?: number;
};

export type HomeRecentSale = MarketSale & {
  name: string;
  artwork?: TokenArtwork;
};

export type HomeActivity = {
  totalSales: number;
  totalVolumeEth: number;
  activeOrders: number;
  perCollection: Array<{
    collectionId: CollectionId;
    shortName: string;
    sales: SalesSummary;
  }>;
  recentSales: HomeRecentSale[];
};

export type HomeMarketOverview = {
  pulses: HomeCollectionPulse[];
  featured: HomeArtworkItem[];
  /** Undefined when no collection's sales data could be loaded. */
  activity?: HomeActivity;
};

const heroTokenIds: Record<CollectionId, number[]> = {
  "random-walk": [1, 42, 127],
  "cosmic-signature": [0, 3, 7],
};

const getCollectionOffersSnapshot = cache(
  async (collectionId: CollectionId): Promise<MarketOffer[]> => {
    try {
      return await getMarketplaceOffers({
        collection: collectionId,
        kind: "all",
        sort: "price-asc",
        view: "discover",
      });
    } catch {
      return [];
    }
  },
);

function featuredFromOffers(offers: MarketOffer[], limit: number) {
  return offers
    .filter(
      (offer) =>
        offer.kind === "sell" && offer.active !== false && offer.artwork,
    )
    .sort((left, right) => left.priceEth - right.priceEth)
    .slice(0, limit)
    .map((offer) => {
      const collection = requireCollection(offer.collectionId);

      return {
        collectionId: offer.collectionId,
        tokenId: offer.tokenId,
        name: `${collection.shortName} #${offer.tokenId}`,
        artwork: offer.artwork as TokenArtwork,
        priceEth: offer.priceEth,
      } satisfies HomeArtworkItem;
    });
}

async function recentSaleArtwork(
  sale: MarketSale,
): Promise<TokenArtwork | undefined> {
  try {
    if (sale.collectionId === "random-walk") {
      return randomWalkTokenPreview(sale.tokenId).artwork;
    }

    return (await fetchCosmicSignatureMetadata(sale.tokenId)).artwork;
  } catch {
    return undefined;
  }
}

async function enrichRecentSales(
  sales: MarketSale[],
): Promise<HomeRecentSale[]> {
  return Promise.all(
    sales.map(async (sale) => {
      const collection = requireCollection(sale.collectionId);

      return {
        ...sale,
        name: `${collection.shortName} #${sale.tokenId}`,
        artwork: await recentSaleArtwork(sale),
      };
    }),
  );
}

function buildHomeActivity(
  perCollection: Array<{
    pulse: HomeCollectionPulse;
    sales: MarketSale[] | undefined;
  }>,
): { totals: Omit<HomeActivity, "recentSales">; recent: MarketSale[] } | undefined {
  const withSales = perCollection.filter(
    (entry): entry is typeof entry & { sales: MarketSale[] } =>
      entry.sales !== undefined,
  );

  if (!withSales.length) {
    return undefined;
  }

  const summaries = withSales.map((entry) => ({
    collectionId: entry.pulse.collectionId,
    shortName: entry.pulse.shortName,
    sales: summarizeSales(entry.sales),
  }));

  return {
    totals: {
      totalSales: summaries.reduce((sum, entry) => sum + entry.sales.count, 0),
      totalVolumeEth: summaries.reduce(
        (sum, entry) => sum + entry.sales.volumeEth,
        0,
      ),
      activeOrders: perCollection.reduce(
        (sum, entry) => sum + entry.pulse.stats.totalOffers,
        0,
      ),
      perCollection: summaries,
    },
    recent: withSales
      .flatMap((entry) => entry.sales)
      .sort((left, right) => right.blockNumber - left.blockNumber),
  };
}

export async function getHomeMarketOverview(
  featuredLimit = 8,
  recentSalesLimit = 8,
): Promise<HomeMarketOverview> {
  const perCollection = await Promise.all(
    collections.map(async (collection) => {
      const [offers, supply, sales] = await Promise.all([
        getCollectionOffersSnapshot(collection.id),
        getCollectionSupply(collection.id).catch(() => undefined),
        getCollectionSales(collection.id).catch(() => undefined),
      ]);

      return {
        pulse: {
          collectionId: collection.id,
          shortName: collection.shortName,
          supply: supply ?? fallbackCollectionSupply(collection),
          stats: getMarketplaceStats(offers),
          sales: sales ? summarizeSales(sales) : undefined,
        } satisfies HomeCollectionPulse,
        offers,
        sales,
      };
    }),
  );
  const activity = buildHomeActivity(perCollection);

  return {
    pulses: perCollection.map((entry) => entry.pulse),
    featured: featuredFromOffers(
      perCollection.flatMap((entry) => entry.offers),
      featuredLimit,
    ),
    activity: activity
      ? {
          ...activity.totals,
          recentSales: await enrichRecentSales(
            activity.recent.slice(0, recentSalesLimit),
          ),
        }
      : undefined,
  };
}

async function loadHeroArtwork(
  collectionId: CollectionId,
  tokenId: number,
): Promise<HomeArtworkItem | undefined> {
  try {
    const token = await getToken(collectionId, tokenId);

    return {
      collectionId,
      tokenId: token.tokenId,
      name: token.name,
      artwork: token.artwork,
    };
  } catch {
    return undefined;
  }
}

export async function getHomeHeroArtworks(): Promise<HomeArtworkItem[]> {
  const items = await Promise.all(
    collections.flatMap((collection) =>
      heroTokenIds[collection.id].map((tokenId) =>
        loadHeroArtwork(collection.id, tokenId),
      ),
    ),
  );

  return items.filter((item): item is HomeArtworkItem => Boolean(item));
}

export function pickArtSystemShowcases(heroArtworks: HomeArtworkItem[]) {
  return collections.map((collection) =>
    heroArtworks.find((item) => item.collectionId === collection.id),
  );
}
