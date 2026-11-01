-- 0005: the dashboard funnel for a product where students do not create content.
-- Old steps "subject_created" and "questions_added" no longer happen; the new step is
-- "got_content": the first subject or test the admin published reached the student.
-- Run in Supabase: SQL Editor -> paste -> Run (after 0004).

create or replace function public.admin_dashboard(p_days int default 14)
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
      'got_content', (select count(distinct user_id) from public.events where type = 'got_content' and created_at > since),
      'first_answer', (select count(distinct user_id) from public.events where type = 'first_answer' and created_at > since)
    ),
    'open_suggestions', (select count(*) from public.suggestions where status = 'new'),
    'open_reports', (select count(*) from public.issue_reports where status = 'open')
  );
end;
$$;
revoke execute on function public.admin_dashboard(int) from public, anon;
grant execute on function public.admin_dashboard(int) to authenticated;
