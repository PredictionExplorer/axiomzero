import {
  failoverUrl,
  getCosmicSignatureApiUrls,
  getRandomWalkApiUrls,
  pickServer,
} from "@/lib/server-rotation";

const OWNED_TOKEN_API_PAGE_SIZE = 1_000;

/**
 * Owned-token lookup against a Go API from the hourly server rotation
 * (`server-rotation.ts`): on a network error or 5xx the picked server is
 * marked down and the request is retried once on the next server.
 */
async function readOwnedTokenIdsFromGoApi(
  label: string,
  urls: readonly string[],
  pathFor: (base: string) => string,
) {
  const base = pickServer(urls, Date.now(), `${label} API`);
  const url = pathFor(base);
  const init = { headers: { Accept: "application/json" } };
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    const retryUrl = failoverUrl(url, urls);
    if (!retryUrl) {
      throw error;
    }
    response = await fetch(retryUrl, init);
  }

  if (response.status >= 500) {
    const retryUrl = failoverUrl(url, urls);
    if (retryUrl) {
      response = await fetch(retryUrl, init);
    }
  }

  if (!response.ok) {
    throw new Error(`${label} owned-token lookup returned ${response.status}.`);
  }

  const payload = (await response.json()) as {
    status?: number;
    UserTokens?: Array<{ TokenId?: unknown }> | null;
  };

  if (payload.status !== 1) {
    throw new Error(`${label} owned-token lookup failed.`);
  }

  const tokenIds = (payload.UserTokens ?? [])
    .map((token) => token.TokenId)
    .filter(
      (tokenId): tokenId is number =>
        typeof tokenId === "number" && Number.isSafeInteger(tokenId),
    );

  return [...new Set(tokenIds)].sort((left, right) => left - right);
}

/**
 * Owned Cosmic Signature tokens straight from the collection's Go API (CORS
 * is open), which spares the wallet RPC a balanceOf + enumeration multicall.
 */
export async function readCosmicSignatureOwnedTokenIds(owner: `0x${string}`) {
  return readOwnedTokenIdsFromGoApi(
    "Cosmic Signature",
    getCosmicSignatureApiUrls(),
    (base) =>
      `${base}/api/cosmicgame/cst/list/by_user/${owner}/0/${OWNED_TOKEN_API_PAGE_SIZE}`,
  );
}

/**
 * Owned Random Walk tokens from the collection's Go API. The `tokens/by_user`
 * JSON handler accepts a raw 0x address, so this spares the wallet RPC a
 * balanceOf + enumeration multicall.
 */
export async function readRandomWalkOwnedTokenIds(owner: `0x${string}`) {
  return readOwnedTokenIdsFromGoApi(
    "Random Walk",
    getRandomWalkApiUrls(),
    (base) => `${base}/api/randomwalk/tokens/by_user/${owner}`,
  );
}
