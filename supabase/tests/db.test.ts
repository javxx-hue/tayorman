// Runs both migrations on a real Postgres (PGlite, in WebAssembly) with Supabase-like
// roles and checks who may see and do what (row level security).
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = (name: string) => readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');

// Minimal stand-ins for what Supabase provides
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function extensions.gen_random_bytes(n int) returns bytea language sql
    as $$ select decode(substr(md5(random()::text || clock_timestamp()::text) || md5(random()::text), 1, n * 2), 'hex') $$;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const U = {
  admin: '00000000-0000-0000-0000-0000000000a1',
  mod: '00000000-0000-0000-0000-0000000000b1',
  s1: '00000000-0000-0000-0000-0000000000c1', // in G1
  s2: '00000000-0000-0000-0000-0000000000c2', // in G2
  blocked: '00000000-0000-0000-0000-0000000000d1',
};
const G1 = '10000000-0000-0000-0000-000000000001';
const G2 = '10000000-0000-0000-0000-000000000002';
const LIB = '20000000-0000-0000-0000-000000000001';

let db: PGlite;

// Run a query as a signed-in user (RLS applies), or as anon when uid is null
async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const rows = async (q: string, params: unknown[] = []) => (await db.query<any>(q, params)).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  await db.exec(sql('0001_init.sql'));
  await db.exec(sql('0002_admin.sql'));
  await db.exec(`
    insert into auth.users (id, email) values
      ('${U.admin}', 'a@x'), ('${U.mod}', 'm@x'), ('${U.s1}', 's1@x'), ('${U.s2}', 's2@x'), ('${U.blocked}', 'b@x');
    insert into public.profiles (id, telegram_id, first_name, role, blocked) values
      ('${U.admin}', 1, 'Admin', 'admin', false),
      ('${U.mod}', 2, 'Moderator', 'moderator', false),
      ('${U.s1}', 3, 'Student1', 'student', false),
      ('${U.s2}', 4, 'Student2', 'student', false),
      ('${U.blocked}', 5, 'Blocked', 'student', true);
    insert into public.communities (id, name) values ('${G1}', 'Group 1'), ('${G2}', 'Group 2');
    insert into public.community_members (community_id, user_id) values ('${G1}', '${U.s1}'), ('${G2}', '${U.s2}');
    insert into public.community_moderators (community_id, user_id) values ('${G1}', '${U.mod}');
    insert into public.library_items (id, kind, source_id, title, data, audience_all)
      values ('${LIB}', 'set', 'src1', 'Math test', '{"secret":"x"}', true);
  `);
});

describe('migrations', () => {
  it('apply cleanly and create the new tables', async () => {
    const t = await rows(`select table_name from information_schema.tables where table_schema = 'public' order by 1`);
    const names = t.map((r) => r.table_name);
    for (const n of ['assignments', 'assignment_progress', 'suggestions', 'issue_reports', 'audit_log', 'app_settings', 'community_moderators']) {
      expect(names).toContain(n);
    }
  });
});

describe('profiles and roles', () => {
  it('students see only themselves, admins see everyone, moderators only their group', async () => {
    expect((await as(U.s1, () => rows('select id from public.profiles'))).map((r) => r.id)).toEqual([U.s1]);
    expect(await as(U.admin, () => rows('select id from public.profiles'))).toHaveLength(5);
    const seenByMod = (await as(U.mod, () => rows('select id from public.profiles'))).map((r) => r.id).sort();
    expect(seenByMod).toEqual([U.mod, U.s1].sort());
  });

  it('a student cannot change their own role, block flag or limit', async () => {
    for (const col of ['role', 'blocked', 'ai_daily_limit', 'telegram_id']) {
      const value = col === 'role' ? `'admin'` : col === 'blocked' ? 'false' : '999';
      await expect(as(U.s1, () => db.exec(`update public.profiles set ${col} = ${value} where id = '${U.s1}'`))).rejects.toThrow(/permission denied/i);
    }
  });

  it('a blocked admin loses admin powers', async () => {
    await db.exec(`update public.profiles set blocked = true where id = '${U.admin}'`);
    expect(await as(U.admin, () => rows('select public.is_admin() as a'))).toEqual([{ a: false }]);
    await db.exec(`update public.profiles set blocked = false where id = '${U.admin}'`);
    expect(await as(U.admin, () => rows('select public.is_admin() as a'))).toEqual([{ a: true }]);
  });
});

