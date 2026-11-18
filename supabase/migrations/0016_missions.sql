-- Stajyor missiyalari: 40 XP for each finished mission, once. The xp_events row (kind 'mission', ref 'story:N')
-- is also the student's progress, so the same missions show as done on the phone and on the computer.

alter table public.xp_events drop constraint xp_events_kind_check;
alter table public.xp_events add constraint xp_events_kind_check check (kind in ('challenge', 'duel', 'mission'));

create function public.submit_mission(p_story text, p_mission int)
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  awarded int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.not_blocked() then raise exception 'blocked'; end if;
  if p_story not in ('baza', 'tarmoq', 'elektronika', 'algebra') or p_mission not between 1 and 5 then raise exception 'bad mission'; end if;
  -- the missions are a story: one opens after the other
  if p_mission > 1 and not exists (
    select 1 from public.xp_events where user_id = auth.uid() and kind = 'mission' and ref = p_story || ':' || (p_mission - 1)
  ) then
    raise exception 'previous mission first';
  end if;
  insert into public.xp_events (user_id, kind, ref, points)
  values (auth.uid(), 'mission', p_story || ':' || p_mission, 40)
  on conflict (user_id, kind, ref) do nothing
  returning points into awarded;
  return coalesce(awarded, 0);
end;
$$;

revoke execute on function public.submit_mission(text, int) from public, anon;
grant execute on function public.submit_mission(text, int) to authenticated, service_role;
