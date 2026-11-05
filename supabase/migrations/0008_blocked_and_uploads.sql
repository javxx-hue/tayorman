-- Two gaps found in the audit.
--
-- 1. Blocking was only enforced by the Edge Functions (AI, requests, sign-in). Someone blocked while signed in kept
--    reading and writing their own data through the API until their session ended. Now a blocked user is cut off
--    in the database itself: their sessions are deleted the moment they are blocked, and a restrictive policy on every
--    table the app uses (and on the request-files bucket) refuses whatever a still-valid access token tries.
-- 2. A student could upload any number of files straight into their own storage folder; the daily request limit
--    only counts requests, not uploads. Now at most 30 uploads per 24 hours and 100 in all.
--
-- Run after 0007. Restrictive policies are AND-ed with the existing ones, so nothing else changes.

create function public.not_blocked()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select not coalesce((select blocked from public.profiles where id = auth.uid()), false);
$$;
revoke execute on function public.not_blocked() from public, anon;
grant execute on function public.not_blocked() to authenticated;

-- Every table a signed-in user can reach. (admin_credentials, admin_login_requests and bot_pending are closed to
-- everyone but the server.) A test keeps this list complete when a table is added.
do $$
declare
  t text;
begin
  foreach t in array array[
    'ai_usage', 'app_settings', 'assignment_progress', 'assignments', 'audit_log', 'broadcasts', 'communities',
    'community_members', 'community_moderators', 'events', 'issue_reports', 'library_items', 'profiles',
    'study_sets', 'subjects', 'suggestions'
  ] loop
    execute format(
      'create policy "blocked users: no access" on public.%I as restrictive for all to authenticated using ((select public.not_blocked())) with check ((select public.not_blocked()))',
      t
    );
  end loop;
end $$;

-- Sessions end at once; the access token that is already out lasts at most an hour, and the policies above stop it
create function public.end_sessions_of_blocked()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  delete from auth.sessions where user_id = new.id;
  return new;
end;
$$;
revoke execute on function public.end_sessions_of_blocked() from public, anon, authenticated;

create trigger profiles_end_sessions_when_blocked
  after update of blocked on public.profiles
  for each row when (new.blocked and not old.blocked)
  execute function public.end_sessions_of_blocked();

-- The request-files bucket
create policy "request files: blocked users" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'request-files' or (select public.not_blocked()))
  with check (bucket_id <> 'request-files' or (select public.not_blocked()));

-- The count is read inside a function: a policy that selects from its own table is refused as recursive
create function public.request_uploads(p_hours int default null)
returns int
language sql stable
security definer set search_path = ''
as $$
  select count(*)::int
  from storage.objects o
  where o.bucket_id = 'request-files'
    and (storage.foldername(o.name))[1] = auth.uid()::text
    and (p_hours is null or o.created_at > now() - make_interval(hours => p_hours));
$$;
revoke execute on function public.request_uploads(int) from public, anon;
grant execute on function public.request_uploads(int) to authenticated;

create policy "request files: upload limits" on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'request-files'
    or ((select public.request_uploads(24)) < 30 and (select public.request_uploads()) < 100)
  );
