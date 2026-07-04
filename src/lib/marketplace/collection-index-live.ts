import { cache } from "react";
import { createPublicClient, http } from "viem";
import { arbitrum } from "viem/chains";

import { requireCollection } from "@/config/collections";
import { fetchCosmicSignatureTokenIds } from "@/lib/marketplace/cosmic-signature-live";
import { coerceAddress } from "@/lib/marketplace/eth";
import type { Collection, CollectionId } from "@/lib/marketplace/types";
import { erc721Abi } from "@/lib/web3/abis";

type Erc721ReadCall = {
  address: `0x${string}`;
  abi: typeof erc721Abi;
  functionName: string;
  args?: readonly unknown[];
};

export type Erc721IndexClient = {
  readContract: (call: Erc721ReadCall) => Promise<unknown>;
  multicall: (call: {
    allowFailure: true;
    contracts: readonly Erc721ReadCall[];
  }) => Promise<
    Array<
      | { status: "success"; result: unknown }
      | { status: "failure"; error: unknown }
    >
  >;
};

type FetchCollectionTokenIdsOptions = {
  collectionId: CollectionId;
  client?: Erc721IndexClient;
};

type FetchCollectionSupplyOptions = {
  collectionId: CollectionId;
  client?: Pick<Erc721IndexClient, "readContract">;
};

type FetchCollectionTokenUriOptions = {
  collectionId: CollectionId;
  tokenId: number;
  client?: Pick<Erc721IndexClient, "readContract">;
};

function createErc721PublicClient(): Erc721IndexClient {
  return createPublicClient({
    chain: arbitrum,
    transport: http(
      process.env.ARBITRUM_RPC_URL ??
        process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ??
        "https://arb1.arbitrum.io/rpc",
      // Batching folds the tokenByIndex multicall chunks into a few HTTP
      // requests so rate-limited public RPCs do not drop the scan. Timeouts
      // keep server renders bounded; token id reads fall back to configured
      // ranges.
      { batch: true, timeout: 5_000, retryCount: 1 },
    ),
  }) as unknown as Erc721IndexClient;
}

export function fallbackCollectionTokenIds(collection: Collection) {
  return Array.from(
    {
      length: collection.tokenRange.end - collection.tokenRange.start + 1,
    },
    (_, index) => collection.tokenRange.start + index,
  );
}

function uniqueSortedTokenIds(tokenIds: number[]) {
  return [...new Set(tokenIds)].sort((left, right) => left - right);
}

async function fetchOnChainCollectionTokenIds(
  collection: Collection,
  client: Erc721IndexClient,
) {
  const totalSupply = (await client.readContract({
    address: collection.nftAddress,
    abi: erc721Abi,
    functionName: "totalSupply",
  })) as bigint;
  const count = Number(totalSupply);

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`${collection.shortName} totalSupply is invalid.`);
  }

  if (count === 0) {
    return [];
  }

  const results = await client.multicall({
    allowFailure: true,
    contracts: Array.from({ length: count }, (_, index) => ({
      address: collection.nftAddress,
      abi: erc721Abi,
      functionName: "tokenByIndex",
      args: [BigInt(index)],
    })),
  });
  const tokenIds = results.flatMap((result) =>
    result.status === "success" && typeof result.result === "bigint"
      ? [Number(result.result)]
      : [],
  );

  if (!tokenIds.length) {
    throw new Error(`${collection.shortName} token index is unavailable.`);
  }

  return uniqueSortedTokenIds(tokenIds);
}

export async function fetchCollectionTokenIds({
  collectionId,
  client = createErc721PublicClient(),
}: FetchCollectionTokenIdsOptions) {
  const collection = requireCollection(collectionId);

  // The Cosmic Signature Go API serves the minted token list directly, which
  // avoids a totalSupply + tokenByIndex multicall against a public RPC.
  if (collectionId === "cosmic-signature") {
    try {
      const tokenIds = await fetchCosmicSignatureTokenIds();

      if (tokenIds.length) {
        return tokenIds;
      }
    } catch {
      // Fall through to the on-chain index.
    }
  }

  try {
    return await fetchOnChainCollectionTokenIds(collection, client);
  } catch {
    return fallbackCollectionTokenIds(collection);
  }
}

export async function fetchCollectionSupply({
  collectionId,
  client = createErc721PublicClient(),
}: FetchCollectionSupplyOptions) {
  const collection = requireCollection(collectionId);

  if (collectionId === "cosmic-signature") {
    try {
      const tokenIds = await fetchCosmicSignatureTokenIds();

      if (tokenIds.length) {
        return tokenIds.length;
      }
    } catch {
      // Fall through to the on-chain read.
    }
  }

  try {
    const totalSupply = (await client.readContract({
      address: collection.nftAddress,
      abi: erc721Abi,
      functionName: "totalSupply",
    })) as bigint;
    const count = Number(totalSupply);

    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`${collection.shortName} totalSupply is invalid.`);
    }

    return count;
  } catch {
    return undefined;
  }
}

/**
 * Current on-chain owner of a token. Used to enrich fallback token data so a
 * token never renders with the zero address when the collection API is down.
 */
export async function fetchCollectionTokenOwner({
  collectionId,
  tokenId,
  client = createErc721PublicClient(),
}: FetchCollectionTokenUriOptions): Promise<`0x${string}` | undefined> {
  const collection = requireCollection(collectionId);
  const owner = (await client.readContract({
    address: collection.nftAddress,
    abi: erc721Abi,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  })) as string;

  return coerceAddress(owner);
}

export const getCollectionTokenIds = cache(async (collectionId: CollectionId) =>
  fetchCollectionTokenIds({ collectionId }),
);

export const getCollectionSupply = cache(async (collectionId: CollectionId) =>
  fetchCollectionSupply({ collectionId }),
);

export async function fetchCollectionTokenUri({
  collectionId,
  tokenId,
  client = createErc721PublicClient(),
}: FetchCollectionTokenUriOptions) {
  const collection = requireCollection(collectionId);

  return (await client.readContract({
    address: collection.nftAddress,
    abi: erc721Abi,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  })) as string;
}
