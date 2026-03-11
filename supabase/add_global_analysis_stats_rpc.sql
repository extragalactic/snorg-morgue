-- RPC: global_analysis_stats
-- Returns global aggregate stats for the Analysis page in a single JSON payload.
-- This is designed as the single backend contract the UI depends on, so that
-- we can later swap the implementation to use precomputed tables without
-- changing frontend code.
--
-- Shape (JSONB):
-- {
--   "user_count": int,
--   "totals": {
--     "total_games": int,
--     "total_wins": int,
--     "total_deaths": int,
--     "overall_win_rate": numeric,
--     "avg_xl_at_death": numeric,
--     "avg_play_time_seconds": numeric,
--     "avg_runes_per_game": numeric,
--     "fastest_win_seconds": int | null,
--     "avg_best_streak": numeric,
--     "lair5_reach_rate": numeric,
--     "smallest_turncount_win": int | null
--   },
--   "level_death": {
--     "averages": numeric[27],
--     "user_count": int
--   },
--   "species_averages": [ { "name", "avg_wins", "avg_attempts" }, ... ],
--   "background_averages": [ ... ],
--   "god_averages": [ ... ]
--   -- Future extensions can add keys here without breaking callers.
-- }
--
-- Run this in the Supabase SQL editor (or via migration) once.

create or replace function public.global_analysis_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
with base as (
  select *
  from public.parsed_morgues
),
games_agg as (
  select
    count(*)::bigint                           as total_games,
    count(*) filter (where is_win)::bigint     as total_wins,
    count(*) filter (where not is_win)::bigint as total_deaths,
    avg(xl::numeric) filter (where not is_win) as avg_xl_at_death,
    avg(duration_seconds::numeric)             as avg_play_time_seconds,
    avg(runes_count::numeric)                  as avg_runes_per_game,
    min(duration_seconds) filter (where is_win) as fastest_win_seconds,
    -- Global Lair:5 reach rate across all games (0–100)
    case
      when count(*) > 0
      then (count(*) filter (where reached_lair_5)::numeric / count(*)::numeric) * 100
      else 0
    end                                        as lair5_reach_rate,
    -- Smallest turncount win across all games
    min(turns) filter (where is_win)          as smallest_turncount_win
  from base
),
user_best_streaks as (
  -- Average of each user's best streak, considering only users with at least one game.
  select
    avg(best_streak::numeric) as avg_best_streak
  from public.user_stats
  where total_games > 0
),
user_stats_agg as (
  select
    count(distinct user_id) as user_count
  from base
),
per_user_level as (
  select
    user_id,
    greatest(1, least(27, xl)) as level,
    count(*)::numeric as deaths
  from base
  where not is_win
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
level_array as (
  select array_agg(avg_deaths order by level) as averages
  from avg_by_level
),
level_user_count as (
  select count(distinct user_id) as user_count
  from per_user_level
),
-- Per-species average wins/attempts per user (for Species/Background/God chart)
per_user_species as (
  select
    user_id,
    species as name,
    count(*) filter (where is_win)::numeric as wins,
    count(*)::numeric as attempts
  from base
  where species is not null and trim(species) != ''
  group by user_id, species
),
species_avgs as (
  select name, avg(wins) as avg_wins, avg(attempts) as avg_attempts
  from per_user_species
  group by name
),
per_user_background as (
  select
    user_id,
    background as name,
    count(*) filter (where is_win)::numeric as wins,
    count(*)::numeric as attempts
  from base
  where background is not null and trim(background) != ''
  group by user_id, background
),
background_avgs as (
  select name, avg(wins) as avg_wins, avg(attempts) as avg_attempts
  from per_user_background
  group by name
),
per_user_god as (
  select
    user_id,
    coalesce(nullif(trim(god), ''), '(no god)') as name,
    count(*) filter (where is_win)::numeric as wins,
    count(*)::numeric as attempts
  from base
  group by user_id, coalesce(nullif(trim(god), ''), '(no god)')
),
god_avgs as (
  select name, avg(wins) as avg_wins, avg(attempts) as avg_attempts
  from per_user_god
  group by name
)
select jsonb_build_object(
  'user_count', (select user_count from user_stats_agg),
  'totals', jsonb_build_object(
    'total_games', (select total_games from games_agg),
    'total_wins', (select total_wins from games_agg),
    'total_deaths', (select total_deaths from games_agg),
    'overall_win_rate',
      case
        when (select total_games from games_agg) > 0
        then ((select total_wins from games_agg)::numeric
              / (select total_games from games_agg)::numeric) * 100
        else 0
      end,
    'avg_xl_at_death', coalesce((select avg_xl_at_death from games_agg), 0),
    'avg_play_time_seconds', coalesce((select avg_play_time_seconds from games_agg), 0),
    'avg_runes_per_game', coalesce((select avg_runes_per_game from games_agg), 0),
    'fastest_win_seconds', (select fastest_win_seconds from games_agg),
    'avg_best_streak', coalesce((select avg_best_streak from user_best_streaks), 0),
    'lair5_reach_rate', coalesce((select lair5_reach_rate from games_agg), 0),
    'smallest_turncount_win', (select smallest_turncount_win from games_agg)
  ),
  'level_death', jsonb_build_object(
    'averages', coalesce((select averages from level_array), array[]::numeric[]),
    'user_count', coalesce((select user_count from level_user_count), 0)
  ),
  'species_averages', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'avg_wins', avg_wins, 'avg_attempts', avg_attempts)) from species_avgs), '[]'::jsonb),
  'background_averages', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'avg_wins', avg_wins, 'avg_attempts', avg_attempts)) from background_avgs), '[]'::jsonb),
  'god_averages', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'avg_wins', avg_wins, 'avg_attempts', avg_attempts)) from god_avgs), '[]'::jsonb)
);
$$;

comment on function public.global_analysis_stats() is
  'Global aggregate stats for the Analysis page, including per-level average deaths and overall totals.';

