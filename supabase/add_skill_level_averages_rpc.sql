-- RPC: get_skill_level_averages(scope, species_filter, background_filter)
-- For now, scope is effectively global; species/background filters are optional (NULL = all).

create or replace function public.get_skill_level_averages(
  p_species text default null,
  p_background text default null
)
returns table (
  skill_group text,
  checkpoint_xl int,
  avg_level numeric,
  sample_count bigint,
  usage_fraction numeric,
  total_wins bigint
)
language sql
as $$
  with wins as (
    select count(distinct game_id) as total_wins
    from public.skill_snapshots s
    where (p_species is null or s.species = p_species)
      and (p_background is null or s.background = p_background)
  ),
  base as (
    -- Raw per-checkpoint skill snapshots for the selected combo.
    select
      s.game_id,
      s.skill_group,
      s.checkpoint_xl,
      s.level
    from public.skill_snapshots s
    where (p_species is null or s.species = p_species)
      and (p_background is null or s.background = p_background)
  ),
  games_skills as (
    -- Distinct game/skill pairs we have any data for.
    select distinct game_id, skill_group
    from base
  ),
  expanded as (
    -- For each game/skill, synthesize values at all checkpoints (5,10,15,20,25),
    -- using the maximum level seen up to that checkpoint. This ensures that
    -- winners who finished before a checkpoint still contribute their final
    -- skill level to that and later checkpoints.
    select
      gs.game_id,
      gs.skill_group,
      cp as checkpoint_xl,
      max(b.level) filter (where b.checkpoint_xl <= cp) as level
    from games_skills gs
    cross join unnest(array[5,10,15,20,25]) as cp
    left join base b
      on b.game_id = gs.game_id
     and b.skill_group = gs.skill_group
     and b.checkpoint_xl <= cp
    group by gs.game_id, gs.skill_group, cp
  ),
  usage as (
    -- A game "used" a skill if its level is non-null at XL 25.
    select
      e.skill_group,
      count(distinct e.game_id) as used_games
    from expanded e
    where e.checkpoint_xl = 25
      and e.level is not null
    group by e.skill_group
  )
  select
    e.skill_group,
    e.checkpoint_xl,
    avg(e.level) as avg_level,
    count(*) as sample_count,
    coalesce(usage.used_games::numeric / nullif(wins.total_wins, 0), 0) as usage_fraction,
    wins.total_wins
  from expanded e
  cross join wins
  left join usage on usage.skill_group = e.skill_group
  where e.level is not null
  group by e.skill_group, e.checkpoint_xl, usage.used_games, wins.total_wins
  order by e.skill_group, e.checkpoint_xl;
$$;

