// Runs the migrations on a real Postgres (PGlite, in WebAssembly) with Supabase-like
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
  create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users (id) on delete cascade);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function extensions.gen_random_bytes(n int) returns bytea language sql
    as $$ select decode(substr(md5(random()::text || clock_timestamp()::text) || md5(random()::text), 1, n * 2), 'hex') $$;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language plpgsql as $$
    declare parts text[];
    begin
      parts := string_to_array(name, '/');
      return parts[1:array_length(parts, 1) - 1];
    end $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to authenticated, anon, service_role;
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
  await db.exec(sql('0003_admin_login.sql'));
  await db.exec(sql('0004_request_files.sql'));
  await db.exec(sql('0005_funnel.sql'));
  await db.exec(sql('0006_performance_indexes.sql'));
  await db.exec(sql('0007_admin_credentials.sql'));
  await db.exec(sql('0008_blocked_and_uploads.sql'));
  await db.exec(sql('0009_quota_refund_and_helpers.sql'));
  await db.exec(sql('0010_quiz_progress.sql'));
  await db.exec(sql('0011_xp_and_duels.sql'));
  await db.exec(sql('0012_board_ai.sql'));
  await db.exec(sql('0013_duel_notices.sql'));
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
}, 60_000); // loading Postgres in WebAssembly can be slow on a busy machine

describe('migrations', () => {
  it('apply cleanly and create the new tables', async () => {
    const t = await rows(`select table_name from information_schema.tables where table_schema = 'public' order by 1`);
    const names = t.map((r) => r.table_name);
    for (const n of ['assignments', 'assignment_progress', 'suggestions', 'issue_reports', 'audit_log', 'app_settings', 'community_moderators']) {
      expect(names).toContain(n);
    }
  });
});

describe('admin site sign-in table', () => {
  const HASH = 'a'.repeat(64);

  it('is closed to everyone except the service role', async () => {
    await db.exec(`insert into public.admin_login_requests (nonce_hash, user_id) values ('${HASH}', '${U.admin}')`);
    for (const uid of [U.admin, U.mod, U.s1, null]) {
      await expect(as(uid, () => rows('select * from public.admin_login_requests'))).rejects.toThrow(/permission denied/i);
      await expect(as(uid, () => db.exec(`insert into public.admin_login_requests (nonce_hash, user_id) values ('${'b'.repeat(64)}', '${U.s1}')`))).rejects.toThrow(/permission denied/i);
    }
  });

  it('accepts only SHA-256 hex hashes and one row per nonce', async () => {
    await expect(db.exec(`insert into public.admin_login_requests (nonce_hash, user_id) values ('plain-nonce', '${U.admin}')`)).rejects.toThrow();
    await expect(db.exec(`insert into public.admin_login_requests (nonce_hash, user_id) values ('${HASH}', '${U.admin}')`)).rejects.toThrow(/duplicate|unique/i);
  });
});

