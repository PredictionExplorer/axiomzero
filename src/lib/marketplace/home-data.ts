import { cache } from "react";

import { collections, requireCollection } from "@/config/collections";
import {
  getMarketplaceOffers,
  getMarketplaceStats,
  getToken,
} from "@/lib/marketplace/queries";
import { getCollectionSupply } from "@/lib/marketplace/collection-index-live";
import type {
  CollectionId,
  MarketOffer,
  TokenArtwork,
} from "@/lib/marketplace/types";

export type HomeCollectionPulse = {
  collectionId: CollectionId;
  shortName: string;
  supply: number;
  stats: ReturnType<typeof getMarketplaceStats>;
};

export type HomeArtworkItem = {
  collectionId: CollectionId;
  tokenId: number;
  name: string;
  artwork: TokenArtwork;
  priceEth?: number;
};

export type HomeMarketOverview = {
  pulses: HomeCollectionPulse[];
  featured: HomeArtworkItem[];
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

export async function getHomeMarketOverview(
  featuredLimit = 8,
): Promise<HomeMarketOverview> {
  const perCollection = await Promise.all(
    collections.map(async (collection) => {
      const [offers, supply] = await Promise.all([
        getCollectionOffersSnapshot(collection.id),
        getCollectionSupply(collection.id).catch(() => undefined),
      ]);

      return {
        pulse: {
          collectionId: collection.id,
          shortName: collection.shortName,
          supply: supply ?? collection.tokenRange.end,
          stats: getMarketplaceStats(offers),
        } satisfies HomeCollectionPulse,
        offers,
      };
    }),
  );

  return {
    pulses: perCollection.map((entry) => entry.pulse),
    featured: featuredFromOffers(
      perCollection.flatMap((entry) => entry.offers),
      featuredLimit,
    ),
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
