import { z } from "zod";

import {
  failoverUrl,
  getCosmicSignatureApiUrls,
  getRandomWalkApiUrls,
} from "@/lib/server-rotation";

/**
 * Shared client for the PredictionExplorer Go "webserv" JSON APIs that back
 * randomwalknft.com and cosmicsignature.com. Every JSON response carries an
 * envelope of `{ status, error }` where status 1 means success; missing
 * records come back as HTTP 400 with status 0 and a human-readable error.
 */

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_REVALIDATE_SECONDS = 60;

const goApiEnvelopeSchema = z.object({
  status: z.number(),
  error: z.string().optional(),
});

export class GoApiError extends Error {
  readonly url: string;
  readonly httpStatus?: number;
  readonly apiError?: string;

  constructor(
    message: string,
    options: { url: string; httpStatus?: number; apiError?: string },
  ) {
    super(message);
    this.name = "GoApiError";
    this.url = options.url;
    this.httpStatus = options.httpStatus;
    this.apiError = options.apiError;
  }
}

function envelopeOf(payload: unknown) {
  const parsed = goApiEnvelopeSchema.safeParse(payload);

  return parsed.success ? parsed.data : undefined;
}

type FetchGoApiJsonOptions = {
  revalidate?: number;
  timeoutMs?: number;
  /**
   * Bypass Next's data cache with `cache: "no-store"`. Required for responses
   * that exceed Next's 2MB cache limit (e.g. the full minted-token list), which
   * would otherwise fail the cache write and re-download on every render.
   * Callers should provide their own in-memory cache when using this.
   */
  noStore?: boolean;
};

async function fetchGoApiJsonOnce<Schema extends z.ZodType>(
  url: string,
  schema: Schema,
  options: { revalidate: number; timeoutMs: number; noStore: boolean },
): Promise<z.infer<Schema>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  let response: Response;

  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      ...(options.noStore
        ? { cache: "no-store" }
        : { next: { revalidate: options.revalidate } }),
    });
  } finally {
    clearTimeout(timeout);
  }

  const payload: unknown = await response.json().catch(() => undefined);
  const envelope = envelopeOf(payload);

  if (!response.ok || (envelope && envelope.status !== 1)) {
    throw new GoApiError(
      `Go API request failed (${response.status})${
        envelope?.error ? `: ${envelope.error}` : "."
      }`,
      {
        url,
        httpStatus: response.status,
        apiError: envelope?.error || undefined,
      },
    );
  }

  return schema.parse(payload);
}

/** Server-side failures worth retrying on another server; 4xx and schema mismatches are not. */
function isRetryableGoApiFailure(error: unknown): boolean {
  if (error instanceof GoApiError) {
    return (error.httpStatus ?? 0) >= 500;
  }
  if (error instanceof z.ZodError) {
    return false;
  }
  // Transport-level failures: fetch TypeError, undici errors, timeout aborts.
  return true;
}

/**
 * Rotation-aware retry target for a failed request (see `server-rotation.ts`).
 * The URL is matched against the rotation group it was built from (Random
 * Walk or Cosmic Signature); the failed server is marked down and the request
 * is rebuilt against the next healthy server of the same group. Null when the
 * URL is outside both groups (e.g. the static metadata host) or no
 * alternative server is configured.
 */
export function goApiFailoverUrl(url: string): string | null {
  // The Cosmic Signature group is checked first for /api/cosmicgame/ URLs:
  // the same host could appear in both rotation lists (e.g. a shared staging
  // server), and base matching alone would then rebase onto the wrong
  // service's list.
  const groups = url.includes("/api/cosmicgame/")
    ? [getCosmicSignatureApiUrls(), getRandomWalkApiUrls()]
    : [getRandomWalkApiUrls(), getCosmicSignatureApiUrls()];
  for (const urls of groups) {
    if (urls.some((base) => url === base || url.startsWith(`${base}/`))) {
      return failoverUrl(url, urls);
    }
  }
  return null;
}

export async function fetchGoApiJson<Schema extends z.ZodType>(
  url: string,
  schema: Schema,
  {
    revalidate = DEFAULT_REVALIDATE_SECONDS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    noStore = false,
  }: FetchGoApiJsonOptions = {},
): Promise<z.infer<Schema>> {
  const options = { revalidate, timeoutMs, noStore };

  try {
    return await fetchGoApiJsonOnce(url, schema, options);
  } catch (error) {
    if (!isRetryableGoApiFailure(error)) {
      throw error;
    }
    const retryUrl = goApiFailoverUrl(url);
    if (!retryUrl) {
      throw error;
    }
    return fetchGoApiJsonOnce(retryUrl, schema, options);
  }
}
