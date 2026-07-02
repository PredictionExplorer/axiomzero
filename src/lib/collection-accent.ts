import type { Collection, CollectionId } from "@/lib/marketplace/types";
import { requireCollection } from "@/config/collections";

export type CollectionAccent = "copper" | "chartreuse";

export function getCollectionAccent(
  collection: Collection | CollectionId,
): CollectionAccent {
  const resolved =
    typeof collection === "string" ? requireCollection(collection) : collection;

  return resolved.accent === "chartreuse" ? "chartreuse" : "copper";
}

export function accentDataAttribute(
  collection: Collection | CollectionId,
): { "data-accent": CollectionAccent } {
  return { "data-accent": getCollectionAccent(collection) };
}
