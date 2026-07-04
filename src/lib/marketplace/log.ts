/**
 * Marketplace data sources degrade gracefully (API -> metadata -> chain), but
 * degradations must stay visible in server logs; silent fallbacks previously
 * hid a deterministic parsing bug for months. Suppressed in unit tests to
 * keep expected-failure output readable.
 */
export function logMarketplaceDegradation(context: string, error: unknown) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`[marketplace] ${context}: ${reason}`);
}
