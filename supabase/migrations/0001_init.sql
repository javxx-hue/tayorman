-- Sessiyaga tayyorlan schema. Run in Supabase: SQL Editor -> paste -> Run (or `supabase db push`).
-- Users sign in only through Telegram (Edge Function "telegram-auth"), which
-- creates one auth user per Telegram account.

-- ---------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  telegram_id bigint not null unique, -- also the private chat id for the bot
  first_name text,
  last_name text,
  username text,
  language text not null default 'uz' check (language in ('uz', 'ru')),
  university text, -- 'samdu' or free text for other universities
  role text not null default 'student' check (role in ('student', 'admin')),
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function public.is_admin()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "profiles: read own or admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- Students may change only their own settings, never role or telegram_id
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.profiles from authenticated;
grant update (language, university, reminders_enabled, last_seen_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------
-- Personal documents (same JSON the app keeps locally), per user
-- ---------------------------------------------------------------
create table public.study_sets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) <= 100),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.subjects (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) <= 100),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.study_sets enable row level security;
alter table public.subjects enable row level security;

create policy "study_sets: own rows" on public.study_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subjects: own rows" on public.subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Communities: groups / faculties / universities the admin creates.
-- Students join through t.me/<bot>?start=c_<invite_code>
-- ---------------------------------------------------------------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'group' check (kind in ('university', 'faculty', 'course', 'group', 'other')),
  invite_code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.communities enable row level security;
alter table public.community_members enable row level security;

create policy "communities: members read, admin all" on public.communities
  for select using (
    public.is_admin()
    or exists (select 1 from public.community_members m where m.community_id = communities.id and m.user_id = auth.uid())
  );
create policy "communities: admin write" on public.communities
  for all using (public.is_admin()) with check (public.is_admin());

create policy "community_members: read own or admin" on public.community_members
  for select using (user_id = auth.uid() or public.is_admin());
create policy "community_members: leave own" on public.community_members
  for delete using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------
-- Library: subjects and study sets the admin publishes to an audience
-- ---------------------------------------------------------------
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('subject', 'set')),
  source_id text not null, -- id of the admin's own subject/set it was published from
  title text not null check (char_length(title) <= 300),
  data jsonb not null,
  audience_all boolean not null default true,
  community_ids uuid[] not null default '{}',
  published boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, source_id)
);

alter table public.library_items enable row level security;

create policy "library: visible to audience" on public.library_items
  for select using (
    public.is_admin()
    or (published and (
      audience_all
      or exists (
        select 1 from public.community_members m
        where m.user_id = auth.uid() and m.community_id = any (community_ids)
      )
    ))
  );
create policy "library: admin write" on public.library_items
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Broadcast log (sending happens in the Edge Function "admin-broadcast")
-- ---------------------------------------------------------------
create table public.broadcasts (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) <= 4000),
  audience_all boolean not null default true,
  community_ids uuid[] not null default '{}',
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.broadcasts enable row level security;
create policy "broadcasts: admin read" on public.broadcasts for select using (public.is_admin());

-- ---------------------------------------------------------------
-- Usage events for the admin dashboard (no message contents)
-- ---------------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (char_length(type) <= 40),
  created_at timestamptz not null default now()
);

create index events_created_idx on public.events (created_at);

alter table public.events enable row level security;
create policy "events: insert own" on public.events for insert with check (user_id = auth.uid());
create policy "events: admin read" on public.events for select using (public.is_admin());

-- ---------------------------------------------------------------
-- AI usage per user per day (Tashkent day), limit set by the Edge Functions
-- ---------------------------------------------------------------
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
create policy "ai_usage: read own or admin" on public.ai_usage
  for select using (auth.uid() = user_id or public.is_admin());

-- Counts one request for the given user; false when the limit is used up.
-- Called by Edge Functions only (service role), so it takes the user id.
create function public.consume_ai_quota(p_user uuid, daily_limit int)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  used int;
begin
  insert into public.ai_usage (user_id, day, count)
  values (p_user, (now() at time zone 'Asia/Tashkent')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into used;
  return used <= daily_limit;
end;
$$;

revoke execute on function public.consume_ai_quota(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Bot conversation state: a file waiting for "which subject?",
-- or a question waiting for a voice answer
-- ---------------------------------------------------------------
create table public.bot_pending (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kind text not null check (kind in ('material', 'voice_answer')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.bot_pending enable row level security;
-- no policies: only the Edge Functions (service role) use it

-- ---------------------------------------------------------------
-- Admin dashboard numbers in one call
-- ---------------------------------------------------------------
create function public.admin_stats()
returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Tashkent')::date;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_samdu', (select count(*) from public.profiles where university = 'samdu'),
    'users_new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_today', (select count(*) from public.profiles where (last_seen_at at time zone 'Asia/Tashkent')::date = today),
    'active_7d', (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'ai_today', (select coalesce(sum(count), 0) from public.ai_usage where day = today),
    'ai_7d', (select coalesce(sum(count), 0) from public.ai_usage where day > today - 7),
    'subjects_total', (select count(*) from public.subjects),
    'library_items', (select count(*) from public.library_items where published),
    'by_university', (
      select coalesce(jsonb_object_agg(coalesce(university, '-'), n), '{}'::jsonb)
      from (select university, count(*) n from public.profiles group by university) t
    ),
    'by_community', (
      select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'members', (
        select count(*) from public.community_members m where m.community_id = c.id
      )) order by c.name), '[]'::jsonb)
      from public.communities c
    )
  );
end;
$$;

revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
