// The page's side of the SQL worker: loads the engine once, runs one query at a time and stops a query
// that takes too long by ending the worker (a new one starts on the next run).
import type { FromWorker, ToWorker } from './sqlWorker';
import type { RunOutput } from './sqlMission';

const RUN_LIMIT_MS = 4000; // a mission query on 24 rows takes milliseconds
const LOAD_LIMIT_MS = 30000; // the engine is about 0.6 MB, slow mobile data included

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let seq = 0;

function start(): { w: Worker; ready: Promise<void> } {
  if (!worker || !ready) {
    const w = new Worker(new URL('./sqlWorker.ts', import.meta.url), { type: 'module' });
    worker = w;
    ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('LOAD_FAILED')), LOAD_LIMIT_MS);
      const onMessage = (e: MessageEvent<FromWorker>) => {
        if (e.data.kind !== 'ready' && e.data.kind !== 'failed') return;
        clearTimeout(timer);
        w.removeEventListener('message', onMessage);
        if (e.data.kind === 'ready') resolve();
        else reject(new Error('LOAD_FAILED'));
      };
      w.addEventListener('message', onMessage);
      w.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('LOAD_FAILED'));
      });
    });
    // A failed start is not kept: the next run tries again
    ready.catch(() => stopSqlEngine());
  }
  return { w: worker, ready };
}

// Starts loading the engine early, while the student reads the task
export function prepareSqlEngine(): void {
  start().ready.catch(() => undefined);
}

export async function runMission(mission: number, sql: string): Promise<RunOutput> {
  const { w, ready: loaded } = start();
  await loaded;
  const id = ++seq;
  return new Promise<RunOutput>((resolve, reject) => {
    const timer = setTimeout(() => {
      w.removeEventListener('message', onMessage);
      stopSqlEngine();
      reject(new Error('TIMEOUT'));
    }, RUN_LIMIT_MS);
    const onMessage = (e: MessageEvent<FromWorker>) => {
      if (e.data.kind !== 'result' || e.data.seq !== id) return;
      clearTimeout(timer);
      w.removeEventListener('message', onMessage);
      resolve(e.data.out);
    };
    w.addEventListener('message', onMessage);
    const msg: ToWorker = { kind: 'run', seq: id, mission, sql };
    w.postMessage(msg);
  });
}

// Frees the engine's memory when the student leaves the missions
export function stopSqlEngine(): void {
  worker?.terminate();
  worker = null;
  ready = null;
}
