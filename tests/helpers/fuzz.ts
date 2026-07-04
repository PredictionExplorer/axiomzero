import type fc from "fast-check";

/**
 * Run-length control for the fast-check suites.
 *
 * - Default: each property runs its base number of cases (fast, CI-friendly).
 * - FUZZ_TIME_SECONDS=<n>: each property fuzzes for ~n seconds of wall time
 *   instead of a fixed count (soak mode), e.g.
 *   `FUZZ_TIME_SECONDS=90 pnpm test:fuzz`.
 * - FUZZ_FACTOR=<n>: multiplies every base run count, preserving the relative
 *   weights between cheap and expensive properties.
 */
export function fuzzParams<T>(baseRuns: number): fc.Parameters<T> {
  const timeSeconds = Number(process.env.FUZZ_TIME_SECONDS);

  if (Number.isFinite(timeSeconds) && timeSeconds > 0) {
    return {
      numRuns: Number.MAX_SAFE_INTEGER,
      interruptAfterTimeLimit: timeSeconds * 1_000,
      // Running out of time budget is success; only counterexamples fail.
      markInterruptAsFailure: false,
    };
  }

  const factor = Number(process.env.FUZZ_FACTOR);

  if (Number.isFinite(factor) && factor > 0) {
    return { numRuns: Math.max(1, Math.ceil(baseRuns * factor)) };
  }

  return { numRuns: baseRuns };
}
