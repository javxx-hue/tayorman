-- 0002: admin web panel, assignments, suggestions, audit, limits, moderators.
-- (Admin web sign-in uses the Telegram Login Widget, verified by the Edge Function: no tables needed.)
-- Additive on top of 0001: safe to run once on the live database.
-- Run in Supabase: SQL Editor -> paste -> Run.

-- ---------------------------------------------------------------
-- Roles, blocking, limits
-- ---------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'moderator', 'admin'));
alter table public.profiles add column if not exists blocked boolean not null default false;
alter table public.profiles add column if not exists ai_daily_limit int check (ai_daily_limit is null or ai_daily_limit between 0 and 1000);

alter table public.communities add column if not exists ai_daily_limit int check (ai_daily_limit is null or ai_daily_limit between 0 and 1000);
alter table public.communities add column if not exists invite_enabled boolean not null default true;

create table public.community_moderators (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (community_id, user_id)
);
alter table public.community_moderators enable row level security;

-- A blocked user is never staff, whatever their role says
create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not blocked);
$$;

create function public.is_staff()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator') and not blocked);
$$;

create function public.moderates(c uuid)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select public.is_staff() and exists (
    select 1 from public.community_moderators m where m.community_id = c and m.user_id = auth.uid()
  );
$$;

-- true when the caller moderates EVERY community in the list (and the list is not empty)
create function public.moderates_all(cs uuid[])
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select coalesce(array_length(cs, 1), 0) > 0
    and not exists (select 1 from unnest(cs) c where not public.moderates(c));
$$;

create function public.moderates_user(u uuid)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select public.is_staff() and exists (
    select 1
    from public.community_members m
    join public.community_moderators cm on cm.community_id = m.community_id and cm.user_id = auth.uid()
    where m.user_id = u
  );
$$;

create policy "moderators: read own or admin" on public.community_moderators
  for select using (user_id = auth.uid() or public.is_admin());
create policy "moderators: admin write" on public.community_moderators
  for all using (public.is_admin()) with check (public.is_admin());

-- moderators see their groups and members; admins manage membership
create policy "communities: moderator read" on public.communities
  for select using (public.moderates(id));
create policy "community_members: moderator read" on public.community_members
  for select using (public.moderates(community_id));
create policy "community_members: moderator remove" on public.community_members
  for delete using (public.moderates(community_id));
create policy "community_members: admin insert" on public.community_members
  for insert with check (public.is_admin());
create policy "profiles: moderator reads group members" on public.profiles
  for select using (public.moderates_user(id));
create policy "library: staff read published" on public.library_items
  for select using (public.is_staff() and published);

-- ---------------------------------------------------------------
-- Settings (global AI limit, ...)
-- ---------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.app_settings enable row level security;
create policy "settings: admin all" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());
insert into public.app_settings (key, value) values ('ai_daily_limit', '30') on conflict do nothing;

