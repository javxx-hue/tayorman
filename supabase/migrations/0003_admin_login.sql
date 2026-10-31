-- 0003: admin site sign-in through the bot.
-- The bot writes a row when an admin confirms; the admin-login function reads it once.
-- Run in Supabase: SQL Editor -> paste -> Run (after 0002).

create table public.admin_login_requests (
  nonce_hash text primary key check (nonce_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  approved_at timestamptz not null default now(),
  used_at timestamptz
);
create index admin_login_requests_approved_idx on public.admin_login_requests (approved_at);

-- No policies on purpose: only the service role (Edge Functions) can read or write this table
alter table public.admin_login_requests enable row level security;
revoke all on public.admin_login_requests from anon, authenticated;
