import { describe, expect, it, vi } from "vitest";

import {
  fallbackCollectionTokenIds,
  fetchCollectionTokenIds,
  fetchCollectionSupply,
  fetchCollectionTokenUri,
  type Erc721IndexClient,
} from "@/lib/marketplace/collection-index-live";
import { requireCollection } from "@/config/collections";

function mockClient({
  totalSupply = 3n,
  tokenIds = [0n, 2n, 5n],
  tokenUri = "https://example.test/metadata/2",
}: {
  totalSupply?: bigint;
  tokenIds?: bigint[];
  tokenUri?: string;
} = {}): Erc721IndexClient {
  return {
    readContract: vi.fn(async (call) => {
      if (call.functionName === "totalSupply") {
        return totalSupply;
      }
      if (call.functionName === "tokenURI") {
        return tokenUri;
      }

      throw new Error(`Unexpected read ${call.functionName}`);
    }),
    multicall: vi.fn(
      async (call: Parameters<Erc721IndexClient["multicall"]>[0]) =>
        call.contracts.map((contract) => {
          const index = Number(contract.args?.[0]);
          const result = tokenIds[index];

          return result === undefined
            ? ({ status: "failure", error: new Error("missing") } as const)
            : ({ status: "success", result } as const);
        }),
    ),
  };
}

describe("collection index live adapter", () => {
  it("enumerates minted token IDs from ERC721Enumerable", async () => {
    const client = mockClient({
      totalSupply: 3n,
      tokenIds: [5n, 0n, 2n],
    });

    await expect(
      fetchCollectionTokenIds({
        collectionId: "cosmic-signature",
        client,
      }),
    ).resolves.toEqual([0, 2, 5]);
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "totalSupply" }),
    );
    expect(client.multicall).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: [
          expect.objectContaining({ functionName: "tokenByIndex", args: [0n] }),
          expect.objectContaining({ functionName: "tokenByIndex", args: [1n] }),
          expect.objectContaining({ functionName: "tokenByIndex", args: [2n] }),
        ],
      }),
    );
  });

  it("falls back to configured token IDs when the live index is unavailable", async () => {
    const client = mockClient({ tokenIds: [] });

    await expect(
      fetchCollectionTokenIds({
        collectionId: "cosmic-signature",
        client,
      }),
    ).resolves.toEqual(
      fallbackCollectionTokenIds(requireCollection("cosmic-signature")),
    );
  });

  it("reads live collection supply from the NFT contract", async () => {
    const client = mockClient({ totalSupply: 24n });

    await expect(
      fetchCollectionSupply({
        collectionId: "cosmic-signature",
        client,
      }),
    ).resolves.toBe(24);
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "totalSupply" }),
    );
  });

  it("does not guess supply when the NFT contract read fails", async () => {
    const client = {
      readContract: vi.fn(async () => {
        throw new Error("RPC unavailable");
      }),
    };

    await expect(
      fetchCollectionSupply({
        collectionId: "random-walk",
        client,
      }),
    ).resolves.toBeUndefined();
  });

  it("reads collection token URIs from the NFT contract", async () => {
    const client = mockClient({ tokenUri: "https://metadata.example/7" });

    await expect(
      fetchCollectionTokenUri({
        collectionId: "random-walk",
        tokenId: 7,
        client,
      }),
    ).resolves.toBe("https://metadata.example/7");
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "tokenURI",
        args: [7n],
      }),
    );
  });
});