-- user override > highest group limit > global setting > 30
create function public.effective_ai_limit(p_user uuid)
returns int
language sql stable
security definer set search_path = ''
as $$
  select coalesce(
    (select ai_daily_limit from public.profiles where id = p_user),
    (select max(c.ai_daily_limit) from public.community_members m
       join public.communities c on c.id = m.community_id
       where m.user_id = p_user and c.ai_daily_limit is not null),
    (select (value #>> '{}')::int from public.app_settings where key = 'ai_daily_limit'),
    30
  );
$$;
revoke execute on function public.effective_ai_limit(uuid) from public, anon, authenticated;

-- Counts one request and answers whether it is allowed. Blocked users never are.
create function public.consume_ai_quota_auto(p_user uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_blocked boolean;
  used int;
begin
  select blocked into v_blocked from public.profiles where id = p_user;
  if v_blocked is null or v_blocked then
    return false;
  end if;
  insert into public.ai_usage (user_id, day, count)
  values (p_user, (now() at time zone 'Asia/Tashkent')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into used;
  return used <= public.effective_ai_limit(p_user);
end;
$$;
revoke execute on function public.consume_ai_quota_auto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Audit log: filled by triggers, nobody writes it directly
-- ---------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id) on delete set null,
  actor_name text,
  action text not null,
  target_table text,
  target_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
create policy "audit: admin read" on public.audit_log for select using (public.is_admin());

create function public.audit_row()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
  who text;
begin
  -- service role (Edge Functions) has no auth.uid(): those actions are logged by the functions
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  select coalesce(first_name, username, 'user') into who from public.profiles where id = auth.uid();
  insert into public.audit_log (actor, actor_name, action, target_table, target_id, details)
  values (
    auth.uid(), who, lower(tg_op), tg_table_name,
    coalesce(r ->> 'id', r ->> 'key', r ->> 'community_id'),
    r - 'data' - 'text' - 'admin_reply'
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_communities after insert or update or delete on public.communities
  for each row execute function public.audit_row();
create trigger audit_members after delete on public.community_members
  for each row execute function public.audit_row();
create trigger audit_moderators after insert or delete on public.community_moderators
  for each row execute function public.audit_row();
create trigger audit_library after insert or update or delete on public.library_items
  for each row execute function public.audit_row();
create trigger audit_settings after insert or update or delete on public.app_settings
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------
-- Assignments (topshiriq): library content + groups + deadline
-- ---------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  note text check (char_length(note) <= 2000),
  library_item_id uuid not null references public.library_items (id) on delete cascade,
  audience_all boolean not null default false,
  community_ids uuid[] not null default '{}',
  due_at timestamptz,
  status text not null default 'active' check (status in ('active', 'archived')),
  notify boolean not null default true,
  notified_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (audience_all or coalesce(array_length(community_ids, 1), 0) > 0)
);
create index assignments_created_idx on public.assignments (created_at desc);
alter table public.assignments enable row level security;

create function public.in_audience(p_all boolean, p_communities uuid[])
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select p_all or exists (
    select 1 from public.community_members m
    where m.user_id = auth.uid() and m.community_id = any (p_communities)
  );
$$;

create policy "assignments: read" on public.assignments
  for select using (
    public.is_admin()
    or public.moderates_all(community_ids)
    or (status = 'active' and public.in_audience(audience_all, community_ids))
  );
create policy "assignments: admin write" on public.assignments
  for all using (public.is_admin()) with check (public.is_admin());
create policy "assignments: moderator create" on public.assignments
  for insert with check (not audience_all and public.moderates_all(community_ids) and created_by = auth.uid());
create policy "assignments: moderator manage own" on public.assignments
  for update using (public.moderates_all(community_ids) and created_by = auth.uid())
  with check (not audience_all and public.moderates_all(community_ids) and created_by = auth.uid());
create policy "assignments: moderator delete own" on public.assignments
  for delete using (public.moderates_all(community_ids) and created_by = auth.uid());

create trigger audit_assignments after insert or update or delete on public.assignments
  for each row execute function public.audit_row();

create function public.moderates_assignment(a uuid)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.assignments x where x.id = a and public.moderates_all(x.community_ids));
$$;

create table public.assignment_progress (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'done')),
  score int check (score is null or score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (assignment_id, user_id)
);
alter table public.assignment_progress enable row level security;
create policy "progress: own rows" on public.assignment_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progress: staff read" on public.assignment_progress
  for select using (public.is_admin() or public.moderates_assignment(assignment_id));

create function public.assignment_stats(p_assignment uuid)
returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  a public.assignments;
begin
  select * into a from public.assignments where id = p_assignment;
  if not found then
    raise exception 'not found';
  end if;
  if not (public.is_admin() or public.moderates_assignment(p_assignment)) then
    raise exception 'forbidden';
  end if;
  return (
    with audience as (
      select p.id as user_id from public.profiles p where a.audience_all and not p.blocked
      union
      select m.user_id from public.community_members m where m.community_id = any (a.community_ids)
    ), prog as (
      select ap.* from public.assignment_progress ap
      join audience au on au.user_id = ap.user_id
      where ap.assignment_id = p_assignment
    )
    select jsonb_build_object(
      'audience', (select count(*) from audience),
      'started', (select count(*) from prog),
      'done', (select count(*) from prog where status = 'done'),
      'avg_score', (select round(avg(score)) from prog where status = 'done' and score is not null),
      'by_community', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', c.name,
          'members', (select count(*) from public.community_members m where m.community_id = c.id),
          'done', (select count(*) from prog pr
                   join public.community_members m2 on m2.user_id = pr.user_id and m2.community_id = c.id
                   where pr.status = 'done')
        ) order by c.name)
        from public.communities c where c.id = any (a.community_ids)
      ), '[]'::jsonb)
    )
  );
