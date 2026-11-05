import { describe, it, expect } from 'vitest';
import { ATTEMPT_TIMEOUT_MS, DEFAULT_MODEL, FAST_MODEL, Fatal, HEDGE_DELAY_MS, modelChain, raceStaggered, shouldTryNext, worstCaseMs } from '../functions/_shared/geminiModels';

describe('modelChain', () => {
  it('smart work starts with the configured model, then the fast ones', () => {
    const chain = modelChain('gemini-3.8-flash');
    expect(chain[0]).toBe('gemini-3.8-flash');
    expect(chain[1]).toBe(FAST_MODEL);
    expect(chain.length).toBeGreaterThanOrEqual(3);
  });

  it('fast work (grading, reading speech and handwriting) starts with the lite model', () => {
    const chain = modelChain('gemini-3.8-flash', 'fast');
    expect(chain[0]).toBe(FAST_MODEL);
    expect(chain[1]).toBe('gemini-3.8-flash');
  });

  it('falls back to the default when nothing is configured', () => {
    for (const none of [undefined, '', '   ']) expect(modelChain(none)[0]).toBe(DEFAULT_MODEL);
  });

  it('never lists a model twice', () => {
    for (const configured of [FAST_MODEL, DEFAULT_MODEL, undefined]) {
      for (const tier of ['smart', 'fast'] as const) {
        const chain = modelChain(configured, tier);
        expect(new Set(chain).size).toBe(chain.length);
      }
    }
  });

  it('the slowest possible answer still fits well inside the function time limit', () => {
    expect(worstCaseMs(modelChain('x').length)).toBeLessThanOrEqual(60_000);
    expect(HEDGE_DELAY_MS).toBeLessThan(ATTEMPT_TIMEOUT_MS);
  });
});

describe('shouldTryNext', () => {
  it('moves on when a model is slow, busy, gone or failing', () => {
    for (const s of ['timeout', 404, 429, 500, 502, 503, 504] as const) expect(shouldTryNext(s)).toBe(true);
  });
  it('stops on errors every model would repeat', () => {
    for (const s of [400, 401, 403]) expect(shouldTryNext(s)).toBe(false);
  });
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
// a task that answers after `ms`, or fails after `ms`
const answers = (value: string, ms: number) => async () => (await wait(ms), value);
const fails = (message: string, ms: number) => async () => {
  await wait(ms);
  throw new Error(message);
};

describe('raceStaggered', () => {
  it('a fast first model wins and the others are never started', async () => {
    let secondStarted = false;
    const result = await raceStaggered([answers('first', 5), async () => ((secondStarted = true), 'second')], 50);
    expect(result).toBe('first');
    await wait(80);
    expect(secondStarted).toBe(false);
  });

  it('a slow first model does not hold things up: the next one starts after the delay and wins', async () => {
    const t = Date.now();
    const result = await raceStaggered([answers('slow', 400), answers('quick', 10)], 40);
    expect(result).toBe('quick');
    expect(Date.now() - t).toBeLessThan(300);
  });

  it('when the first fails, the next starts at once instead of waiting out the delay', async () => {
    const t = Date.now();
    const result = await raceStaggered([fails('busy', 5), answers('ok', 5)], 5_000);
    expect(result).toBe('ok');
    expect(Date.now() - t).toBeLessThan(500);
  });

  it('cancels the ones still running when somebody has won', async () => {
    let cancelled = false;
    const slow = (signal: AbortSignal) => new Promise<string>((_, reject) => signal.addEventListener('abort', () => ((cancelled = true), reject(new Error('aborted')))));
    expect(await raceStaggered([slow, answers('fast', 30)], 5)).toBe('fast');
    expect(cancelled).toBe(true);
  });

  it('throws the last error when every model fails', async () => {
    await expect(raceStaggered([fails('a', 1), fails('b', 1)], 10)).rejects.toThrow('b');
  });

  it('a fatal error stops everything at once', async () => {
    const fatal = async () => {
      throw new Fatal('bad key');
    };
    await expect(raceStaggered([fatal, answers('never', 20)], 5)).rejects.toThrow('bad key');
  });
});
