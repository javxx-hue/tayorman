// Runs the student's SQL away from the screen thread, so a heavy or endless query never freezes the app:
// the page simply ends this worker when it takes too long (see sqlRunner.ts).
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { evaluate } from './sqlMission';
import { BAZA_MISSIONS, BAZA_SETUP } from './bazaMissions';

export type ToWorker = { kind: 'run'; seq: number; mission: number; sql: string };
export type FromWorker =
  | { kind: 'ready' }
  | { kind: 'failed' }
  | { kind: 'result'; seq: number; out: import('./sqlMission').RunOutput };

const ctx = self as unknown as { onmessage: ((e: MessageEvent<ToWorker>) => void) | null; postMessage: (m: FromWorker) => void };
const engine = initSqlJs({ locateFile: () => wasmUrl });

engine.then(
  () => ctx.postMessage({ kind: 'ready' }),
  () => ctx.postMessage({ kind: 'failed' })
);

ctx.onmessage = async (e) => {
  const { seq, mission, sql } = e.data;
  const SQL = await engine;
  const m = BAZA_MISSIONS.find((x) => x.id === mission);
  if (!m) return;
  ctx.postMessage({ kind: 'result', seq, out: evaluate(SQL, BAZA_SETUP, m, sql) });
};