describe('admin logins (login + password)', () => {
  const login = 'ali.admin';
  const record = () =>
    db.exec(`insert into public.admin_credentials (user_id, login, salt, hash, iterations) values ('${U.admin}', '${login}', 's', 'h', 1)`);
  const state = async () => (await rows(`select failed_attempts, locked_until is not null as locked from public.admin_credentials where login = $1`, [login]))[0];
  const fail = () => db.exec(`select public.admin_login_failed('${login}')`);

  it('is closed to everyone except the server', async () => {
    await record();
    for (const uid of [U.admin, U.mod, U.s1, null]) {
      await expect(as(uid, () => rows('select * from public.admin_credentials'))).rejects.toThrow(/permission denied/i);
      await expect(as(uid, () => db.exec(`update public.admin_credentials set login = 'mine'`))).rejects.toThrow(/permission denied/i);
      await expect(as(uid, () => db.exec(`select public.admin_login_failed('${login}')`))).rejects.toThrow(/permission denied/i);
    }
  });

  it('keeps only plain logins and one login per person', async () => {
    await expect(db.exec(`insert into public.admin_credentials (user_id, login, salt, hash, iterations) values ('${U.mod}', 'Not Valid', 's', 'h', 1)`)).rejects.toThrow();
    await expect(db.exec(`insert into public.admin_credentials (user_id, login, salt, hash, iterations) values ('${U.mod}', '${login}', 's', 'h', 1)`)).rejects.toThrow(/duplicate|unique/i);
  });

  it('pauses the login after five wrong passwords in a row', async () => {
    for (let i = 1; i <= 4; i++) {
      await fail();
      expect(await state()).toMatchObject({ failed_attempts: i, locked: false });
    }
    await fail();
    expect(await state()).toMatchObject({ failed_attempts: 5, locked: true });
  });

  it('starts counting again once a pause has run out, and ignores unknown logins', async () => {
    await db.exec(`update public.admin_credentials set locked_until = now() - interval '1 minute' where login = '${login}'`);
    await fail();
    expect(await state()).toMatchObject({ failed_attempts: 1 });
    await expect(db.exec(`select public.admin_login_failed('nobody')`)).resolves.toBeDefined();
  });

  it('disappears with the profile', async () => {
    await db.exec(`delete from public.admin_credentials`);
    await record();
    await db.exec(`insert into auth.users (id, email) values ('99999999-9999-4999-8999-999999999999', 'gone@x'); insert into public.profiles (id, telegram_id, first_name, role) values ('99999999-9999-4999-8999-999999999999', 99, 'Gone', 'moderator')`);
    await db.exec(`insert into public.admin_credentials (user_id, login, salt, hash, iterations) values ('99999999-9999-4999-8999-999999999999', 'gone.mod', 's', 'h', 1)`);
    await db.exec(`delete from public.profiles where id = '99999999-9999-4999-8999-999999999999'`);
    expect(await rows(`select 1 from public.admin_credentials where login = 'gone.mod'`)).toHaveLength(0);
  });
});

