import { z } from "zod";

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

export async function fetchGoApiJson<Schema extends z.ZodType>(
  url: string,
  schema: Schema,
  {
    revalidate = DEFAULT_REVALIDATE_SECONDS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    noStore = false,
  }: FetchGoApiJsonOptions = {},
): Promise<z.infer<Schema>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      ...(noStore ? { cache: "no-store" } : { next: { revalidate } }),
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
