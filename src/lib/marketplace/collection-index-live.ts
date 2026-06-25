import { cache } from "react";
import { createPublicClient, http } from "viem";
import { arbitrum } from "viem/chains";

import { requireCollection } from "@/config/collections";
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

export async function fetchCollectionTokenIds({
  collectionId,
  client = createErc721PublicClient(),
}: FetchCollectionTokenIdsOptions) {
  const collection = requireCollection(collectionId);

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
  } catch {
    return fallbackCollectionTokenIds(collection);
  }
}

export async function fetchCollectionSupply({
  collectionId,
  client = createErc721PublicClient(),
}: FetchCollectionSupplyOptions) {
  const collection = requireCollection(collectionId);

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