describe('blocked users', () => {
  it('see and change nothing once blocked, even with a token that is still valid', async () => {
    expect((await as(U.s1, () => rows('select 1 from public.library_items'))).length).toBe(1);
    expect((await as(U.blocked, () => rows('select 1 from public.library_items'))).length).toBe(0);
    expect(await as(U.blocked, () => rows('select 1 from public.profiles'))).toEqual([]); // not even their own row
    await expect(as(U.blocked, () => db.exec(`insert into public.suggestions (kind, text) values ('other', 'hello')`))).rejects.toThrow(/row-level security/i);
  });

  it('are signed out the moment they are blocked, and only then', async () => {
    await db.exec(`insert into auth.sessions (user_id) values ('${U.s2}'), ('${U.s2}'), ('${U.s1}')`);
    await db.exec(`update public.profiles set first_name = 'Renamed' where id = '${U.s2}'`);
    expect(await rows(`select 1 from auth.sessions where user_id = '${U.s2}'`)).toHaveLength(2); // other updates leave sessions alone
    await db.exec(`update public.profiles set blocked = true where id = '${U.s2}'`);
    expect(await rows(`select 1 from auth.sessions where user_id = '${U.s2}'`)).toHaveLength(0);
    expect(await rows(`select 1 from auth.sessions where user_id = '${U.s1}'`)).toHaveLength(1); // nobody else is touched
    await db.exec(`update public.profiles set blocked = false, first_name = 'Student2' where id = '${U.s2}'; delete from auth.sessions`);
  });

  it('are refused by every table a signed-in user can reach (a new table must be added to migration 0008)', async () => {
    const server = ['admin_credentials', 'admin_login_requests', 'bot_pending']; // closed to everyone but the server
    const tables = await rows(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity order by 1`);
    const guarded = await rows(`select tablename from pg_policies where schemaname = 'public' and policyname = 'blocked users: no access' and permissive = 'RESTRICTIVE'`);
    const open = tables.map((t) => t.relname).filter((t) => !server.includes(t));
    expect(guarded.map((g) => g.tablename).sort()).toEqual(open);
  });
});

describe('AI quota refund', () => {
  const today = `(now() at time zone 'Asia/Tashkent')::date`;
  const count = async () => Number((await rows(`select count from public.ai_usage where user_id = '${U.s1}' and day = ${today}`))[0]?.count ?? 0);

  it('gives back one counted try, never below zero', async () => {
    await db.exec(`delete from public.ai_usage where user_id = '${U.s1}'`);
    await db.exec(`select public.consume_ai_quota_auto('${U.s1}'); select public.consume_ai_quota_auto('${U.s1}')`);
    expect(await count()).toBe(2);
    await db.exec(`select public.refund_ai_quota('${U.s1}')`);
    expect(await count()).toBe(1);
    await db.exec(`select public.refund_ai_quota('${U.s1}'); select public.refund_ai_quota('${U.s1}'); select public.refund_ai_quota('${U.s1}')`);
    expect(await count()).toBe(0);
    await db.exec(`select public.refund_ai_quota('${U.s2}')`); // nothing counted today: nothing happens
    await db.exec(`delete from public.ai_usage where user_id = '${U.s1}'`);
  });

  it('can be called by the server only', async () => {
    for (const uid of [U.admin, U.s1, null]) {
      await expect(as(uid, () => db.exec(`select public.refund_ai_quota('${U.s1}')`))).rejects.toThrow(/permission denied/i);
    }
  });
});

describe('policy helper functions', () => {
  const can = async (role: string, fn: string) => (await rows(`select has_function_privilege('${role}', '${fn}', 'execute') as ok`))[0].ok;

  it('are closed to visitors who are not signed in, and open to signed-in users and the server', async () => {
    for (const fn of ['public.is_admin()', 'public.is_staff()', 'public.moderates(uuid)', 'public.moderates_all(uuid[])', 'public.moderates_assignment(uuid)', 'public.moderates_user(uuid)', 'public.in_audience(boolean, uuid[])']) {
      expect(await can('anon', fn)).toBe(false);
      expect(await can('authenticated', fn)).toBe(true);
      expect(await can('service_role', fn)).toBe(true);
    }
  });

  it('trigger functions are not callable by users at all', async () => {
    for (const fn of ['public.audit_row()', 'public.limit_daily_inserts()']) {
      for (const role of ['anon', 'authenticated']) expect(await can(role, fn)).toBe(false);
    }
  });

  it('the policies still work for signed-in users after the change', async () => {
    expect(await as(U.admin, () => rows('select public.is_admin() as a'))).toEqual([{ a: true }]);
    expect((await as(U.s1, () => rows('select 1 from public.library_items'))).length).toBe(1);
  });
});

describe('request files', () => {
  const put = (uid: string, path: string) =>
    as(uid, () => db.exec(`insert into storage.objects (bucket_id, name, owner) values ('request-files', '${path}', '${uid}')`));
  const visible = (uid: string) => as(uid, async () => (await rows(`select name from storage.objects where bucket_id = 'request-files' order by name`)).map((r) => r.name));

  it('the bucket is private and limited to documents and images up to 20 MB', async () => {
    const [b] = await rows(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'request-files'`);
    expect(b.public).toBe(false);
    expect(Number(b.file_size_limit)).toBe(20 * 1024 * 1024);
    expect(b.allowed_mime_types).toContain('application/pdf');
    expect(b.allowed_mime_types).not.toContain('text/html'); // nothing a browser would run
  });

  it('a student can upload only into their own folder', async () => {
    await put(U.s1, `${U.s1}/lecture.pdf`);
    await expect(put(U.s1, `${U.s2}/sneaky.pdf`)).rejects.toThrow(/row-level security/i);
    await expect(put(U.s1, 'lecture.pdf')).rejects.toThrow(/row-level security/i); // no folder at all
    await expect(as(null, () => db.exec(`insert into storage.objects (bucket_id, name) values ('request-files', '${U.s1}/anon.pdf')`))).rejects.toThrow(/row-level security|permission denied/i);
  });

  it('students see only their own files; admins see all; moderators see none', async () => {
    await put(U.s2, `${U.s2}/notes.docx`);
    expect(await visible(U.s1)).toEqual([`${U.s1}/lecture.pdf`]);
    expect(await visible(U.s2)).toEqual([`${U.s2}/notes.docx`]);
    expect((await visible(U.admin)).length).toBe(2);
    expect(await visible(U.mod)).toEqual([]);
  });

  it('only admins delete files', async () => {
    await as(U.s1, () => db.exec(`delete from storage.objects where name = '${U.s1}/lecture.pdf'`));
    expect((await visible(U.admin)).length).toBe(2); // the student's delete touched nothing
    await as(U.admin, () => db.exec(`delete from storage.objects where name = '${U.s1}/lecture.pdf'`));
    expect((await visible(U.admin)).length).toBe(1);
  });

  it('a request keeps at most 5 attachments, as a list', async () => {
    const list = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ path: `${U.s1}/f${i}.pdf`, name: `f${i}.pdf`, size: 1, mime: 'application/pdf' })));
    await as(U.s1, () => db.exec(`insert into public.suggestions (kind, text, attachments) values ('questions', 'with files', '${list(5)}')`));
    await expect(as(U.s1, () => db.exec(`insert into public.suggestions (kind, text, attachments) values ('questions', 'too many', '${list(6)}')`))).rejects.toThrow(/check/i);
    await expect(as(U.s1, () => db.exec(`insert into public.suggestions (kind, text, attachments) values ('questions', 'not a list', '{"a":1}')`))).rejects.toThrow(/check/i);
    await db.exec("delete from public.suggestions where text = 'with files'"); // leave the table as other tests expect it
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