describe('admin_set_user', () => {
  it('lets an admin block a student and writes the audit log', async () => {
    await as(U.admin, () => db.query('select public.admin_set_user($1, true)', [U.s2]));
    expect((await rows(`select blocked from public.profiles where id = '${U.s2}'`))[0].blocked).toBe(true);
    const log = await rows(`select actor_name, action, target_table from public.audit_log where target_id = '${U.s2}'`);
    expect(log).toEqual([{ actor_name: 'Admin', action: 'update', target_table: 'profiles' }]);
    await db.exec(`update public.profiles set blocked = false where id = '${U.s2}'`);
  });

  it('refuses students and moderators', async () => {
    await expect(as(U.s1, () => db.query('select public.admin_set_user($1, true)', [U.s2]))).rejects.toThrow(/forbidden/);
    await expect(as(U.mod, () => db.query('select public.admin_set_user($1, true)', [U.s2]))).rejects.toThrow(/forbidden/);
  });

  it('never lets an admin lock themselves out or hand out the admin role', async () => {
    await expect(as(U.admin, () => db.query('select public.admin_set_user($1, true)', [U.admin]))).rejects.toThrow(/lock yourself/);
    await expect(as(U.admin, () => db.query(`select public.admin_set_user($1, null, 'admin')`, [U.s1]))).rejects.toThrow(/ADMIN_TELEGRAM_IDS/);
    await as(U.admin, () => db.query(`select public.admin_set_user($1, null, 'moderator')`, [U.s1]));
    expect((await rows(`select role from public.profiles where id = '${U.s1}'`))[0].role).toBe('moderator');
    await as(U.admin, () => db.query(`select public.admin_set_user($1, null, 'student')`, [U.s1]));
  });
});

describe('assignments', () => {
  let assignmentG1: string;

  it('an admin creates one for Group 1: only its members see it', async () => {
    const [r] = await as(U.admin, () =>
      rows(`insert into public.assignments (title, library_item_id, community_ids, due_at)
            values ('Week 1', $1, array['${G1}']::uuid[], now() + interval '3 days') returning id`, [LIB])
    );
    assignmentG1 = r.id;
    expect((await as(U.s1, () => rows('select title from public.assignments'))).map((x) => x.title)).toEqual(['Week 1']);
    expect(await as(U.s2, () => rows('select title from public.assignments'))).toEqual([]);
  });

  it('archived assignments disappear for students', async () => {
    await db.exec(`update public.assignments set status = 'archived' where id = '${assignmentG1}'`);
    expect(await as(U.s1, () => rows('select 1 from public.assignments'))).toEqual([]);
    await db.exec(`update public.assignments set status = 'active' where id = '${assignmentG1}'`);
  });

  it('a student cannot create one; a moderator can only target their own groups', async () => {
    await expect(
      as(U.s1, () => db.query(`insert into public.assignments (title, library_item_id, community_ids) values ('x', $1, array['${G1}']::uuid[])`, [LIB]))
    ).rejects.toThrow(/row-level security/i);
    await as(U.mod, () => db.query(`insert into public.assignments (title, library_item_id, community_ids) values ('mine', $1, array['${G1}']::uuid[])`, [LIB]));
    await expect(
      as(U.mod, () => db.query(`insert into public.assignments (title, library_item_id, community_ids) values ('other', $1, array['${G2}']::uuid[])`, [LIB]))
    ).rejects.toThrow(/row-level security/i);
    await expect(
      as(U.mod, () => db.query(`insert into public.assignments (title, library_item_id, audience_all) values ('everyone', $1, true)`, [LIB]))
    ).rejects.toThrow(/row-level security/i);
  });

  it('progress is private to the student; staff of that group see it; stats add up', async () => {
    await as(U.s1, () => db.query(`insert into public.assignment_progress (assignment_id, status, score) values ($1, 'done', 80)`, [assignmentG1]));
    await expect(
      as(U.s1, () => db.query(`insert into public.assignment_progress (assignment_id, user_id, status) values ($1, $2, 'done')`, [assignmentG1, U.s2]))
    ).rejects.toThrow(/row-level security/i);
    expect(await as(U.s2, () => rows('select 1 from public.assignment_progress'))).toEqual([]);
    expect(await as(U.mod, () => rows('select 1 from public.assignment_progress'))).toHaveLength(1);

    const [{ stats }] = await as(U.admin, () => rows('select public.assignment_stats($1) as stats', [assignmentG1]));
    expect(stats).toMatchObject({ audience: 1, started: 1, done: 1, avg_score: 80 });
    expect(stats.by_community).toEqual([{ name: 'Group 1', members: 1, done: 1 }]);
    await expect(as(U.s1, () => rows('select public.assignment_stats($1)', [assignmentG1]))).rejects.toThrow(/forbidden/);
  });
});

