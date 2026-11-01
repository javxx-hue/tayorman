import { describe, it, expect } from 'vitest';
import { ATTEMPT_TIMEOUT_MS, DEFAULT_MODEL, FALLBACK_MODEL, modelChain, shouldTryNext } from '../functions/_shared/geminiModels';

describe('modelChain', () => {
  it('uses the configured model first, the fast one as the backup', () => {
    expect(modelChain('gemini-3.8-flash')).toEqual(['gemini-3.8-flash', FALLBACK_MODEL]);
  });
  it('falls back to the default when nothing is configured', () => {
    for (const none of [undefined, '', '   ']) expect(modelChain(none)).toEqual([DEFAULT_MODEL, FALLBACK_MODEL]);
  });
  it('does not try the same model twice', () => {
    expect(modelChain(FALLBACK_MODEL)).toEqual([FALLBACK_MODEL]);
  });
  it('two attempts always fit well inside the function time limit', () => {
    expect(modelChain('x').length * ATTEMPT_TIMEOUT_MS).toBeLessThanOrEqual(90_000);
  });
});

describe('shouldTryNext', () => {
  it('moves on when the model is slow, overloaded or failing', () => {
    for (const s of ['timeout', 429, 500, 502, 503, 504] as const) expect(shouldTryNext(s)).toBe(true);
  });
  it('stops on errors every model would repeat', () => {
    for (const s of [400, 401, 403, 404]) expect(shouldTryNext(s)).toBe(false);
  });
});
