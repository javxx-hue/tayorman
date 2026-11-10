-- Per-student test progress: one small row per (student, test set), data = { questionId: QStat }.
-- Kept apart from study_sets so an answer never rewrites a whole set of hundreds of questions.
create table public.quiz_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_key text not null check (char_length(set_key) <= 100),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, set_key)
);
alter table public.quiz_progress enable row level security;

create policy "quiz_progress: own rows" on public.quiz_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Hardest questions of one group, for the admin site. Totals only: no student is named.
create function public.group_hard_questions(p_community uuid, p_limit int default 20)
returns table (set_key text, question_id text, students bigint, answers bigint, wrong bigint)
language sql stable
security definer set search_path = ''
as $$
  select p.set_key, q.key, count(*), sum((q.value ->> 'seen')::int), sum((q.value ->> 'wrong')::int)
  from public.quiz_progress p
  join public.community_members m on m.user_id = p.user_id and m.community_id = p_community
  cross join lateral jsonb_each(p.data) q
  where public.is_admin() or public.moderates(p_community)
  group by p.set_key, q.key
  having count(*) >= 2
  order by sum((q.value ->> 'wrong')::int)::numeric / nullif(sum((q.value ->> 'seen')::int), 0) desc nulls last, count(*) desc
  limit least(greatest(p_limit, 1), 100);
$$;
revoke execute on function public.group_hard_questions(uuid, int) from public, anon;
grant execute on function public.group_hard_questions(uuid, int) to authenticated, service_role;
