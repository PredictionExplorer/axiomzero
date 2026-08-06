/**
 * Hourly round-robin over redundant backend servers with failover.
 * (Same algorithm as the CosmicGame and Random Walk frontends.)
 *
 * Each upstream URL may be configured as a comma-separated list (the plural
 * `*_URLS` env vars below). Selection is sticky per clock hour: every client
 * uses `floor(now / 1h) % N`, so traffic alternates between servers each hour
 * without any coordination. When a request to the selected server fails at
 * the transport level (or with a 5xx), the caller marks it down via
 * {@link markServerDown}; the rotation then skips it for
 * {@link FAILURE_COOLDOWN_MS} and serves from the next server in the list.
 * When every server is marked down the hourly pick is returned anyway so the
 * request fails through the normal error path, rather than dying inside this
 * module.
 *
 * The singular env vars (and the hardcoded defaults) remain supported as
 * one-element lists, so deployments that don't need redundancy configure
 * nothing new.
 */

/** How long a rotation slot lasts: servers alternate once per hour. */
export const ROTATION_PERIOD_MS = 60 * 60 * 1000;

/** How long a failed server is skipped before it gets probed again. */
export const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

const trimmedList = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(",")
    .map((url) => url.trim().replace(/\/+$/, ""))
    .filter(Boolean);

/**
 * Parses the first candidate that yields a non-empty URL list. Candidates go
 * from most specific (plural lists) to least (singular vars, defaults).
 * Exported for tests.
 */
export const parseUrlList = (
  ...candidates: Array<string | undefined>
): string[] => {
  for (const candidate of candidates) {
    const list = trimmedList(candidate);
    if (list.length > 0) {
      return list;
    }
  }
  return [];
};

const listCache = new Map<string, string[]>();

/**
 * Env lists are resolved lazily and cached per group; static
 * `process.env.NEXT_PUBLIC_*` reads below are required for client bundle
 * inlining.
 */
function cachedList(key: string, resolve: () => string[]): string[] {
  const cached = listCache.get(key);
  if (cached && cached.length > 0) {
    return cached;
  }
  const resolved = resolve();
  listCache.set(key, resolved);
  return resolved;
}

/** Arbitrum JSON-RPC endpoints, in rotation order (no trailing slash). */
export function getArbitrumRpcUrls(): string[] {
  return cachedList("rpc", () =>
    parseUrlList(
      process.env.ARBITRUM_RPC_URLS,
      process.env.NEXT_PUBLIC_ARBITRUM_RPC_URLS,
      process.env.ARBITRUM_RPC_URL,
      process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL,
      "https://arb1.arbitrum.io/rpc",
    ),
  );
}

/** Random Walk Go API origins, in rotation order (no trailing slash). */
export function getRandomWalkApiUrls(): string[] {
  return cachedList("random-walk", () =>
    parseUrlList(
      process.env.RANDOM_WALK_API_URLS,
      process.env.NEXT_PUBLIC_RANDOM_WALK_API_URLS,
      process.env.RANDOM_WALK_API_URL,
      process.env.NEXT_PUBLIC_RANDOM_WALK_API_URL,
      "https://api.randomwalknft.com:1443",
    ),
  );
}

/** Cosmic Signature Go API origins, in rotation order (no trailing slash). */
export function getCosmicSignatureApiUrls(): string[] {
  return cachedList("cosmic-signature", () =>
    parseUrlList(
      process.env.COSMIC_SIGNATURE_API_URLS,
      process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_API_URLS,
      process.env.COSMIC_SIGNATURE_API_URL,
      process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_API_URL,
      // Both servers serve the Go API and the NFT media; the legacy
      // nfts.cosmicsignature.com host stays reserved for on-chain tokenURI.
      "https://a1.cosmicsignature.com,https://a2.cosmicsignature.com",
    ),
  );
}

/** url -> epoch ms until which the server is considered down. */
const downUntil = new Map<string, number>();

/** label -> last selection logged, so the console only shows changes. */
const lastLoggedSelection = new Map<string, string>();

