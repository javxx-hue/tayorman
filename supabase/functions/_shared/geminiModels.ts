// Which Gemini models to try, and when to move on to the next one. Pure (no Deno or npm imports) so it can be unit tested.
//
// Newest models are sometimes slow or overloaded for hours (a request can run past a minute or answer 503),
// while the lite model answers in a few seconds. A student or admin should not wait on that.

export const DEFAULT_MODEL = 'gemini-3.6-flash';
export const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

// Seconds one attempt may take before the next model is tried
export const ATTEMPT_TIMEOUT_MS = 40_000;

export function modelChain(configured: string | undefined): string[] {
  const primary = configured?.trim() || DEFAULT_MODEL;
  return primary === FALLBACK_MODEL ? [primary] : [primary, FALLBACK_MODEL];
}

// Overloaded, rate limited, a server error or no answer in time: try another model.
// Anything else (bad request, bad key) would fail the same way on every model, so stop.
export function shouldTryNext(status: number | 'timeout'): boolean {
  return status === 'timeout' || status === 429 || status >= 500;
}
