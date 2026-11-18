// SQL missions: a student writes a real query, it runs on a fresh copy of a small company database (SQLite in
// the browser) and is checked against the result of the reference solution. No AI is involved.
import type { Database, QueryExecResult, SqlJsStatic, SqlValue } from 'sql.js';

export type Cell = string | number | null;

export interface SqlMission {
  id: number; // 1-based, the story order
  title: string;
  brief: string[]; // the boss's chat messages
  task: string; // exactly what to return, with the column list
  tables: string[]; // tables shown under the task
  chips: string[]; // SQL pieces to tap in on a phone
  hint: string;
  solution: string;
  kind: 'select' | 'change';
  orderBy?: { col: number; desc?: boolean }[]; // select: the rows must come sorted by these result columns
  check?: string; // change: the query that shows the table after the student's statements
  nearMisses?: { sql: string; message: string }[]; // select: common wrong answers and what to say about them
  success: string[]; // the story goes on
  questions: string[]; // exam question ids this mission prepares for
}

export interface RunOutput {
  columns: string[];
  rows: Cell[][];
  ok: boolean;
  message: string; // why it is not right yet, or the error in plain words
}

export const SHOWN_ROWS = 50;

const cell = (v: SqlValue): Cell => {
  if (v === null || typeof v === 'string') return v;
  if (typeof v === 'number') return Math.round(v * 100) / 100; // AVG and friends: 2 decimals are enough
  return String(v);
};

const lastResult = (results: QueryExecResult[]): QueryExecResult | undefined => results[results.length - 1];

const key = (row: Cell[]): string => JSON.stringify(row);

const sameRows = (a: Cell[][], b: Cell[][]): boolean => {
  if (a.length !== b.length) return false;
  const x = a.map(key).sort();
  const y = b.map(key).sort();
  return x.every((k, i) => k === y[i]);
};

const compareCells = (a: Cell, b: Cell): number => {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
};

export function isSorted(rows: Cell[][], orderBy: { col: number; desc?: boolean }[]): boolean {
  for (let i = 1; i < rows.length; i++) {
    for (const { col, desc } of orderBy) {
      const c = compareCells(rows[i - 1][col], rows[i][col]) * (desc ? -1 : 1);
      if (c < 0) break; // this pair is in order
      if (c > 0) return false;
    }
  }
  return true;
}

// SQLite's messages in plain Uzbek; anything else is shown as it is
export function explainError(raw: string): string {
  const m = (re: RegExp) => raw.match(re);
  let r: RegExpMatchArray | null;
  if ((r = m(/no such table: ([\w.]+)/))) return `Bunday jadval yo'q: ${r[1]}. Jadval nomini tekshiring.`;
  if ((r = m(/no such column: (\S+)/))) return `Bunday ustun yo'q: ${r[1]}. Ustun nomini yoki jadval qisqartmasini tekshiring.`;
  if ((r = m(/ambiguous column name: ([\w.]+)/)))
    return `"${r[1]}" ustuni ikkala jadvalda ham bor. Oldiga jadval nomini yozing, masalan: b.${r[1]}`;
  if ((r = m(/near "(.+?)": syntax error/))) return `Yozuvda xato bor: "${r[1]}" so'zi yonida.`;
  if (/incomplete input/.test(raw)) return "So'rov oxirigacha yozilmagan (qavs yoki qo'shtirnoq yopilmagan bo'lishi mumkin).";
  if (/misuse of aggregate/.test(raw)) return "COUNT, SUM kabi funksiya noto'g'ri joyda turibdi. Guruh sharti uchun WHERE emas, HAVING kerak.";
  if (/unrecognized token/.test(raw)) return "Tushunarsiz belgi bor. Qo'shtirnoqlar to'g'ri yopilganini tekshiring.";
  return raw;
}

function fresh(SQL: SqlJsStatic, setup: string): Database {
  const db = new SQL.Database();
  db.run(setup);
  return db;
}

