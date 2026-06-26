import type { MarketOffer } from "@/lib/marketplace/types";

export function isDisplayableOffer(offer: MarketOffer) {
  return (
    offer.active !== false &&
    Number.isFinite(offer.priceEth) &&
    offer.priceEth > 0
  );
}