end;
$$;
revoke execute on function public.assignment_stats(uuid) from public, anon;
grant execute on function public.assignment_stats(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Suggestions inbox and issue reports
-- ---------------------------------------------------------------
create table public.suggestions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('new_subject', 'questions', 'bug', 'other')),
  text text not null check (char_length(text) between 3 and 4000),
  status text not null default 'new' check (status in ('new', 'seen', 'accepted', 'declined')),
  admin_reply text check (char_length(admin_reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index suggestions_status_idx on public.suggestions (status, created_at desc);
alter table public.suggestions enable row level security;
create policy "suggestions: insert own" on public.suggestions for insert with check (user_id = auth.uid());
create policy "suggestions: read own or admin" on public.suggestions for select using (user_id = auth.uid() or public.is_admin());
create policy "suggestions: admin update" on public.suggestions for update using (public.is_admin()) with check (public.is_admin());

create table public.issue_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  library_item_id uuid references public.library_items (id) on delete set null,
  context text check (char_length(context) <= 300),
  question_text text check (char_length(question_text) <= 1000),
  note text check (char_length(note) <= 1000),
  status text not null default 'open' check (status in ('open', 'fixed', 'dismissed')),
  created_at timestamptz not null default now()
);
alter table public.issue_reports enable row level security;
create policy "reports: insert own" on public.issue_reports for insert with check (user_id = auth.uid());
create policy "reports: read own or admin" on public.issue_reports for select using (user_id = auth.uid() or public.is_admin());
create policy "reports: admin update" on public.issue_reports for update using (public.is_admin()) with check (public.is_admin());

-- Abuse guard: a student can send at most 10 suggestions / 20 reports per day
create function public.limit_daily_inserts()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  max_per_day int := tg_argv[0]::int;
  n int;
begin
  execute format('select count(*) from public.%I where user_id = $1 and created_at > now() - interval ''1 day''', tg_table_name)
    into n using new.user_id;
  if n >= max_per_day then
    raise exception 'daily limit reached';
  end if;
  return new;
end;
$$;
create trigger suggestions_daily_limit before insert on public.suggestions
  for each row execute function public.limit_daily_inserts(10);
create trigger reports_daily_limit before insert on public.issue_reports
  for each row execute function public.limit_daily_inserts(20);

create trigger audit_suggestions after update on public.suggestions
  for each row execute function public.audit_row();
create trigger audit_reports after update on public.issue_reports
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------
-- Scheduled broadcasts
-- ---------------------------------------------------------------
alter table public.broadcasts add column if not exists scheduled_at timestamptz;
alter table public.broadcasts add column if not exists sent_at timestamptz;
alter table public.broadcasts add column if not exists total_count int not null default 0;
alter table public.broadcasts add column if not exists status text not null default 'sent'
  check (status in ('scheduled', 'sending', 'sent', 'cancelled'));
create policy "broadcasts: admin update" on public.broadcasts
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Admin functions
-- ---------------------------------------------------------------
-- 'admin' itself comes only from the ADMIN_TELEGRAM_IDS secret, never from the panel
create function public.admin_set_user(
  p_user uuid,
  p_blocked boolean default null,
  p_role text default null,
  p_ai_limit int default null,
  p_clear_ai_limit boolean default false
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_old public.profiles;
  who text;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  select * into v_old from public.profiles where id = p_user;
  if not found then
    raise exception 'user not found';
  end if;
  if p_user = auth.uid() and (coalesce(p_blocked, false) or (p_role is not null and p_role <> 'admin')) then
    raise exception 'cannot lock yourself out';
  end if;
  if p_role is not null and p_role not in ('student', 'moderator') then
    raise exception 'admin role is set through ADMIN_TELEGRAM_IDS';
  end if;
  if v_old.role = 'admin' and p_role is not null then
    raise exception 'admin role is set through ADMIN_TELEGRAM_IDS';
  end if;

  update public.profiles set
    blocked = coalesce(p_blocked, blocked),
    role = coalesce(p_role, role),
    ai_daily_limit = case when p_clear_ai_limit then null else coalesce(p_ai_limit, ai_daily_limit) end
  where id = p_user;

  select coalesce(first_name, username, 'admin') into who from public.profiles where id = auth.uid();
  insert into public.audit_log (actor, actor_name, action, target_table, target_id, details)
  values (auth.uid(), who, 'update', 'profiles', p_user::text, jsonb_strip_nulls(jsonb_build_object(
    'telegram_id', v_old.telegram_id, 'blocked', p_blocked, 'role', p_role,
    'ai_daily_limit', p_ai_limit, 'ai_limit_cleared', nullif(p_clear_ai_limit, false)
  )));
end;
$$;
revoke execute on function public.admin_set_user(uuid, boolean, text, int, boolean) from public, anon;
grant execute on function public.admin_set_user(uuid, boolean, text, int, boolean) to authenticated;

create function public.regenerate_invite(p_community uuid)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  code text := encode(extensions.gen_random_bytes(6), 'hex');
begin
  if not (public.is_admin() or public.moderates(p_community)) then
    raise exception 'forbidden';
  end if;
  update public.communities set invite_code = code where id = p_community;
  return code;
end;
$$;
revoke execute on function public.regenerate_invite(uuid) from public, anon;
grant execute on function public.regenerate_invite(uuid) to authenticated;

-- Users list with search; moderators only see members of their own groups
create function public.admin_users(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, telegram_id bigint, first_name text, last_name text, username text, university text,
  role text, blocked boolean, ai_daily_limit int, last_seen_at timestamptz, created_at timestamptz,
  ai_today int, groups text[], total bigint
)
language plpgsql stable
security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Tashkent')::date;
  q text := nullif(trim(p_search), '');
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  return query
  with visible as (
    select p.* from public.profiles p
    where (public.is_admin() or public.moderates_user(p.id))
      and (q is null
        or p.first_name ilike '%' || q || '%'
        or p.last_name ilike '%' || q || '%'
        or p.username ilike '%' || q || '%'
        or p.telegram_id::text = q)
  )
  select v.id, v.telegram_id, v.first_name, v.last_name, v.username, v.university,
         v.role, v.blocked, v.ai_daily_limit, v.last_seen_at, v.created_at,
         coalesce((select u.count from public.ai_usage u where u.user_id = v.id and u.day = today), 0),
         coalesce((select array_agg(c.name order by c.name) from public.community_members m
                   join public.communities c on c.id = m.community_id where m.user_id = v.id), '{}'),
         (select count(*) from visible)
  from visible v
  order by v.last_seen_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;
revoke execute on function public.admin_users(text, int, int) from public, anon;
grant execute on function public.admin_users(text, int, int) to authenticated;

-- ---------------------------------------------------------------
-- Dashboard numbers
-- ---------------------------------------------------------------
create index events_type_created_idx on public.events (type, created_at);

create function public.admin_dashboard(p_days int default 14)
returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  days int := least(greatest(p_days, 1), 90);
  since timestamptz := now() - make_interval(days => days);
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'dau', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'users', n) order by d)
      from (
        select (e.created_at at time zone 'Asia/Tashkent')::date d, count(distinct e.user_id) n
        from public.events e where e.type = 'app_open' and e.created_at > since group by 1
      ) t), '[]'),
    'new_users', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d)
      from (
        select (p.created_at at time zone 'Asia/Tashkent')::date d, count(*) n
        from public.profiles p where p.created_at > since group by 1
      ) t), '[]'),
    'ai_per_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'n', n) order by day)
      from (select u.day, sum(u.count) n from public.ai_usage u where u.day > (since at time zone 'Asia/Tashkent')::date group by 1) t), '[]'),
    'funnel', jsonb_build_object(
      'registered', (select count(*) from public.profiles where created_at > since),
      'opened_app', (select count(distinct user_id) from public.events where type = 'app_open' and created_at > since),
      'subject_created', (select count(distinct user_id) from public.events where type = 'subject_created' and created_at > since),
      'questions_added', (select count(distinct user_id) from public.events where type = 'questions_added' and created_at > since),
      'first_answer', (select count(distinct user_id) from public.events where type = 'first_answer' and created_at > since)
    ),
    'open_suggestions', (select count(*) from public.suggestions where status = 'new'),
    'open_reports', (select count(*) from public.issue_reports where status = 'open')
  );
end;
$$;
revoke execute on function public.admin_dashboard(int) from public, anon;
grant execute on function public.admin_dashboard(int) to authenticated;

-- Questions students fail most (needs at least 3 graded attempts)
create function public.admin_hard_questions(p_limit int default 20)
returns table (subject text, question text, attempts bigint, avg_score numeric)
language plpgsql stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
  select s.data ->> 'name', q ->> 'text', count(*), round(avg((a ->> 'score')::numeric), 0)
  from public.subjects s
  cross join lateral jsonb_array_elements(coalesce(s.data -> 'questions', '[]'::jsonb)) q
  cross join lateral jsonb_array_elements(coalesce(q -> 'attempts', '[]'::jsonb)) a
  where a ->> 'score' is not null
  group by 1, 2
  having count(*) >= 3
  order by 4 asc, 3 desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;
revoke execute on function public.admin_hard_questions(int) from public, anon;
grant execute on function public.admin_hard_questions(int) to authenticated;
