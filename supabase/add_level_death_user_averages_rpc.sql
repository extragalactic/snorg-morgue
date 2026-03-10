-- RPC: level_death_user_averages
-- Returns JSON with:
--   averages: numeric[27] (average deaths per user at XL 1–27)
--   user_count: integer (number of distinct users contributing data)
--
-- Usage from Supabase client:
--   const { data, error } = await supabase.rpc('level_death_user_averages');
--   // data = { averages: number[], user_count: number }
--
-- Run this in the Supabase SQL editor (or via migration) once.

create or replace function public.level_death_user_averages()
returns jsonb
language sql
security definer
set search_path = public
as $$
with per_user_level as (
  select
    user_id,
    -- Clamp XL into 1..27 so malformed rows don't break the chart shape
    greatest(1, least(27, xl)) as level,
    count(*)::numeric as deaths
  from public.parsed_morgues
  where is_win = false
    and xl is not null
  group by user_id, greatest(1, least(27, xl))
),
avg_by_level as (
  select
    lvl.level,
    coalesce(avg(pu.deaths), 0) as avg_deaths
  from generate_series(1, 27) as lvl(level)
  left join per_user_level pu
    on pu.level = lvl.level
  group by lvl.level
  order by lvl.level
),
avg_array as (
  select array_agg(avg_deaths order by level) as averages
  from avg_by_level
),
user_counts as (
  select count(distinct user_id) as user_count
  from per_user_level
)
select jsonb_build_object(
  'averages', (select averages from avg_array),
  'user_count', (select user_count from user_counts)
);
$$;

comment on function public.level_death_user_averages() is
  'Returns JSON with averages[27] of average deaths per user at each XL (1–27) and user_count, based on parsed_morgues.';