// Phone keyboards put typographic quotes (‘ ’ ʻ ʼ “ ”) where SQL needs plain ' and "
export const plainQuotes = (sql: string): string => sql.replace(/[‘’ʻʼ`´′]/g, "'").replace(/[“”″]/g, '"').replace(/\u00a0/g, ' ');

// An UPDATE or DELETE without WHERE touches every row
export const missingWhere = (sql: string): boolean =>
  sql.split(';').some((st) => /^\s*(update|delete)\b/i.test(st) && !/\bwhere\b/i.test(st));

const asRows = (r: QueryExecResult | undefined): Cell[][] => (r ? r.values.map((row) => row.map(cell)) : []);

// Runs the student's SQL on a fresh database and tells whether it does what the mission asks
export function evaluate(SQL: SqlJsStatic, setup: string, mission: SqlMission, typed: string): RunOutput {
  const empty: RunOutput = { columns: [], rows: [], ok: false, message: '' };
  const sql = plainQuotes(typed);
  if (!sql.trim()) return { ...empty, message: "Avval so'rov yozing." };

  const ref = fresh(SQL, setup);
  const db = fresh(SQL, setup);
  try {
    let shown: QueryExecResult | undefined;
    try {
      shown = lastResult(db.exec(sql));
    } catch (e) {
      return { ...empty, message: explainError(e instanceof Error ? e.message : String(e)) };
    }
    const out: RunOutput = { columns: shown?.columns ?? [], rows: asRows(shown).slice(0, SHOWN_ROWS), ok: false, message: '' };

    if (mission.kind === 'select') {
      const want = lastResult(ref.exec(mission.solution));
      const wantRows = asRows(want);
      const got = asRows(shown);
      if (!shown) return { ...out, message: "So'rov natija qaytarmadi. Natijani SELECT bilan chiqaring." };
      if (shown.columns.length !== (want?.columns.length ?? 0))
        return { ...out, message: `Ustunlar soni mos emas: ${want?.columns.length ?? 0} ta kerak, sizda ${shown.columns.length} ta.` };
      if (!sameRows(got, wantRows)) {
        const near = mission.nearMisses?.find((n) => sameRows(got, asRows(lastResult(ref.exec(n.sql)))));
        if (near) return { ...out, message: near.message };
        const hint =
          got.length !== wantRows.length
            ? `Sizda ${got.length} ta qator chiqdi, kerakli natijada ${wantRows.length} ta.`
            : "Qatorlar soni to'g'ri, lekin qiymatlar boshqacha. Ustunlar tartibi va shartlarni tekshiring.";
        return { ...out, message: hint };
      }
      if (mission.orderBy && !isSorted(got, mission.orderBy))
        return { ...out, message: "Qatorlar to'g'ri, faqat tartibi boshqacha. ORDER BY ni tekshiring." };
      return { ...out, ok: true };
    }

    // A change: compare the table after the student's statements with the table after the solution
    const check = mission.check ?? '';
    const before = asRows(lastResult(ref.exec(check)));
    ref.exec(mission.solution);
    const want = asRows(lastResult(ref.exec(check)));
    let got: Cell[][];
    try {
      got = asRows(lastResult(db.exec(check)));
    } catch {
      return { ...out, message: "Kerakli jadval o'chirib yuborildi yoki buzildi. Bu topshiriqda faqat UPDATE kerak." };
    }
    const changed = (rows: Cell[][]) => rows.filter((r, i) => key(r) !== key(before[i] ?? [])).length;
    if (sameRows(got, want)) return { ...out, ok: true };
    if (got.length !== before.length) return { ...out, message: "Jadvaldagi qatorlar soni o'zgarib ketdi. Bu topshiriqda qator qo'shish yoki o'chirish kerak emas." };
    const n = changed(got);
    const need = changed(want);
    if (n === 0) return { ...out, message: "Bazada hech narsa o'zgarmadi. Bu topshiriqda UPDATE kerak." };
    if (n > need && missingWhere(sql))
      return { ...out, message: `Diqqat: ${n} ta qator o'zgarib ketdi! WHERE shartisiz UPDATE butun jadvalni o'zgartiradi.` };
    if (n > need) return { ...out, message: `Keragidan ko'p qator o'zgardi: ${n} ta, kerak edi ${need} ta. WHERE shartini aniqlashtiring.` };
    return { ...out, message: `${n} ta qator o'zgardi, kerak edi ${need} ta. Shart yoki yangi qiymatni tekshiring.` };
  } finally {
    ref.close();
    db.close();
  }
}
