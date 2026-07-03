import { beforeEach, describe, expect, it, vi } from "vitest";

const indexMocks = vi.hoisted(() => ({
  getCollectionTokenIds: vi.fn(),
}));

vi.mock("@/lib/marketplace/collection-index-live", () => indexMocks);

import {
  anchorStatusKey,
  fetchAnchoredTokenIds,
  fetchAnchorStatusForTokens,
  getAnchoredTokenIdSet,
  getAnchorStatusForTokens,
  getTokenAnchorStatus,
  resetAnchoringCachesForTests,
  type AnchoringClient,
} from "@/lib/marketplace/anchoring-live";

const RANDOM_WALK_ANCHORING_WALLET =
  "0x5EB3396092841E6c5b0b51141699F6711E830529";
const COSMIC_SIGNATURE_ANCHORING_WALLET =
  "0x6308A405B4FF1eA890870Efe2a6D036750B81F7C";

type MulticallCall = {
  address: `0x${string}`;
  functionName: string;
  args?: readonly unknown[];
};

function clientReturning(
  resolve: (call: MulticallCall, index: number) => bigint | Error,
) {
  const multicall = vi.fn(
    async ({ contracts }: { contracts: readonly MulticallCall[] }) =>
      contracts.map((contract, index) => {
        const result = resolve(contract, index);

        return result instanceof Error
          ? { status: "failure" as const, error: result }
          : { status: "success" as const, result };
      }),
  );

  return { client: { multicall } as unknown as AnchoringClient, multicall };
}

describe("anchoring live reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnchoringCachesForTests();
    indexMocks.getCollectionTokenIds.mockResolvedValue([0, 1, 2, 3]);
  });

  it("scans usedNfts over the minted token index and collects anchored ids", async () => {
    const { client, multicall } = clientReturning((call) =>
      call.args?.[0] === 1n || call.args?.[0] === 3n ? 1n : 0n,
    );

    const anchored = await fetchAnchoredTokenIds({
      collectionId: "random-walk",
      client,
    });

    expect([...anchored].sort()).toEqual([1, 3]);
    expect(multicall).toHaveBeenCalledTimes(1);
    const { contracts } = multicall.mock.calls[0][0] as {
      contracts: MulticallCall[];
    };
    expect(contracts).toHaveLength(4);
    expect(contracts[0]).toMatchObject({
      address: RANDOM_WALK_ANCHORING_WALLET,
      functionName: "usedNfts",
      args: [0n],
    });
  });

  it("throws when every anchor read fails so callers can fall back", async () => {
    const { client } = clientReturning(() => new Error("rpc down"));

    await expect(
      fetchAnchoredTokenIds({ collectionId: "random-walk", client }),
    ).rejects.toThrow(/anchoring statuses are unavailable/i);
  });

  it("returns an empty set for collections with no minted tokens", async () => {
    indexMocks.getCollectionTokenIds.mockResolvedValue([]);
    const { client, multicall } = clientReturning(() => 0n);

    const anchored = await fetchAnchoredTokenIds({
      collectionId: "cosmic-signature",
      client,
    });

    expect(anchored.size).toBe(0);
    expect(multicall).not.toHaveBeenCalled();
  });

  it("resolves anchor status per token and omits failed reads", async () => {
    const { client, multicall } = clientReturning((call) => {
      if (call.args?.[0] === 5n) {
        return 1n;
      }
      if (call.args?.[0] === 7n) {
        return new Error("read failed");
      }
      return 0n;
    });

    const statuses = await fetchAnchorStatusForTokens({
      refs: [
        { collectionId: "random-walk", tokenId: 5 },
        { collectionId: "random-walk", tokenId: 7 },
        { collectionId: "cosmic-signature", tokenId: 9 },
      ],
      client,
    });

    expect(statuses.get(anchorStatusKey("random-walk", 5))).toBe(true);
    expect(statuses.has(anchorStatusKey("random-walk", 7))).toBe(false);
    expect(statuses.get(anchorStatusKey("cosmic-signature", 9))).toBe(false);
    const { contracts } = multicall.mock.calls[0][0] as {
      contracts: MulticallCall[];
    };
    expect(contracts[2]).toMatchObject({
      address: COSMIC_SIGNATURE_ANCHORING_WALLET,
      functionName: "usedNfts",
      args: [9n],
    });
  });

  it("exposes batched and single-token cached entry points", async () => {
    const { client } = clientReturning((call) =>
      call.args?.[0] === 2n ? 1n : 0n,
    );

    const statuses = await getAnchorStatusForTokens(
      [
        { collectionId: "random-walk", tokenId: 2 },
        { collectionId: "random-walk", tokenId: 3 },
      ],
      client,
    );

    expect(statuses.get(anchorStatusKey("random-walk", 2))).toBe(true);
    expect(statuses.get(anchorStatusKey("random-walk", 3))).toBe(false);

    await expect(
      getTokenAnchorStatus("random-walk", 2, client),
    ).resolves.toBe(true);
  });

  it("degrades the collection-wide set to undefined when the scan fails", async () => {
    const { client } = clientReturning(() => new Error("rpc down"));

    await expect(
      getAnchoredTokenIdSet("random-walk", client),
    ).resolves.toBeUndefined();

    const { client: healthyClient } = clientReturning((call) =>
      call.args?.[0] === 0n ? 1n : 0n,
    );

    await expect(
      getAnchoredTokenIdSet("random-walk", healthyClient),
    ).resolves.toEqual(new Set([0]));
  });
});
