-- Progress milestones mirrored from morgue Branches / action log / final place (see computeMorgueMilestones in lib/morgue-parser.ts).
-- Run in Supabase SQL Editor after deploy. Re-upload or use “Refresh morgues” to backfill existing manual uploads.

alter table public.parsed_morgues
  add column if not exists reached_dungeon_7 boolean default false;

alter table public.parsed_morgues
  add column if not exists reached_depths_milestone boolean default false;

alter table public.parsed_morgues
  add column if not exists reached_zot_milestone boolean default false;

comment on column public.parsed_morgues.reached_dungeon_7 is 'True if game reached Dungeon depth 7+ (or won).';

comment on column public.parsed_morgues.reached_depths_milestone is 'True if stepped into Depths:1+ (branch / log / place), or won.';

comment on column public.parsed_morgues.reached_zot_milestone is 'True if stepped into Zot:1+ (branch / log / place), or won.';