describe('suggestions and reports', () => {
  it('students send and read only their own; admins read and answer all', async () => {
    await as(U.s1, () => db.query(`insert into public.suggestions (kind, text) values ('new_subject', 'Please add Physics')`));
    expect(await as(U.s2, () => rows('select 1 from public.suggestions'))).toEqual([]);
    expect(await as(U.s1, () => rows('select 1 from public.suggestions'))).toHaveLength(1);
    expect(await as(U.admin, () => rows('select text from public.suggestions'))).toHaveLength(1);

    await as(U.admin, () => db.query(`update public.suggestions set status = 'accepted', admin_reply = 'Added' where status = 'new'`));
    expect((await as(U.s1, () => rows('select status, admin_reply from public.suggestions')))[0]).toEqual({ status: 'accepted', admin_reply: 'Added' });
  });

  it('students cannot answer their own suggestion or impersonate others', async () => {
    const res = await as(U.s1, () => db.query(`update public.suggestions set status = 'declined' returning id`));
    expect(res.rows).toEqual([]); // RLS filters the row: nothing updated
    await expect(
      as(U.s1, () => db.query(`insert into public.suggestions (user_id, kind, text) values ($1, 'other', 'fake')`, [U.s2]))
    ).rejects.toThrow(/row-level security/i);
  });

  it('stops spam after 10 suggestions a day', async () => {
    for (let i = 0; i < 9; i++) {
      await as(U.s2, () => db.query(`insert into public.suggestions (kind, text) values ('other', 'message ${i}')`));
    }
    await as(U.s2, () => db.query(`insert into public.suggestions (kind, text) values ('other', 'the 10th')`));
    await expect(as(U.s2, () => db.query(`insert into public.suggestions (kind, text) values ('other', 'the 11th')`))).rejects.toThrow(/daily limit/);
  });

  it('issue reports follow the same ownership rules', async () => {
    await as(U.s1, () => db.query(`insert into public.issue_reports (question_text, note) values ('2+2?', 'answer is wrong')`));
    expect(await as(U.s2, () => rows('select 1 from public.issue_reports'))).toEqual([]);
    expect(await as(U.admin, () => rows('select 1 from public.issue_reports'))).toHaveLength(1);
  });
});

