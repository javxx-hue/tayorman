import { beforeAll, describe, expect, it } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { evaluate, explainError, isSorted, missingWhere, plainQuotes, SqlMission } from './sqlMission';
import { insertPiece, missionOpen, progressOfRefs, STORIES } from './missionStories';
import { TARMOQ_MISSIONS } from './tarmoqMissions';
import { BAZA_MISSIONS, BAZA_SETUP, BAZA_TABLES } from './bazaMissions';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

const mission = (id: number): SqlMission => BAZA_MISSIONS.find((m) => m.id === id)!;
const run = (id: number, sql: string) => evaluate(SQL, BAZA_SETUP, mission(id), sql);

describe('the company database', () => {
  it('builds and has the tables the screen lists, with the same columns', () => {
    const db = new SQL.Database();
    db.run(BAZA_SETUP);
    for (const t of BAZA_TABLES) {
      const cols = db.exec(`PRAGMA table_info(${t.name})`)[0].values.map((r) => r[1]);
      expect(cols).toEqual(t.columns);
    }
    db.close();
  });

  it('every mission has its reference solution accepted and points at real exam questions', () => {
    expect(BAZA_MISSIONS.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
    for (const m of BAZA_MISSIONS) {
      expect(run(m.id, m.solution).ok, m.title).toBe(true);
      expect(m.questions.every((q) => /^q-baza-\d{3}$/.test(q))).toBe(true);
      expect(m.tables.every((t) => BAZA_TABLES.some((x) => x.name === t))).toBe(true);
    }
  });
});

describe('mission 1: waiting orders', () => {
  it('accepts another correct way to write it', () => {
    expect(run(1, "select id, mijoz_id, sana from buyurtmalar where sana < '2026-11-16' and holat='kutilmoqda' order by sana asc, id").ok).toBe(true);
  });
  it('finds 7 orders and shows them', () => {
    const out = run(1, mission(1).solution);
    expect(out.rows).toHaveLength(7);
    expect(out.columns).toEqual(['id', 'mijoz_id', 'sana']);
  });
  it('says what is wrong: missing status, wrong columns, wrong order, a typo', () => {
    expect(run(1, "SELECT id, mijoz_id, sana FROM buyurtmalar WHERE holat = 'kutilmoqda' AND sana < '2026-11-14'").message).toMatch(/qator chiqdi/);
    expect(run(1, "SELECT * FROM buyurtmalar WHERE holat = 'kutilmoqda' AND sana <= '2026-11-15'").message).toMatch(/Ustunlar soni/);
    expect(run(1, "SELECT id, mijoz_id, sana FROM buyurtmalar WHERE holat = 'kutilmoqda' AND sana <= '2026-11-15' ORDER BY sana DESC").message).toMatch(/tartibi/);
    expect(run(1, 'SELECT id FROM buyurtma').message).toMatch(/Bunday jadval yo'q: buyurtma/);
    expect(run(1, 'SELEC id FROM buyurtmalar').message).toMatch(/Yozuvda xato/);
    expect(run(1, '   ').message).toMatch(/so'rov yozing/);
  });
});

describe('typed on a phone', () => {
  it('accepts the typographic quotes a phone keyboard puts in', () => {
    expect(plainQuotes('‘a’ ʻbʼ “c” `d`')).toBe(`'a' 'b' "c" 'd'`);
    const ok = "SELECT kuryer_id, COUNT(*) AS soni FROM buyurtmalar WHERE holat = 'kutilmoqda' GROUP BY kuryer_id ORDER BY soni DESC";
    for (const q of ['‘kutilmoqda’', 'ʻkutilmoqdaʼ', '’kutilmoqda’']) expect(run(2, ok.replace("'kutilmoqda'", q)).ok, q).toBe(true);
  });
  it('explains an unknown column even with odd characters in it', () => {
    expect(explainError('no such column: ‘x’')).toMatch(/Bunday ustun yo'q: ‘x’/);
  });
});

describe('common mistakes get a plain explanation', () => {
  it('mission 1: no status or no date', () => {
    expect(run(1, "SELECT id, mijoz_id, sana FROM buyurtmalar WHERE sana <= '2026-11-15' ORDER BY sana").message).toMatch(/Holat sharti yo'q/);
    expect(run(1, "SELECT id, mijoz_id, sana FROM buyurtmalar WHERE holat = 'kutilmoqda' ORDER BY sana").message).toMatch(/Sana sharti yo'q/);
  });
  it('mission 2: the date of mission 1 kept, no status, columns swapped', () => {
    const base = "FROM buyurtmalar WHERE holat = 'kutilmoqda' GROUP BY kuryer_id ORDER BY 2 DESC";
    expect(run(2, `SELECT kuryer_id, COUNT(*) FROM buyurtmalar WHERE holat = 'kutilmoqda' AND sana <= '2026-11-15' GROUP BY kuryer_id`).message).toMatch(/15-noyabrgacha/);
    expect(run(2, 'SELECT kuryer_id, COUNT(*) FROM buyurtmalar GROUP BY kuryer_id ORDER BY 2 DESC').message).toMatch(/barcha buyurtmalarni/);
    expect(run(2, `SELECT COUNT(*), kuryer_id ${base.replace('ORDER BY 2', 'ORDER BY 1')}`).message).toMatch(/joyi almashib/);
  });
  it('mission 3 and 4: a missing condition is named', () => {
    expect(run(3, "SELECT b.id, k.ism, k.faol FROM buyurtmalar b JOIN kuryerlar k ON b.kuryer_id = k.id WHERE b.holat = 'kutilmoqda'").message).toMatch(/Sana sharti/);
    expect(run(4, "SELECT vaqt, foydalanuvchi FROM jurnal WHERE amal LIKE '%kuryer_id%'").message).toMatch(/Madinaniki/);
    expect(run(4, "SELECT vaqt, foydalanuvchi FROM jurnal WHERE vaqt LIKE '2026-11-16%'").message).toMatch(/kuryer_id borini/);
  });
  it('mission 1: a date written as on paper gets the database format', () => {
    expect(run(1, "SELECT id, mijoz_id, sana FROM buyurtmalar WHERE holat = 'kutilmoqda' AND sana <= '15.11.2026' ORDER BY sana").message).toMatch(
      /'15\.11\.2026' o'rniga '2026-11-15'/
    );
  });
  it('a SELECT that finds nothing is told so, not asked for a SELECT', () => {
    expect(run(1, "SELECT id, mijoz_id, sana FROM buyurtmalar WHERE holat = 'yo''q'").message).toMatch(/birorta ham qator topmadi/);
    expect(run(1, 'UPDATE buyurtmalar SET summa = 1').message).toMatch(/SELECT bilan chiqaring/);
  });
  it('every near miss differs from the right answer', () => {
    for (const m of BAZA_MISSIONS) for (const n of m.nearMisses ?? []) expect(run(m.id, n.sql).ok, n.sql).toBe(false);
  });
});

describe('missions 2-4', () => {
  it('2: counts per courier, most first', () => {
    const out = run(2, mission(2).solution);
    expect(out.rows[0]).toEqual([3, 7]);
    expect(run(2, "SELECT kuryer_id, COUNT(*) FROM buyurtmalar WHERE holat = 'kutilmoqda' GROUP BY kuryer_id ORDER BY 2 DESC").ok).toBe(true);
    expect(run(2, "SELECT kuryer_id, COUNT(*) FROM buyurtmalar WHERE holat = 'kutilmoqda' GROUP BY kuryer_id ORDER BY 2").ok).toBe(false);
  });
  it('3: needs the join and the table prefix', () => {
    expect(run(3, mission(3).solution).rows.every((r) => r[1] === 'Sardor' && r[2] === 0)).toBe(true);
    expect(run(3, "SELECT id, ism, faol FROM buyurtmalar b JOIN kuryerlar k ON b.kuryer_id = k.id WHERE holat = 'kutilmoqda'").message).toMatch(/ikkala jadvalda/);
    expect(run(3, "SELECT b.id, k.ism, k.faol FROM buyurtmalar b, kuryerlar k WHERE b.kuryer_id = k.id AND b.holat = 'kutilmoqda' AND b.sana <= '2026-11-15'").ok).toBe(true);
  });
  it('4: needs both the day and the column name', () => {
    expect(run(4, mission(4).solution).rows).toEqual([['2026-11-16 02:14', 'test_skript']]);
    expect(run(4, "SELECT vaqt, foydalanuvchi FROM jurnal WHERE amal LIKE '%kuryer_id%'").ok).toBe(false);
    expect(run(4, "SELECT vaqt, foydalanuvchi FROM jurnal WHERE vaqt LIKE '2026-11-16%'").ok).toBe(false);
  });
});

describe('mission 5: the fix', () => {
  it('accepts the update in other spellings, also after a look at the couriers', () => {
    expect(run(5, "SELECT * FROM kuryerlar; update buyurtmalar set kuryer_id = (select id from kuryerlar where ism = 'Nodira') where holat = 'kutilmoqda' and kuryer_id = 3;").ok).toBe(true);
  });
  it('warns about an update without WHERE and about too wide a condition', () => {
    expect(run(5, 'UPDATE buyurtmalar SET kuryer_id = 5').message).toMatch(/WHERE shartisiz/);
    expect(run(5, 'UPDATE buyurtmalar SET kuryer_id = 5 WHERE kuryer_id = 3').message).toMatch(/Keragidan ko'p qator o'zgardi: 9 ta, kerak edi 7 ta/);
    expect(run(5, 'SELECT * FROM buyurtmalar').message).toMatch(/hech narsa o'zgarmadi/);
    expect(run(5, "DELETE FROM buyurtmalar WHERE holat = 'bekor'").message).toMatch(/qatorlar soni/);
    expect(run(5, "UPDATE buyurtmalar SET kuryer_id = 4 WHERE kuryer_id = 3 AND holat = 'kutilmoqda'").message).toMatch(/7 ta qator o'zgardi, kerak edi 7 ta/);
  });
  it('starts from a fresh database every run', () => {
    expect(run(5, 'DROP TABLE buyurtmalar').message).toMatch(/o'chirib yuborildi/);
    expect(run(5, mission(5).solution).ok).toBe(true);
  });
});

describe('helpers', () => {
  it('checks sorting with ties and NULLs', () => {
    expect(isSorted([[1, 'a'], [1, 'b'], [2, 'a']], [{ col: 0 }])).toBe(true);
    expect(isSorted([[2], [1]], [{ col: 0 }])).toBe(false);
    expect(isSorted([[null], [1], [3]], [{ col: 0 }])).toBe(true);
    expect(isSorted([[3, 'x'], [3, 'y'], [1, 'z']], [{ col: 0, desc: true }, { col: 1 }])).toBe(true);
  });
  it('spots UPDATE and DELETE without WHERE', () => {
    expect(missingWhere('update t set a = 1')).toBe(true);
    expect(missingWhere('select 1; DELETE FROM t')).toBe(true);
    expect(missingWhere('UPDATE t SET a = 1 WHERE id = 2')).toBe(false);
    expect(missingWhere('SELECT * FROM t')).toBe(false);
  });
  it('explains unknown errors as they are', () => {
    expect(explainError('something odd')).toBe('something odd');
  });
  it('opens missions one after another', () => {
    expect(missionOpen([], 1)).toBe(true);
    expect(missionOpen([], 2)).toBe(false);
    expect(missionOpen([1], 2)).toBe(true);
  });
  it("reads the server's XP rows back as progress, ignoring anything odd", () => {
    expect(progressOfRefs(['baza:1', 'baza:2', 'algebra:1', 'fizika:1', 'baza:9', 'tarmoq:x', 'tarmoq'])).toEqual({ baza: [1, 2], algebra: [1] });
  });
  it('knows how many missions each story has', () => {
    expect(STORIES.find((s) => s.id === 'baza')?.count).toBe(BAZA_MISSIONS.length);
    expect(STORIES.find((s) => s.id === 'tarmoq')?.count).toBe(TARMOQ_MISSIONS.length);
  });
  it('puts tapped pieces at the cursor with tidy spaces', () => {
    expect(insertPiece('', null, 'SELECT')).toEqual({ text: 'SELECT ', caret: 7 });
    expect(insertPiece('SELECT id FROM t', { start: 9, end: 9 }, ',')).toEqual({ text: 'SELECT id, FROM t', caret: 11 });
    expect(insertPiece('SELECT id, FROM t', { start: 11, end: 11 }, 'sana')).toEqual({ text: 'SELECT id, sana FROM t', caret: 16 });
    expect(insertPiece('abc', { start: 99, end: 99 }, 'x').text).toBe('abc x ');
  });
});
