import { createPublicClient, http } from "viem";
import { arbitrum } from "viem/chains";

import { requireCollection } from "@/config/collections";
import { getCollectionTokenIds } from "@/lib/marketplace/collection-index-live";
import type { CollectionId } from "@/lib/marketplace/types";
import { anchoringWalletAbi } from "@/lib/web3/abis";

/**
 * Anchoring is cosmicsignature.com's one-time staking mechanic. Both Random
 * Walk and Cosmic Signature tokens can be anchored exactly once, ever; the
 * anchoring wallet's usedNfts mapping is 1 forever once the anchor is used.
 * Never-anchored tokens keep that option open, which collectors value.
 */

type AnchoringReadCall = {
  address: `0x${string}`;
  abi: typeof anchoringWalletAbi;
  functionName: string;
  args?: readonly unknown[];
};

export type AnchoringClient = {
  multicall: (call: {
    allowFailure: true;
    contracts: readonly AnchoringReadCall[];
  }) => Promise<
    Array<
      | { status: "success"; result: unknown }
      | { status: "failure"; error: unknown }
    >
  >;
};

export type TokenRef = {
  collectionId: CollectionId;
  tokenId: number;
};

function createAnchoringPublicClient(): AnchoringClient {
  return createPublicClient({
    chain: arbitrum,
    transport: http(
      process.env.ARBITRUM_RPC_URL ??
        process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ??
        "https://arb1.arbitrum.io/rpc",
      // Keep server renders bounded when the public RPC is slow or
      // rate-limited; anchor statuses degrade to "unknown" instead of failing.
      { timeout: 5_000, retryCount: 1 },
    ),
  }) as unknown as AnchoringClient;
}

function usedNftsCall(
  anchoringWalletAddress: `0x${string}`,
  tokenId: number,
): AnchoringReadCall {
  return {
    address: anchoringWalletAddress,
    abi: anchoringWalletAbi,
    functionName: "usedNfts",
    args: [BigInt(tokenId)],
  };
}

function usedNftsResult(
  result:
    | { status: "success"; result: unknown }
    | { status: "failure"; error: unknown },
) {
  return result.status === "success" && typeof result.result === "bigint"
    ? result.result > 0n
    : undefined;
}

/**
 * Scans the anchoring wallet's usedNfts flag for every minted token in the
 * collection and returns the set of token ids whose anchor has been used.
 */
export async function fetchAnchoredTokenIds({
  collectionId,
  client = createAnchoringPublicClient(),
}: {
  collectionId: CollectionId;
  client?: AnchoringClient;
}) {
  const collection = requireCollection(collectionId);
  const tokenIds = await getCollectionTokenIds(collectionId);

  if (!tokenIds.length) {
    return new Set<number>();
  }

  const results = await client.multicall({
    allowFailure: true,
    contracts: tokenIds.map((tokenId) =>
      usedNftsCall(collection.anchoringWalletAddress, tokenId),
    ),
  });
  const anchored = new Set<number>();
  let succeeded = 0;

  results.forEach((result, index) => {
    const used = usedNftsResult(result);

    if (used !== undefined) {
      succeeded += 1;
    }

    if (used) {
      anchored.add(tokenIds[index]);
    }
  });

  if (!succeeded) {
    throw new Error(
      `${collection.shortName} anchoring statuses are unavailable.`,
    );
  }

  return anchored;
}

/**
 * Reads the usedNfts flag for a specific list of tokens (grouped into one
 * multicall per collection). Failed reads are omitted from the result map.
 */
export async function fetchAnchorStatusForTokens({
  refs,
  client = createAnchoringPublicClient(),
}: {
  refs: readonly TokenRef[];
  client?: AnchoringClient;
}) {
  const statuses = new Map<string, boolean>();

  if (!refs.length) {
    return statuses;
  }

  const results = await client.multicall({
    allowFailure: true,
    contracts: refs.map(({ collectionId, tokenId }) =>
      usedNftsCall(
        requireCollection(collectionId).anchoringWalletAddress,
        tokenId,
      ),
    ),
  });

  results.forEach((result, index) => {
    const used = usedNftsResult(result);

    if (used !== undefined) {
      const { collectionId, tokenId } = refs[index];
      statuses.set(anchorStatusKey(collectionId, tokenId), used);
    }
  });

  return statuses;
}

export function anchorStatusKey(collectionId: CollectionId, tokenId: number) {
  return `${collectionId}:${tokenId}`;
}

const ANCHOR_SCAN_CACHE_TTL_MS = 5 * 60_000;
const ANCHOR_SCAN_TIME_BUDGET_MS = 6_000;
const ANCHOR_STATUS_CACHE_TTL_MS = 5 * 60_000;

