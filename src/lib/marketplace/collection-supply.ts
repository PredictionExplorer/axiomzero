import type { Collection } from "@/lib/marketplace/types";

const numberFormatter = new Intl.NumberFormat("en-US");

/**
 * Token count implied by the configured token id range, for when the live
 * totalSupply read is unavailable. tokenRange.end is the highest token id,
 * not a count, so the range is inclusive on both ends.
 */
export function fallbackCollectionSupply(
  collection: Pick<Collection, "tokenRange">,
) {
  return collection.tokenRange.end - collection.tokenRange.start + 1;
}

export function formatCollectionSupplyLabel(
  collection: Pick<Collection, "supplyNoun">,
  supply: number | undefined,
) {
  if (supply === undefined) {
    return "Live supply unavailable";
  }

  const noun =
    supply === 1 ? collection.supplyNoun.singular : collection.supplyNoun.plural;

  return `${numberFormatter.format(supply)} ${noun}`;
}
