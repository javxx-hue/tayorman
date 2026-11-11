-- XP for the daily challenge and duels, and duels between students of one group.
-- XP is a ledger: one row per earned prize, unique per (user, kind, ref), so nothing is counted twice.
-- Students never write these tables directly; only the functions below do, after checking who is asking.

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('challenge', 'duel')),
  ref text not null check (char_length(ref) <= 100),
  points int not null check (points between 0 and 500),
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);
alter table public.xp_events enable row level security;
create policy "xp_events: own rows" on public.xp_events for select using (auth.uid() = user_id);

-- A duel is played in turns: the challenger answers first, the opponent within 24 hours, on the same questions
create table public.duels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  challenger uuid not null references auth.users (id) on delete cascade,
  opponent uuid not null references auth.users (id) on delete cascade,
  set_key text not null check (char_length(set_key) <= 100),
  question_ids text[] not null check (array_length(question_ids, 1) between 1 and 10),
  challenger_score int check (challenger_score >= 0),
  opponent_score int check (opponent_score >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check (challenger <> opponent)
);
create index duels_challenger_idx on public.duels (challenger, created_at desc);
create index duels_opponent_idx on public.duels (opponent, created_at desc);
alter table public.duels enable row level security;
create policy "duels: players read" on public.duels for select using (auth.uid() in (challenger, opponent));

-- A blocked user is cut off here too (see migration 0008)
create policy "blocked users: no access" on public.xp_events as restrictive for all to authenticated
  using ((select public.not_blocked())) with check ((select public.not_blocked()));
create policy "blocked users: no access" on public.duels as restrictive for all to authenticated
  using ((select public.not_blocked())) with check ((select public.not_blocked()));

-- Total XP of one person
create function public.xp_of(p_user uuid)
returns int
language sql stable
security definer set search_path = ''
as $$
  select coalesce(sum(points), 0)::int from public.xp_events where user_id = p_user;
$$;

create function public.in_community(p_community uuid)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.community_members where community_id = p_community and user_id = auth.uid());
$$;

-- The day in Tashkent: a challenge belongs to the student's own calendar day
create function public.tashkent_today()
returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Tashkent')::date;
$$;

-- Today's challenge result: 20 XP for each right answer (XP x2), once a day
create function public.submit_challenge(p_day date, p_correct int, p_total int)
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  awarded int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_day <> public.tashkent_today() then raise exception 'not today'; end if;
  if p_total not between 1 and 10 or p_correct not between 0 and p_total then raise exception 'bad result'; end if;
  insert into public.xp_events (user_id, kind, ref, points)
  values (auth.uid(), 'challenge', p_day::text, p_correct * 20)
  on conflict (user_id, kind, ref) do nothing
  returning points into awarded;
  return coalesce(awarded, 0);
end;
$$;

