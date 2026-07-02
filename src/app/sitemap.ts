import type { MetadataRoute } from "next";

import { collections } from "@/config/collections";
import { getCollectionTokenIds } from "@/lib/marketplace/collection-index-live";
import {
  collectionPath,
  FAQ_PATH,
  MY_NFTS_PATH,
  tokenPath,
} from "@/lib/marketplace/routes";
import { SITE_URL } from "@/lib/seo/metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}${MY_NFTS_PATH}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}${FAQ_PATH}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...collections.map((collection) => ({
      url: `${SITE_URL}${collectionPath(collection.id)}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
  ];

  const tokenRoutes = (
    await Promise.all(
      collections.map(async (collection) => {
        const tokenIds = await getCollectionTokenIds(collection.id);
        return tokenIds.map((tokenId) => ({
          url: `${SITE_URL}${tokenPath(collection.id, tokenId)}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        }));
      }),
    )
  ).flat();

  return [...staticRoutes, ...tokenRoutes];
}