const anchorScanCache = new Map<
  CollectionId,
  { scan: Promise<Set<number>>; fetchedAt: number }
>();
const lastGoodAnchorScan = new Map<CollectionId, Set<number>>();
const anchorStatusCache = new Map<
  string,
  { status: Promise<boolean | undefined>; fetchedAt: number }
>();

export function resetAnchoringCachesForTests() {
  anchorScanCache.clear();
  lastGoodAnchorScan.clear();
  anchorStatusCache.clear();
}

/**
 * Collection-wide anchor scans are large multicalls against a public RPC, so
 * results are shared for a TTL and stale data is served when a refresh fails
 * or exceeds its time budget. Returns undefined when no data is available yet
 * so callers can degrade gracefully (skip badges, no-op filters).
 */
export function getAnchoredTokenIdSet(
  collectionId: CollectionId,
  client?: AnchoringClient,
): Promise<Set<number> | undefined> {
  if (process.env.NODE_ENV === "test") {
    return fetchAnchoredTokenIds({ collectionId, client }).catch(
      () => undefined,
    );
  }

  const cached = anchorScanCache.get(collectionId);
  let scan: Promise<Set<number>>;

  if (cached && Date.now() - cached.fetchedAt < ANCHOR_SCAN_CACHE_TTL_MS) {
    scan = cached.scan;
  } else {
    scan = fetchAnchoredTokenIds({ collectionId, client }).then((anchored) => {
      lastGoodAnchorScan.set(collectionId, anchored);
      return anchored;
    });
    scan.catch(() => anchorScanCache.delete(collectionId));
    anchorScanCache.set(collectionId, { scan, fetchedAt: Date.now() });
  }

  const stale = lastGoodAnchorScan.get(collectionId);

  return Promise.race([
    scan.catch(() => stale),
    new Promise<Set<number> | undefined>((resolve) => {
      const timer = setTimeout(() => resolve(stale), ANCHOR_SCAN_TIME_BUDGET_MS);
      timer.unref?.();
    }),
  ]);
}

/**
 * Batched anchor-status lookup for a page of tokens. Prefers an already
 * resolved collection scan, then a short-lived per-token cache, and finally
 * one multicall for whatever is left. Missing entries mean "unknown".
 */
export async function getAnchorStatusForTokens(
  refs: readonly TokenRef[],
  client?: AnchoringClient,
): Promise<Map<string, boolean>> {
  const statuses = new Map<string, boolean>();
  const useTtlCache = process.env.NODE_ENV !== "test";
  const pending: Array<{ ref: TokenRef; status: Promise<boolean | undefined> }> =
    [];
  const uncached: TokenRef[] = [];

  for (const ref of refs) {
    const scanned = lastGoodAnchorScan.get(ref.collectionId);

    if (scanned) {
      statuses.set(
        anchorStatusKey(ref.collectionId, ref.tokenId),
        scanned.has(ref.tokenId),
      );
      continue;
    }

    const key = anchorStatusKey(ref.collectionId, ref.tokenId);
    const cached = anchorStatusCache.get(key);

    if (
      useTtlCache &&
      cached &&
      Date.now() - cached.fetchedAt < ANCHOR_STATUS_CACHE_TTL_MS
    ) {
      pending.push({ ref, status: cached.status });
      continue;
    }

    uncached.push(ref);
  }

  if (uncached.length) {
    const batch = fetchAnchorStatusForTokens({ refs: uncached, client }).catch(
      () => new Map<string, boolean>(),
    );

    for (const ref of uncached) {
      const key = anchorStatusKey(ref.collectionId, ref.tokenId);
      const status = batch.then((resolved) => resolved.get(key));

      if (useTtlCache) {
        anchorStatusCache.set(key, { status, fetchedAt: Date.now() });
      }

      pending.push({ ref, status });
    }
  }

  await Promise.all(
    pending.map(async ({ ref, status }) => {
      const resolved = await status;

      if (resolved !== undefined) {
        statuses.set(anchorStatusKey(ref.collectionId, ref.tokenId), resolved);
      }
    }),
  );

  return statuses;
}

/**
 * Anchor status for a single token, e.g. the token detail page. Returns
 * undefined when the status could not be read.
 */
export async function getTokenAnchorStatus(
  collectionId: CollectionId,
  tokenId: number,
  client?: AnchoringClient,
) {
  const statuses = await getAnchorStatusForTokens(
    [{ collectionId, tokenId }],
    client,
  );

  return statuses.get(anchorStatusKey(collectionId, tokenId));
}
