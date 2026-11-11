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

-- A blocked user is cut off here too (see migration 0008)
create policy "blocked users: no access" on public.quiz_progress as restrictive for all to authenticated
  using ((select public.not_blocked())) with check ((select public.not_blocked()));
