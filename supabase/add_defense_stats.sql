-- Final defense stats from the morgue status block (AC / EV / SH).
-- Run in Supabase SQL Editor if you already have the parsed_morgues table.
-- Existing rows: use Refresh Morgues (re-parse) to populate; defaults to 0 until then.

alter table public.parsed_morgues
add column if not exists ac integer default 0 not null;

alter table public.parsed_morgues
add column if not exists ev integer default 0 not null;

alter table public.parsed_morgues
add column if not exists sh integer default 0 not null;

comment on column public.parsed_morgues.ac is
  'Final armour class from the morgue status block.';

comment on column public.parsed_morgues.ev is
  'Final evasion from the morgue status block.';

comment on column public.parsed_morgues.sh is
  'Final shield value from the morgue status block.';
