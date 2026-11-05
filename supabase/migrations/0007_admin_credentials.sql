-- Login + password for admins and moderators who already exist: a second way into the admin site next to
-- Telegram. Only the owner can issue them (Edge Function "admin-accounts"). Nothing here is readable or
-- writable from the browser: RLS is on and no policy or grant exists, only the server (service role) uses it.
--
-- Run after 0006.

create table public.admin_credentials (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  login text not null unique check (login ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  salt text not null,
  hash text not null, -- PBKDF2-SHA256, never the password itself
  iterations integer not null check (iterations >= 1),
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  password_changed_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.admin_credentials enable row level security;
revoke all on public.admin_credentials from anon, authenticated;

-- One wrong password. Counted in the database so parallel guesses cannot slip past the limit:
-- after 5 in a row the login is paused for 15 minutes (a pause that has run out starts the count again).
create function public.admin_login_failed(p_login text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v public.admin_credentials;
  n integer;
begin
  select * into v from public.admin_credentials where login = p_login for update;
  if not found then
    return;
  end if;
  n := case when v.locked_until is not null and v.locked_until <= now() then 1 else v.failed_attempts + 1 end;
  update public.admin_credentials
     set failed_attempts = n,
         locked_until = case when n >= 5 then now() + interval '15 minutes' else v.locked_until end
   where login = p_login;
end;
$$;
revoke all on function public.admin_login_failed(text) from public, anon, authenticated;
grant execute on function public.admin_login_failed(text) to service_role;