-- Starts a duel against the group member whose XP is closest to the caller's (a random one among equals)
create function public.start_duel(p_community uuid, p_set_key text, p_questions text[])
returns public.duels
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mine int;
  rival uuid;
  started public.duels;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not public.in_community(p_community) then raise exception 'not in this group'; end if;
  if (select count(*) from public.duels where challenger = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many duels today';
  end if;
  mine := public.xp_of(me);
  select m.user_id into rival
  from public.community_members m
  join public.profiles p on p.id = m.user_id
  where m.community_id = p_community
    and m.user_id <> me
    and not p.blocked
    and p.role = 'student'
    -- not someone who still owes this caller an answer
    and not exists (
      select 1 from public.duels d
      where d.challenger = me and d.opponent = m.user_id and d.opponent_score is null and d.created_at > now() - interval '1 day'
    )
  order by abs(public.xp_of(m.user_id) - mine), random()
  limit 1;
  if rival is null then raise exception 'no opponent'; end if;
  insert into public.duels (community_id, challenger, opponent, set_key, question_ids)
  values (p_community, me, rival, p_set_key, p_questions)
  returning * into started;
  return started;
end;
$$;

-- A player's result. When both have played: 50 XP for the winner, 10 for the other, 25 each for a draw.
create function public.submit_duel(p_duel uuid, p_correct int)
returns public.duels
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  d public.duels;
begin
  select * into d from public.duels where id = p_duel for update;
  if d.id is null or me not in (d.challenger, d.opponent) then raise exception 'not your duel'; end if;
  if p_correct not between 0 and array_length(d.question_ids, 1) then raise exception 'bad result'; end if;

  if me = d.challenger and d.challenger_score is null then
    update public.duels set challenger_score = p_correct where id = p_duel returning * into d;
  elsif me = d.opponent and d.opponent_score is null and d.challenger_score is not null and d.created_at > now() - interval '1 day' then
    update public.duels set opponent_score = p_correct, finished_at = now() where id = p_duel returning * into d;
    insert into public.xp_events (user_id, kind, ref, points) values
      (d.challenger, 'duel', d.id::text, case when d.challenger_score > d.opponent_score then 50 when d.challenger_score = d.opponent_score then 25 else 10 end),
      (d.opponent, 'duel', d.id::text, case when d.opponent_score > d.challenger_score then 50 when d.opponent_score = d.challenger_score then 25 else 10 end)
    on conflict (user_id, kind, ref) do nothing;
  else
    raise exception 'already played or expired';
  end if;
  return d;
end;
$$;

-- An opponent who did not answer within 24 hours: the challenger gets 25 XP for it
create function public.settle_expired_duels()
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  n int;
begin
  if auth.uid() is null then return 0; end if;
  with expired as (
    select id from public.duels
    where challenger = auth.uid() and challenger_score is not null and opponent_score is null and created_at <= now() - interval '1 day'
  )
  insert into public.xp_events (user_id, kind, ref, points)
  select auth.uid(), 'duel', id::text, 25 from expired
  on conflict (user_id, kind, ref) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- The caller's duels with the other player's first name, newest first
create function public.my_duels()
returns table (
  id uuid, community_id uuid, set_key text, question_ids text[], created_at timestamptz, finished_at timestamptz,
  i_challenged boolean, my_score int, their_score int, their_name text
)
language sql stable
security definer set search_path = ''
as $$
  select d.id, d.community_id, d.set_key, d.question_ids, d.created_at, d.finished_at,
    d.challenger = auth.uid(),
    case when d.challenger = auth.uid() then d.challenger_score else d.opponent_score end,
    case when d.challenger = auth.uid() then d.opponent_score else d.challenger_score end,
    coalesce(p.first_name, 'Talaba')
  from public.duels d
  join public.profiles p on p.id = case when d.challenger = auth.uid() then d.opponent else d.challenger end
  where auth.uid() in (d.challenger, d.opponent)
    and d.created_at > now() - interval '14 days'
    -- an opponent sees a duel only after the challenger has played it
    and (d.challenger = auth.uid() or d.challenger_score is not null)
  order by d.created_at desc
  limit 50;
$$;

-- XP of a group's members over the last days, for the group's rating (first names only)
create function public.group_leaderboard(p_community uuid, p_days int default 7)
returns table (user_id uuid, first_name text, xp int)
language sql stable
security definer set search_path = ''
as $$
  select m.user_id, coalesce(p.first_name, 'Talaba'), coalesce(sum(x.points), 0)::int
  from public.community_members m
  join public.profiles p on p.id = m.user_id and p.role = 'student' and not p.blocked
  left join public.xp_events x on x.user_id = m.user_id and x.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
  where m.community_id = p_community
    and (public.in_community(p_community) or public.is_staff())
  group by m.user_id, p.first_name
  order by 3 desc, 2
  limit 20;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.xp_of(uuid)', 'public.in_community(uuid)', 'public.tashkent_today()', 'public.submit_challenge(date, int, int)',
    'public.start_duel(uuid, text, text[])', 'public.submit_duel(uuid, int)', 'public.settle_expired_duels()',
    'public.my_duels()', 'public.group_leaderboard(uuid, int)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
