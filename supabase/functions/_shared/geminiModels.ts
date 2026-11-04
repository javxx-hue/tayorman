// Which Gemini models to try, and how. Pure (no Deno or npm imports) so it can be unit tested.
//
// Measured: the same request took 3 s on one model and 30+ s (or a 503 "busy") on another, and which one is
// slow changes from hour to hour. So nobody waits on a single model: the next one is started if the first has
// not answered after a few seconds, and whichever answers first wins.

export const DEFAULT_MODEL = 'gemini-3.6-flash';
export const FAST_MODEL = 'gemini-3.5-flash-lite';
const BACKUP_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

// One attempt may run this long; the next model starts after HEDGE_DELAY_MS if nothing has come back
export const ATTEMPT_TIMEOUT_MS = 30_000;
export const HEDGE_DELAY_MS = 6_000;

export type Tier = 'smart' | 'fast';

// "smart" (writing tests, answers) starts with the configured model; "fast" (grading, reading speech and
// handwriting) starts with the lite one. Each list ends with backups and never repeats a model.
export function modelChain(configured: string | undefined, tier: Tier = 'smart'): string[] {
  const main = configured?.trim() || DEFAULT_MODEL;
  const order = tier === 'fast' ? [FAST_MODEL, main, ...BACKUP_MODELS] : [main, FAST_MODEL, ...BACKUP_MODELS];
  return [...new Set(order)];
}

// The longest a request can take: the last model starts after all the delays, then gets its full time
export const worstCaseMs = (models: number) => (models - 1) * HEDGE_DELAY_MS + ATTEMPT_TIMEOUT_MS;

// Overloaded, rate limited, a server error, a model that is gone, or no answer in time: try another.
// A bad request or a bad key would fail the same way on every model, so those stop everything.
export function shouldTryNext(status: number | 'timeout'): boolean {
  return status === 'timeout' || status === 404 || status === 429 || status >= 500;
}

// Starts the first task now and each next one after delayMs, or at once when every earlier one has failed.
// The first task that succeeds wins and the others are cancelled through their signal. If all fail, the last
// error is thrown. A task that throws a Fatal error stops the whole race.
export class Fatal extends Error {}

export async function raceStaggered<T>(tasks: ((signal: AbortSignal) => Promise<T>)[], delayMs: number): Promise<T> {
  const controllers = tasks.map(() => new AbortController());
  return new Promise<T>((resolve, reject) => {
    let started = 0;
    let failed = 0;
    let done = false;
    let lastError: unknown = new Error('no task');
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (settle: () => void) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      controllers.forEach((c) => c.abort());
      settle();
    };

    const startNext = () => {
      if (done || started >= tasks.length) return;
      const index = started++;
      if (started < tasks.length) timer = setTimeout(startNext, delayMs);
      tasks[index](controllers[index].signal).then(
        (value) => finish(() => resolve(value)),
        (error) => {
          if (done) return;
          if (error instanceof Fatal) return finish(() => reject(error));
          lastError = error;
          failed++;
          if (failed === tasks.length) return finish(() => reject(lastError));
          // everything started so far has failed: do not wait out the delay
          if (failed === started) {
            if (timer) clearTimeout(timer);
            startNext();
          }
        }
      );
    };
    startNext();
  });
}
