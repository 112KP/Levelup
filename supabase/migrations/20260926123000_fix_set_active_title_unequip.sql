create or replace function public.set_active_title(p_title_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_title_id is not null and not exists (
    select 1
    from public.titles
    where id = p_title_id
      and user_id = v_uid
  ) then
    raise exception 'title not found or not owned by this user';
  end if;

  update public.profiles
  set active_title_id = p_title_id
  where user_id = v_uid;

  update public.titles
  set is_active = coalesce(id = p_title_id, false)
  where user_id = v_uid;
end;
$$;

revoke execute on function public.set_active_title(uuid) from public, anon;
grant execute on function public.set_active_title(uuid) to authenticated;