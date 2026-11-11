-- Duels change live on the players' screens: a new duel or the other player's answer shows up without reopening the app.
-- Realtime still applies the table's row rules, so each player hears only about their own duels.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duels') then
    alter publication supabase_realtime add table public.duels;
  end if;
end $$;
