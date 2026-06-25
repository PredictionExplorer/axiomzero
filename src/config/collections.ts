import type { Collection, CollectionId } from "@/lib/marketplace/types";

const RANDOM_WALK_NFT_ADDRESS =
  (process.env.NEXT_PUBLIC_RANDOM_WALK_NFT_ADDRESS as
    | `0x${string}`
    | undefined) ?? "0x895a6F444BE4ba9d124F61DF736605792B35D66b";

const RANDOM_WALK_MARKETPLACE_ADDRESS =
  (process.env.NEXT_PUBLIC_RANDOM_WALK_MARKETPLACE_ADDRESS as
    | `0x${string}`
    | undefined) ?? "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08";

const COSMIC_SIGNATURE_NFT_ADDRESS =
  (process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_NFT_ADDRESS as
    | `0x${string}`
    | undefined) ?? "0xbb84Be3500A63581d3F2d5AC3bdF8685AAedad25";

const COSMIC_SIGNATURE_MARKETPLACE_ADDRESS =
  (process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_MARKETPLACE_ADDRESS as
    | `0x${string}`
    | undefined) ?? "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08";

const RANDOM_WALK_MAX_TOKEN_ID = Number(
  process.env.NEXT_PUBLIC_RANDOM_WALK_MAX_TOKEN_ID ?? 4095,
);
const COSMIC_SIGNATURE_MAX_TOKEN_ID = Number(
  process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_MAX_TOKEN_ID ?? 256,
);

export const collections = [
  {
    id: "random-walk",
    name: "Random Walk NFTs",
    shortName: "Random Walk",
    description:
      "Code-born generative art from five-dimensional random walks, transparent rules, and no privileged mint lane.",
    artSystem: "Mathematics: stochastic paths",
    nftAddress: RANDOM_WALK_NFT_ADDRESS,
    marketplaceAddress: RANDOM_WALK_MARKETPLACE_ADDRESS,
    externalUrl: "https://randomwalknft.com/",
    accent: "copper",
    supplyLabel: "4,096 walks",
    tokenRange: {
      start: 0,
      end: Number.isFinite(RANDOM_WALK_MAX_TOKEN_ID)
        ? RANDOM_WALK_MAX_TOKEN_ID
        : 4095,
    },
  },
  {
    id: "cosmic-signature",
    name: "Cosmic Signature NFTs",
    shortName: "Cosmic Signature",
    description:
      "Deterministic three-body physics rendered into procedural orbital signatures through code, simulation, and foundational rules.",
    artSystem: "Algorithm: three-body physics",
    nftAddress: COSMIC_SIGNATURE_NFT_ADDRESS,
    marketplaceAddress: COSMIC_SIGNATURE_MARKETPLACE_ADDRESS,
    externalUrl: "https://cosmicsignature.com/",
    accent: "chartreuse",
    supplyLabel: "Cycle signatures",
    tokenRange: {
      start: 1,
      end: Number.isFinite(COSMIC_SIGNATURE_MAX_TOKEN_ID)
        ? COSMIC_SIGNATURE_MAX_TOKEN_ID
        : 256,
    },
  },
] satisfies Collection[];

export function getCollection(id: CollectionId) {
  return collections.find((collection) => collection.id === id);
}

export function requireCollection(id: CollectionId) {
  const collection = getCollection(id);

  if (!collection) {
    throw new Error(`Unknown collection: ${id}`);
  }

  return collection;
}
