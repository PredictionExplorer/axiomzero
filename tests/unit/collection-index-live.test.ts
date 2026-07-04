import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fallbackCollectionTokenIds,
  fetchCollectionTokenIds,
  fetchCollectionSupply,
  fetchCollectionTokenOwner,
  fetchCollectionTokenUri,
  getCollectionSupply,
  getCollectionTokenIds,
  type Erc721IndexClient,
} from "@/lib/marketplace/collection-index-live";
import { requireCollection } from "@/config/collections";
import { jsonResponse, routedFetchMock } from "../helpers/go-api-fixtures";

function mockClient({
  totalSupply = 3n,
  tokenIds = [0n, 2n, 5n],
  tokenUri = "https://example.test/metadata/2",
  owner = "0xcc9C0DDF13EB1853185A51296FcEBec103b466e1",
}: {
  totalSupply?: bigint;
  tokenIds?: bigint[];
  tokenUri?: string;
  owner?: string;
} = {}): Erc721IndexClient {
  return {
    readContract: vi.fn(async (call) => {
      if (call.functionName === "totalSupply") {
        return totalSupply;
      }
      if (call.functionName === "tokenURI") {
        return tokenUri;
      }
      if (call.functionName === "ownerOf") {
        return owner;
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

function failingFetch() {
  return vi.fn(async () => new Response("", { status: 503 }));
}

describe("collection index live adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enumerates minted token IDs from ERC721Enumerable", async () => {
    const client = mockClient({
      totalSupply: 3n,
      tokenIds: [5n, 0n, 2n],
    });

    await expect(
      fetchCollectionTokenIds({
        collectionId: "random-walk",
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

  it("prefers the Cosmic Signature API token list over on-chain enumeration", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/cosmicgame\/cst\/list\/all\//,
          () =>
            jsonResponse({
              CosmicSignatureTokenList: [{ TokenId: 23 }, { TokenId: 0 }],
              error: "",
              status: 1,
            }),
        ],
      ]),
    );
    const client = mockClient();

    await expect(
      fetchCollectionTokenIds({
        collectionId: "cosmic-signature",
        client,
      }),
    ).resolves.toEqual([0, 23]);
    expect(client.readContract).not.toHaveBeenCalled();
    expect(client.multicall).not.toHaveBeenCalled();
  });

  it("falls back to on-chain enumeration when the Cosmic Signature API fails", async () => {
    vi.stubGlobal("fetch", failingFetch());
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
  });

  it("falls back to configured token IDs when the live index is unavailable", async () => {
    vi.stubGlobal("fetch", failingFetch());
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

  it("derives Cosmic Signature supply from the API token list", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/cosmicgame\/cst\/list\/all\//,
          () =>
            jsonResponse({
              CosmicSignatureTokenList: Array.from({ length: 24 }, (_, i) => ({
                TokenId: i,
              })),
              error: "",
              status: 1,
            }),
        ],
      ]),
    );
    const client = mockClient();

    await expect(
      fetchCollectionSupply({
        collectionId: "cosmic-signature",
        client,
      }),
    ).resolves.toBe(24);
    expect(client.readContract).not.toHaveBeenCalled();
  });

  it("reads live collection supply from the NFT contract when the API fails", async () => {
    vi.stubGlobal("fetch", failingFetch());
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

  it("falls through to the chain when the Cosmic Signature API list is empty", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMock([
        [
          /\/api\/cosmicgame\/cst\/list\/all\//,
          () =>
            jsonResponse({
              CosmicSignatureTokenList: [],
              error: "",
              status: 1,
            }),
        ],
      ]),
    );
    const client = mockClient({ totalSupply: 2n, tokenIds: [0n, 1n] });

    await expect(
      fetchCollectionTokenIds({
        collectionId: "cosmic-signature",
        client,
      }),
    ).resolves.toEqual([0, 1]);
    await expect(
      fetchCollectionSupply({
        collectionId: "cosmic-signature",
        client,
      }),
    ).resolves.toBe(2);
  });

  it("falls back to configured token IDs when totalSupply is implausible", async () => {
    const client = mockClient({ totalSupply: 2n ** 60n });

    await expect(
      fetchCollectionTokenIds({
        collectionId: "random-walk",
        client,
      }),
    ).resolves.toEqual(
      fallbackCollectionTokenIds(requireCollection("random-walk")),
    );
    expect(client.multicall).not.toHaveBeenCalled();
  });

  it("returns an empty index for collections with zero supply", async () => {
    const client = mockClient({ totalSupply: 0n });

    await expect(
      fetchCollectionTokenIds({
        collectionId: "random-walk",
        client,
      }),
    ).resolves.toEqual([]);
    expect(client.multicall).not.toHaveBeenCalled();
  });

  it("does not guess supply when totalSupply is implausible", async () => {
    const client = mockClient({ totalSupply: 2n ** 60n });

    await expect(
      fetchCollectionSupply({
        collectionId: "random-walk",
        client,
      }),
    ).resolves.toBeUndefined();
  });

  it("degrades the cached entry points gracefully when the RPC is offline", async () => {
    // The default viem client goes through fetch; failing it exercises the
    // real client construction without any network access.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await expect(getCollectionTokenIds("random-walk")).resolves.toEqual(
      fallbackCollectionTokenIds(requireCollection("random-walk")),
    );
    await expect(getCollectionSupply("random-walk")).resolves.toBeUndefined();
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

  it("reads a token's current owner from the NFT contract", async () => {
    const client = mockClient({
      owner: "0xcc9C0DDF13EB1853185A51296FcEBec103b466e1",
    });

    await expect(
      fetchCollectionTokenOwner({
        collectionId: "random-walk",
        tokenId: 5,
        client,
      }),
    ).resolves.toBe("0xcc9C0DDF13EB1853185A51296FcEBec103b466e1");
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "ownerOf", args: [5n] }),
    );
  });

  it("returns undefined for malformed on-chain owner values", async () => {
    const client = mockClient({ owner: "not-an-address" });

    await expect(
      fetchCollectionTokenOwner({
        collectionId: "random-walk",
        tokenId: 5,
        client,
      }),
    ).resolves.toBeUndefined();
  });
});
