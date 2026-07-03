export type GlossaryTerm = {
  term: string;
  definition: string;
};

/**
 * Single source of truth for marketplace jargon. Tooltips across the site and
 * the glossary grid on the FAQ page both read from here so wording stays
 * consistent.
 */
export const GLOSSARY = {
  floorPrice: {
    term: "Floor price",
    definition:
      "The cheapest NFT currently listed for sale in a collection. It updates live as listings are created, filled, or cancelled.",
  },
  topBid: {
    term: "Top bid",
    definition:
      "The highest active buy offer right now. Bids stay open on-chain until they are accepted or cancelled.",
  },
  listing: {
    term: "Listing",
    definition:
      "A sell offer created by an NFT's owner. Anyone can accept it with Buy now at the listed price while it stays active.",
  },
  bid: {
    term: "Bid",
    definition:
      "A buy offer from a collector. The ETH is held by the marketplace contract while the bid is open and returned if it is cancelled.",
  },
  orderBook: {
    term: "Order book",
    definition:
      "All active listings and bids for a token, read directly from the verified marketplace contract on Arbitrum.",
  },
  seed: {
    term: "Seed",
    definition:
      "The unique on-chain value that deterministically generates this artwork. The same seed always reproduces the same piece.",
  },
  provenance: {
    term: "Provenance",
    definition:
      "The recorded life of a token: mint, transfers, and sales with prices where available.",
  },
  beautyScore: {
    term: "Beauty score",
    definition:
      "A numeric aesthetic rating published with Random Walk token metadata. Descriptive only; it does not affect trading.",
  },
  gas: {
    term: "Gas",
    definition:
      "The small fee the Arbitrum network charges to process a transaction. It goes to the network, never to Axiom Zero.",
  },
  minted: {
    term: "Minted",
    definition:
      "The date the token was created on-chain, marking the start of its provenance.",
  },
  marketplaceApproval: {
    term: "Marketplace approval",
    definition:
      "A one-time ERC-721 permission per collection that lets the verified marketplace contract transfer your NFT when a sale completes.",
  },
  unlisted: {
    term: "Unlisted",
    definition:
      "This token has no active sell offer. You can still place a bid the owner may accept.",
  },
  anchored: {
    term: "Anchor status",
    definition:
      "An NFT can be anchored on cosmicsignature.com exactly once, ever — the anchor never resets. Never-anchored tokens keep that option open and often carry a premium. Status is read live from Arbitrum.",
  },
} as const satisfies Record<string, GlossaryTerm>;

export type GlossaryKey = keyof typeof GLOSSARY;

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = Object.values(GLOSSARY);