describe('AI limits', () => {
  it('uses the global default, then a group limit, then the personal override', async () => {
    await db.exec(`update public.app_settings set value = '2' where key = 'ai_daily_limit'`);
    expect((await rows(`select public.effective_ai_limit('${U.s1}') as l`))[0].l).toBe(2);
    await db.exec(`update public.communities set ai_daily_limit = 5 where id = '${G1}'`);
    expect((await rows(`select public.effective_ai_limit('${U.s1}') as l`))[0].l).toBe(5);
    await db.exec(`update public.profiles set ai_daily_limit = 1 where id = '${U.s1}'`);
    expect((await rows(`select public.effective_ai_limit('${U.s1}') as l`))[0].l).toBe(1);
  });

  it('counts requests, stops at the limit and never serves blocked users', async () => {
    await db.exec(`delete from public.ai_usage`);
    const ask = async (u: string) => (await rows(`select public.consume_ai_quota_auto('${u}') as ok`))[0].ok;
    expect(await ask(U.s1)).toBe(true); // limit is 1
    expect(await ask(U.s1)).toBe(false);
    expect(await ask(U.blocked)).toBe(false);
  });

  it('cannot be called by students directly', async () => {
    await expect(as(U.s1, () => rows(`select public.consume_ai_quota_auto('${U.s1}')`))).rejects.toThrow(/permission denied/i);
  });
});

describe('admin lists and dashboard', () => {
  it('admin_users: admins see all, moderators only their group, students are refused', async () => {
    expect(Number((await as(U.admin, () => rows('select * from public.admin_users()')))[0].total)).toBe(5);
    const modSees = (await as(U.mod, () => rows('select telegram_id from public.admin_users()'))).map((r) => Number(r.telegram_id));
    expect(modSees).toEqual([3]);
    await expect(as(U.s1, () => rows('select * from public.admin_users()'))).rejects.toThrow(/forbidden/);
  });

  it('admin_users searches by name and by Telegram id', async () => {
    expect(await as(U.admin, () => rows(`select first_name from public.admin_users('student1')`))).toEqual([{ first_name: 'Student1' }]);
    expect(await as(U.admin, () => rows(`select first_name from public.admin_users('4')`))).toEqual([{ first_name: 'Student2' }]);
  });

  it('dashboard is admin only and returns the funnel', async () => {
    await db.exec(`insert into public.events (user_id, type) values ('${U.s1}', 'app_open'), ('${U.s1}', 'subject_created'), ('${U.s2}', 'app_open')`);
    const [{ d }] = await as(U.admin, () => rows('select public.admin_dashboard(14) as d'));
    expect(d.funnel).toMatchObject({ opened_app: 2, subject_created: 1 });
    await expect(as(U.mod, () => rows('select public.admin_dashboard(14)'))).rejects.toThrow(/forbidden/);
  });

  it('hard questions need at least 3 graded attempts', async () => {
    const attempts = (n: number, score: number) => Array.from({ length: n }, () => ({ at: 1, answer: 'a', score, feedback: '', missing: [] }));
    await db.query(`insert into public.subjects (user_id, id, data) values ($1, 'sub1', $2)`, [
      U.s1,
      JSON.stringify({ name: 'Math', questions: [{ id: 'q1', text: 'Hard one', attempts: attempts(3, 30) }, { id: 'q2', text: 'Rare', attempts: attempts(2, 10) }] }),
    ]);
    const hard = await as(U.admin, () => rows('select subject, question, attempts, avg_score from public.admin_hard_questions()'));
    expect(hard.map((h) => ({ ...h, attempts: Number(h.attempts), avg_score: Number(h.avg_score) }))).toEqual([{ subject: 'Math', question: 'Hard one', attempts: 3, avg_score: 30 }]);
  });
});

describe('audit log', () => {
  it('records library changes and is readable by admins only', async () => {
    await as(U.admin, () => db.query(`update public.library_items set published = false where id = $1`, [LIB]));
    const entries = await as(U.admin, () => rows(`select action, target_table, details from public.audit_log where target_table = 'library_items'`));
    expect(entries.length).toBeGreaterThan(0);
    expect(JSON.stringify(entries)).not.toContain('secret'); // content (data column) is never copied into the log
    expect(await as(U.s1, () => rows('select 1 from public.audit_log'))).toEqual([]);
    await db.exec(`update public.library_items set published = true where id = '${LIB}'`);
  });
});
