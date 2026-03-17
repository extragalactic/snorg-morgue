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
  usage as (
    select
      s.skill_group,
      count(distinct s.game_id) as used_games
    from public.skill_snapshots s
    where s.checkpoint_xl = 25
      and (p_species is null or s.species = p_species)
      and (p_background is null or s.background = p_background)
    group by s.skill_group
  )
  select
    s.skill_group,
    s.checkpoint_xl,
    avg(s.level) as avg_level,
    count(*) as sample_count,
    coalesce(usage.used_games::numeric / nullif(wins.total_wins, 0), 0) as usage_fraction,
    wins.total_wins
  from public.skill_snapshots s
  cross join wins
  left join usage on usage.skill_group = s.skill_group
  where (p_species is null or s.species = p_species)
    and (p_background is null or s.background = p_background)
  group by s.skill_group, s.checkpoint_xl, usage.used_games, wins.total_wins
  order by s.skill_group, s.checkpoint_xl;
$$;

