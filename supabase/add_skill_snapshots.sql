-- skill_snapshots: per-game, per-checkpoint, per-skill snapshots for Skilling Analysis.
-- Run once in the Supabase SQL editor to create the table and indexes.

create table if not exists public.skill_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  game_id uuid not null,
  species text not null,
  background text not null,
  version_short text,
  skill_group text not null,
  checkpoint_xl int not null check (checkpoint_xl in (5, 10, 15, 20, 27)),
  level numeric not null check (level >= 0),
  created_at timestamptz not null default now()
);

create index if not exists skill_snapshots_checkpoint_skill_idx
  on public.skill_snapshots (checkpoint_xl, skill_group);

create index if not exists skill_snapshots_species_bg_checkpoint_skill_idx
  on public.skill_snapshots (species, background, checkpoint_xl, skill_group);

create index if not exists skill_snapshots_version_idx
  on public.skill_snapshots (version_short);

comment on table public.skill_snapshots is
  'Per-game skill snapshots at XL checkpoints (global winners skilling analysis).';

