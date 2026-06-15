-- Death place impact chart: orb run bucket (died with Orb of Zot after pickup).
-- Run in Supabase SQL Editor if you already have the parsed_morgues table.

alter table public.parsed_morgues
add column if not exists died_holding_orb boolean default false not null;

comment on column public.parsed_morgues.died_holding_orb is
  'True for deaths after picking up the Orb of Zot (orb run; not attributed to a branch floor).';

-- Existing rows: use Refresh Morgues (re-parse) to populate, or default false for older imports.
