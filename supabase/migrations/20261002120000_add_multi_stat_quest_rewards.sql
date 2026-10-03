create table public.quest_stat_rewards (
    user_id uuid not null references auth.users(id) on delete cascade,
    quest_id uuid not null references public.quests(id) on delete cascade,
    stat_name text not null check (stat_name in ('strength', 'agility', 'sense', 'vitality', 'intelligence')),
    amount integer not null check (amount >= 0),
    created_at timestamptz not null default now(),
    primary key (quest_id, stat_name)
);

alter table public.quest_stat_rewards enable row level security;

grant select on public.quest_stat_rewards to authenticated;

create policy "Users can read their quest stat rewards"
on public.quest_stat_rewards
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.set_quest_stat_rewards(
    p_quest_id uuid,
    p_stat_rewards jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'not authenticated';
    end if;

    if not exists (
        select 1
        from public.quests
        where id = p_quest_id
          and user_id = v_user_id
    ) then
        raise exception 'quest not found or not owned by this user';
    end if;

    if p_stat_rewards is null or jsonb_typeof(p_stat_rewards) <> 'array' then
        raise exception 'stat rewards must be a JSON array';
    end if;

    if exists (
        select 1
        from jsonb_to_recordset(p_stat_rewards) as reward(stat_name text, amount integer)
        where reward.stat_name is null
           or reward.stat_name not in ('strength', 'agility', 'sense', 'vitality', 'intelligence')
           or reward.amount is null
           or reward.amount < 0
    ) then
        raise exception 'invalid stat reward';
    end if;

    delete from public.quest_stat_rewards
    where quest_id = p_quest_id
      and user_id = v_user_id;

    insert into public.quest_stat_rewards (user_id, quest_id, stat_name, amount)
    select v_user_id, p_quest_id, reward.stat_name, reward.amount
    from jsonb_to_recordset(p_stat_rewards) as reward(stat_name text, amount integer);
end;
$$;

revoke execute on function public.set_quest_stat_rewards(uuid, jsonb) from public, anon;
grant execute on function public.set_quest_stat_rewards(uuid, jsonb) to authenticated;

create or replace function public.apply_quest_stat_rewards_on_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if old.status = 'completed' or new.status <> 'completed' then
        return new;
    end if;

    if not exists (
        select 1
        from public.quest_stat_rewards
        where user_id = new.user_id
          and quest_id = new.quest_id
    ) then
        return new;
    end if;

    update public.profiles as profile
    set strength = profile.strength + reward.strength,
        agility = profile.agility + reward.agility,
        sense = profile.sense + reward.sense,
        vitality = profile.vitality + reward.vitality,
        intelligence = profile.intelligence + reward.intelligence,
        updated_at = now()
    from (
        select
            coalesce(sum(amount) filter (where stat_name = 'strength'), 0)::integer as strength,
            coalesce(sum(amount) filter (where stat_name = 'agility'), 0)::integer as agility,
            coalesce(sum(amount) filter (where stat_name = 'sense'), 0)::integer as sense,
            coalesce(sum(amount) filter (where stat_name = 'vitality'), 0)::integer as vitality,
            coalesce(sum(amount) filter (where stat_name = 'intelligence'), 0)::integer as intelligence
        from public.quest_stat_rewards
        where user_id = new.user_id
          and quest_id = new.quest_id
    ) as reward
    where profile.user_id = new.user_id;

    insert into public.activity_log (user_id, event_type, amount, description)
    select
        new.user_id,
        'stat_change',
        reward.amount,
        'Quest stat reward: +' || reward.amount || ' ' || reward.stat_name
    from public.quest_stat_rewards as reward
    where reward.user_id = new.user_id
      and reward.quest_id = new.quest_id;

    return new;
end;
$$;

create trigger quest_stat_rewards_on_completion
    after update of status on public.quest_logs
    for each row
    when (old.status is distinct from new.status and new.status = 'completed')
    execute function public.apply_quest_stat_rewards_on_completion();