const logSelection = (label: string, url: string): void => {
  if (lastLoggedSelection.get(label) === url) {
    return;
  }
  lastLoggedSelection.set(label, url);
  console.log(`[serverRotation] using ${label} = ${url}`);
};

const hourlySlot = (count: number, now: number): number =>
  count > 0 ? Math.floor(now / ROTATION_PERIOD_MS) % count : 0;

/**
 * Picks the server for this hour, skipping servers inside their failure
 * cooldown. Falls back to the hourly pick (and logs) when all are down.
 * When `label` is given (e.g. "RandomWalk API"), every change of the
 * selected server is announced once on the console.
 */
export function pickServer(
  urls: readonly string[],
  now: number = Date.now(),
  label?: string,
): string {
  const picked = pickServerInternal(urls, now);
  if (label && picked) {
    logSelection(label, picked);
  }
  return picked;
}

function pickServerInternal(urls: readonly string[], now: number): string {
  if (urls.length === 0) {
    return "";
  }
  const start = hourlySlot(urls.length, now);
  for (let i = 0; i < urls.length; i++) {
    const candidate = urls[(start + i) % urls.length] ?? "";
    if (candidate && (downUntil.get(candidate) ?? 0) <= now) {
      return candidate;
    }
  }
  console.error(
    "[serverRotation] all servers are marked down, using hourly pick anyway:",
    urls.join(", "),
  );
  return urls[start] ?? "";
}

/** Marks a server as failed so the rotation skips it for the cooldown window. */
export function markServerDown(url: string, now: number = Date.now()): void {
  const base = url.replace(/\/+$/, "");
  if (!base) {
    return;
  }
  downUntil.set(base, now + FAILURE_COOLDOWN_MS);
  console.warn(
    `[serverRotation] marking server down for ${Math.round(FAILURE_COOLDOWN_MS / 1000)}s:`,
    base,
  );
}

/** The Random Walk API origin to use right now (hourly rotation + failover). */
export const getRandomWalkApiBase = (): string =>
  pickServer(getRandomWalkApiUrls(), Date.now(), "RandomWalk API");

/** The Cosmic Signature API origin to use right now (hourly rotation + failover). */
export const getCosmicSignatureApiBase = (): string =>
  pickServer(getCosmicSignatureApiUrls(), Date.now(), "CosmicSignature API");

/**
 * All Arbitrum RPC endpoints with the current hourly pick first — the order
 * for a viem `fallback()` transport, so requests prefer the rotation pick and
 * fail over to the remaining servers automatically.
 */
export function getArbitrumRpcUrlsInRotationOrder(
  now: number = Date.now(),
): string[] {
  const urls = getArbitrumRpcUrls();
  const start = hourlySlot(urls.length, now);
  return urls
    .map((_, i) => urls[(start + i) % urls.length] ?? "")
    .filter(Boolean);
}

/**
 * Given a URL built against one server base, rebuilds it against the current
 * pick. Returns null when the URL doesn't match any configured base or no
 * alternative is available.
 */
export function rebaseUrl(
  url: string,
  urls: readonly string[],
  now: number = Date.now(),
): string | null {
  const matched = urls.find(
    (base) => url === base || url.startsWith(`${base}/`),
  );
  if (!matched) {
    return null;
  }
  const replacement = pickServer(urls, now);
  if (!replacement || replacement === matched) {
    return null;
  }
  return `${replacement}${url.slice(matched.length)}`;
}

/**
 * Marks the base of the failed `url` as down and returns the same request
 * rebuilt against the next healthy server, or null when there is no
 * alternative. One-stop helper for retry-once failover in fetch wrappers.
 */
export function failoverUrl(
  url: string,
  urls: readonly string[],
  now: number = Date.now(),
): string | null {
  const matched = urls.find(
    (base) => url === base || url.startsWith(`${base}/`),
  );
  if (!matched) {
    return null;
  }
  markServerDown(matched, now);
  return rebaseUrl(url, urls, now);
}

/** Clears failure state and cached env lists (test helper). */
export function __resetServerRotation(): void {
  downUntil.clear();
  lastLoggedSelection.clear();
  listCache.clear();
}
