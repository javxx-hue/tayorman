-- Two small fixes from the audit.
--
-- 1. When the AI could not answer (every model busy or too slow), the student's try was still counted against
--    their daily limit. The server now gives it back with refund_ai_quota (only ever for our failures, never for a
--    request the AI refused as bad).
-- 2. The helper functions behind the row-level policies could be called by anyone, signed in or not. They only
--    ever look at the caller's own id, so nothing leaked, but there is no reason to leave them open: only signed-in
--    users (and the server) keep the right. Trigger functions are not called by users at all.
--
-- Run after 0008.

create function public.refund_ai_quota(p_user uuid)
returns void
language sql
security definer set search_path = ''
as $$
  update public.ai_usage
     set count = greatest(count - 1, 0)
   where user_id = p_user
     and day = (now() at time zone 'Asia/Tashkent')::date;
$$;
revoke execute on function public.refund_ai_quota(uuid) from public, anon, authenticated;
grant execute on function public.refund_ai_quota(uuid) to service_role;

do $$
declare
  f text;
begin
  -- called by policies and by signed-in users
  foreach f in array array[
    'public.is_admin()', 'public.is_staff()', 'public.moderates(uuid)', 'public.moderates_all(uuid[])',
    'public.moderates_assignment(uuid)', 'public.moderates_user(uuid)', 'public.in_audience(boolean, uuid[])'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;

  -- triggers only
  foreach f in array array['public.audit_row()', 'public.limit_daily_inserts()', 'public.rls_auto_enable()'] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
    end if;
  end loop;
end $$;
