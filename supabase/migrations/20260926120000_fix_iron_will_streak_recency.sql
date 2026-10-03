create or replace function public.check_title_unlocks(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level              int;
  v_streak_days        int;
  v_last_completed_day date;
  v_candidate          record;
begin
  select level into v_level
  from public.profiles
  where user_id = p_user_id;

  if v_level is null then
    return;
  end if;

  for v_candidate in
    select * from (values
      ('Rising Hunter',  'Reached level 10.',  10, null::text, 0),
      ('Veteran Hunter', 'Reached level 25.',  25, null::text, 0),
      ('Elite Hunter',   'Reached level 50.',  50, 'vitality',  3),
      ('Monarch',        'Reached level 75.',  75, 'intelligence', 5)
    ) as t(name, description, min_level, bonus_stat, bonus_amount)
    where t.min_level <= v_level
  loop
    if not exists (
      select 1
      from public.titles
      where user_id = p_user_id
        and name = v_candidate.name
    ) then
      insert into public.titles
        (user_id, name, description, unlock_condition, bonus_stat, bonus_amount, unlocked_at, is_active)
      values
        (p_user_id, v_candidate.name, v_candidate.description,
         'Reach level ' || v_candidate.min_level, v_candidate.bonus_stat, v_candidate.bonus_amount,
         now(), false);

      insert into public.activity_log (user_id, event_type, amount, description)
      values (p_user_id, 'stat_change', 0, 'Title unlocked: ' || v_candidate.name);
    end if;
  end loop;

  select max(quest_date)
  into v_last_completed_day
  from public.quest_logs
  where user_id = p_user_id
    and status = 'completed'
    and quest_date <= current_date;

  select count(*)
  into v_streak_days
  from (
    select quest_date,
           quest_date - (row_number() over (order by quest_date))::int as grp
    from (
      select distinct quest_date
      from public.quest_logs
      where user_id = p_user_id
        and status = 'completed'
        and quest_date between current_date - 30 and current_date
    ) d
  ) g
  where grp = (
    select quest_date - (row_number() over (order by quest_date))::int
    from (
      select distinct quest_date
      from public.quest_logs
      where user_id = p_user_id
        and status = 'completed'
        and quest_date between current_date - 30 and current_date
    ) d2
    order by quest_date desc
    limit 1
  );

  if v_streak_days >= 7
     and v_last_completed_day >= current_date - 1
     and not exists (
       select 1
       from public.titles
       where user_id = p_user_id
         and name = 'Iron Will'
     ) then
    insert into public.titles
      (user_id, name, description, unlock_condition, bonus_stat, bonus_amount, unlocked_at, is_active)
    values
      (p_user_id, 'Iron Will', 'Completed at least one quest for 7 days in a row.',
       '7-day completion streak', 'vitality', 2, now(), false);

    insert into public.activity_log (user_id, event_type, amount, description)
    values (p_user_id, 'stat_change', 0, 'Title unlocked: Iron Will');
  end if;
end;
$$;

revoke execute on function public.check_title_unlocks(uuid) from public, anon, authenticated;
