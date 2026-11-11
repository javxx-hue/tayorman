-- Bot messages about duels go out once each: to the opponent when the challenger has played,
-- and to the challenger when the opponent has answered. Only the duel-notify function (service role) sets these.
alter table public.duels add column if not exists notified_at timestamptz;
alter table public.duels add column if not exists result_notified_at timestamptz;