describe('request file upload limits', () => {
  const folder = (uid: string) => `${uid}/f`;
  const seed = (uid: string, count: number, hoursAgo: number) =>
    db.exec(`insert into storage.objects (bucket_id, name, owner, created_at) select 'request-files', '${folder(uid)}-${hoursAgo}-' || g || '.pdf', '${uid}', now() - interval '${hoursAgo} hours' from generate_series(1, ${count}) g`);
  const upload = (uid: string, name: string) => as(uid, () => db.exec(`insert into storage.objects (bucket_id, name, owner) values ('request-files', '${uid}/${name}', '${uid}')`));
  const clear = (uid: string) => db.exec(`delete from storage.objects where name like '${uid}/%'`);

  it('allows 30 uploads in 24 hours and refuses the 31st', async () => {
    await clear(U.s1);
    await seed(U.s1, 29, 1);
    await upload(U.s1, 'thirtieth.pdf');
    await expect(upload(U.s1, 'thirty-first.pdf')).rejects.toThrow(/row-level security/i);
    await clear(U.s1);
  });

  it('does not count uploads older than 24 hours, but stops at 100 in all', async () => {
    await clear(U.s1);
    await seed(U.s1, 90, 48); // old: not part of today's count
    await upload(U.s1, 'today.pdf'); // 91 in all
    await seed(U.s1, 8, 30); // 99 in all
    await upload(U.s1, 'hundredth.pdf');
    await expect(upload(U.s1, 'one-too-many.pdf')).rejects.toThrow(/row-level security/i);
    await clear(U.s1);
  });

  it('counts each student separately and refuses blocked ones', async () => {
    await seed(U.s1, 30, 1);
    await upload(U.s2, 'mine.pdf');
    await expect(upload(U.blocked, 'blocked.pdf')).rejects.toThrow(/row-level security/i);
    await clear(U.s1);
    await clear(U.s2);
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

describe('groups (admin site)', () => {
  const groupRow = async (uid: string, id: string) => (await as(uid, () => rows(`select name, invite_code, invite_enabled, ai_daily_limit from public.communities where id = '${id}'`)))[0];

  it('only admins create, change and delete groups', async () => {
    await as(U.admin, () => db.exec(`insert into public.communities (id, name, kind) values ('30000000-0000-0000-0000-00000000000a', 'Temp', 'course')`));
    for (const uid of [U.mod, U.s1]) {
      await expect(as(uid, () => db.exec(`insert into public.communities (name) values ('Sneaky')`))).rejects.toThrow(/row-level security|permission denied/i);
    }
    // Updates and deletes by others touch no rows
    await as(U.mod, () => db.exec(`update public.communities set ai_daily_limit = 999, invite_enabled = false where id = '${G1}'`));
    await as(U.mod, () => db.exec(`delete from public.communities where id = '${G1}'`));
    const g1 = await groupRow(U.admin, G1);
    expect(g1).toMatchObject({ name: 'Group 1', invite_enabled: true });
    expect(g1.ai_daily_limit).not.toBe(999);

    await as(U.admin, () => db.exec(`update public.communities set invite_enabled = false, ai_daily_limit = 7 where id = '${G2}'`));
    expect(await groupRow(U.admin, G2)).toMatchObject({ invite_enabled: false, ai_daily_limit: 7 });
    await as(U.admin, () => db.exec(`update public.communities set invite_enabled = true, ai_daily_limit = null where id = '${G2}'`));
    await as(U.admin, () => db.exec(`delete from public.communities where id = '30000000-0000-0000-0000-00000000000a'`));
    expect(await as(U.admin, () => rows(`select 1 from public.communities where id = '30000000-0000-0000-0000-00000000000a'`))).toHaveLength(0);
  });

  it('a moderator sees only their group and its members, and can remove only those', async () => {
    expect((await as(U.mod, () => rows('select id from public.communities'))).map((r) => r.id)).toEqual([G1]);
    expect((await as(U.mod, () => rows('select user_id from public.community_members'))).map((r) => r.user_id)).toEqual([U.s1]);

    await as(U.mod, () => db.exec(`delete from public.community_members where community_id = '${G2}' and user_id = '${U.s2}'`));
    expect(await as(U.admin, () => rows(`select 1 from public.community_members where community_id = '${G2}'`))).toHaveLength(1);

    await as(U.mod, () => db.exec(`delete from public.community_members where community_id = '${G1}' and user_id = '${U.s1}'`));
    expect(await as(U.admin, () => rows(`select 1 from public.community_members where community_id = '${G1}'`))).toHaveLength(0);
    await db.exec(`insert into public.community_members (community_id, user_id) values ('${G1}', '${U.s1}')`); // restore
  });

  it('a moderator cannot name moderators; admins can', async () => {
    await expect(as(U.mod, () => db.exec(`insert into public.community_moderators (community_id, user_id) values ('${G2}', '${U.mod}')`))).rejects.toThrow(/row-level security|permission denied/i);
    await as(U.admin, () => db.exec(`insert into public.community_moderators (community_id, user_id) values ('${G2}', '${U.mod}')`));
    expect((await as(U.mod, () => rows('select id from public.communities order by name'))).map((r) => r.id)).toEqual([G1, G2]);
    await db.exec(`delete from public.community_moderators where community_id = '${G2}' and user_id = '${U.mod}'`);
  });

  it('regenerate_invite: admins and the group moderator only, and the code really changes', async () => {
    const before = (await groupRow(U.admin, G1)).invite_code;
    const fresh = (await as(U.mod, () => rows(`select public.regenerate_invite('${G1}') as code`)))[0].code as string;
    expect(fresh).toMatch(/^[a-f0-9]{12}$/);
    expect(fresh).not.toBe(before);
    expect((await groupRow(U.admin, G1)).invite_code).toBe(fresh);

    await expect(as(U.mod, () => rows(`select public.regenerate_invite('${G2}')`))).rejects.toThrow(/forbidden/);
    await expect(as(U.s1, () => rows(`select public.regenerate_invite('${G1}')`))).rejects.toThrow(/forbidden|permission denied/i);
    await as(U.admin, () => rows(`select public.regenerate_invite('${G2}')`));
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
    await db.exec(`insert into public.events (user_id, type) values ('${U.s1}', 'app_open'), ('${U.s1}', 'got_content'), ('${U.s2}', 'app_open')`);
    const [{ d }] = await as(U.admin, () => rows('select public.admin_dashboard(14) as d'));
    expect(d.funnel).toMatchObject({ opened_app: 2, got_content: 1, first_answer: 0 });
    expect(d.funnel).not.toHaveProperty('subject_created'); // students no longer create subjects
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

describe('XP, daily challenge and duels', () => {
  const S3 = '00000000-0000-0000-0000-0000000000c3';
  const S4 = '00000000-0000-0000-0000-0000000000c4';
  const today = async () => (await rows('select public.tashkent_today()::text as d'))[0].d as string;
  const xp = async (uid: string) => (await as(uid, () => rows('select public.xp_of(auth.uid()) as x')))[0].x;

  beforeAll(async () => {
    await db.exec(`
      insert into auth.users (id, email) values ('${S3}', 's3@x'), ('${S4}', 's4@x');
      insert into public.profiles (id, telegram_id, first_name, role, blocked) values
        ('${S3}', 6, 'Student3', 'student', false), ('${S4}', 7, 'Student4', 'student', false);
      insert into public.community_members (community_id, user_id) values ('${G1}', '${S3}'), ('${G1}', '${S4}');
    `);
  });

  it('a challenge gives 20 XP per right answer, once a day, only for today', async () => {
    const d = await today();
    expect((await as(U.s1, () => rows('select public.submit_challenge($1::date, 4, 5) as p', [d])))[0].p).toBe(80);
    expect((await as(U.s1, () => rows('select public.submit_challenge($1::date, 5, 5) as p', [d])))[0].p).toBe(0);
    await expect(as(U.s1, () => rows("select public.submit_challenge('2000-01-01', 5, 5)"))).rejects.toThrow(/not today/);
    await expect(as(U.s1, () => rows('select public.submit_challenge($1::date, 6, 5)', [d]))).rejects.toThrow(/bad result/);
    expect(await xp(U.s1)).toBe(80);
  });

  it('students cannot write XP themselves and see only their own', async () => {
    await expect(as(U.s1, () => db.exec(`insert into public.xp_events (user_id, kind, ref, points) values ('${U.s1}', 'duel', 'x', 500)`))).rejects.toThrow();
    expect(await as(U.s1, () => rows('select * from public.xp_events'))).toHaveLength(1);
    expect(await as(S3, () => rows('select * from public.xp_events'))).toHaveLength(0);
  });

  it('a duel picks the group member with the closest XP and pays both players when finished', async () => {
    // S3 has 0 XP, S4 gets 60, s1 has 80: s1's closest rival is S4
    await as(S4, async () => rows('select public.submit_challenge($1::date, 3, 5)', [await today()]));
    const started = (await as(U.s1, () => rows(`select * from public.start_duel('${G1}', 'lib-q', array['a','b','c','d','e'])`)))[0];
    expect(started.opponent).toBe(S4);

    // the opponent sees it only after the challenger has played
    expect(await as(S4, () => rows('select * from public.my_duels()'))).toHaveLength(0);
    await as(U.s1, () => rows('select public.submit_duel($1, 4)', [started.id]));
    expect(await as(S4, () => rows('select i_challenged, my_score, their_score, their_name from public.my_duels()'))).toEqual([
      { i_challenged: false, my_score: null, their_score: 4, their_name: 'Student1' },
    ]);

    await as(S4, () => rows('select public.submit_duel($1, 2)', [started.id]));
    await expect(as(S4, () => rows('select public.submit_duel($1, 5)', [started.id]))).rejects.toThrow(/already played/);
    expect(await xp(U.s1)).toBe(130); // 80 + 50 for the win
    expect(await xp(S4)).toBe(70); // 60 + 10
  });

  it('only members of a group can start duels there, and outsiders cannot play them', async () => {
    await expect(as(U.s2, () => rows(`select * from public.start_duel('${G1}', 'k', array['a'])`))).rejects.toThrow(/not in this group/);
    const own = (await as(S3, () => rows(`select * from public.start_duel('${G1}', 'k', array['a'])`)))[0];
    await expect(as(U.s2, () => rows('select public.submit_duel($1, 1)', [own.id]))).rejects.toThrow(/not your duel/);
  });

  it('the group rating lists members with their XP, for members only', async () => {
    const top = await as(U.s1, () => rows(`select first_name, xp from public.group_leaderboard('${G1}')`));
    expect(top[0]).toEqual({ first_name: 'Student1', xp: 130 });
    expect(await as(U.s2, () => rows(`select * from public.group_leaderboard('${G1}')`))).toEqual([]);
  });
});

describe('AI on the board (admin bonus)', () => {
  const flag = async () => (await rows(`select board_ai from public.profiles where id = '${U.s1}'`))[0].board_ai;

  it('is off by default and a student cannot turn it on', async () => {
    expect(await flag()).toBe(false);
    await expect(as(U.s1, () => db.exec(`update public.profiles set board_ai = true where id = '${U.s1}'`))).rejects.toThrow(/permission denied/i);
    await expect(as(U.s1, () => rows(`select public.admin_set_board_ai('${U.s1}', true)`))).rejects.toThrow(/forbidden/);
    await expect(as(U.mod, () => rows(`select public.admin_set_board_ai('${U.s1}', true)`))).rejects.toThrow(/forbidden/);
    expect(await flag()).toBe(false);
  });

  it('the admin turns it on and off, and it is written to the audit log', async () => {
    await as(U.admin, () => rows(`select public.admin_set_board_ai('${U.s1}', true)`));
    expect(await flag()).toBe(true);
    await as(U.admin, () => rows(`select public.admin_set_board_ai('${U.s1}', false)`));
    expect(await flag()).toBe(false);
    const log = await rows(`select details from public.audit_log where target_id = '${U.s1}' and details ? 'board_ai' order by id`);
    expect(log.map((r) => r.details.board_ai)).toEqual([true, false]);
  });
});
