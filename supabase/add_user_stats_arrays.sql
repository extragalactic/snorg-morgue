-- Add species_stats, background_stats, and god_stats to user_stats.
-- Each is a JSONB array of { "name": string, "wins": number, "attempts": number }.
-- Run in Supabase SQL Editor if you already have the user_stats table.

alter table public.user_stats
add column if not exists species_stats jsonb not null default '[]'::jsonb;

alter table public.user_stats
add column if not exists background_stats jsonb not null default '[]'::jsonb;

alter table public.user_stats
add column if not exists god_stats jsonb not null default '[]'::jsonb;

comment on column public.user_stats.species_stats is 'Per-species win and attempt counts: [{ name, wins, attempts }]';
comment on column public.user_stats.background_stats is 'Per-background win and attempt counts: [{ name, wins, attempts }]';
comment on column public.user_stats.god_stats is 'Per-god win and attempt counts: [{ name, wins, attempts }]';
