-- Asking the board's teacher a question with AI: a bonus the admin gives to chosen students.
-- Students cannot set it themselves: they may update only the columns granted in 0001.
alter table public.profiles add column if not exists board_ai boolean not null default false;

create function public.admin_set_board_ai(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  who text;
  tg bigint;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.profiles set board_ai = p_on where id = p_user returning telegram_id into tg;
  if not found then
    raise exception 'user not found';
  end if;
  select coalesce(first_name, username, 'admin') into who from public.profiles where id = auth.uid();
  insert into public.audit_log (actor, actor_name, action, target_table, target_id, details)
  values (auth.uid(), who, 'update', 'profiles', p_user::text, jsonb_build_object('telegram_id', tg, 'board_ai', p_on));
end;
$$;
revoke execute on function public.admin_set_board_ai(uuid, boolean) from public, anon;
grant execute on function public.admin_set_board_ai(uuid, boolean) to authenticated;
