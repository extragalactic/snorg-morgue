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
  sample_count bigint
)
language sql
as $$
  select
    s.skill_group,
    s.checkpoint_xl,
    avg(s.level) as avg_level,
    count(*) as sample_count
  from public.skill_snapshots s
  where (p_species is null or s.species = p_species)
    and (p_background is null or s.background = p_background)
  group by s.skill_group, s.checkpoint_xl
  order by s.skill_group, s.checkpoint_xl;
$$;

