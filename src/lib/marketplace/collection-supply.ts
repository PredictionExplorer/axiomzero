import type { Collection } from "@/lib/marketplace/types";

const numberFormatter = new Intl.NumberFormat("en-US");

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
