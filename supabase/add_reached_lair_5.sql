-- Add reached_lair_5 to parsed_morgues (true if morgue Branches section shows Lair (5/5)).
-- Run in Supabase SQL Editor if you already have the parsed_morgues table.

alter table public.parsed_morgues
add column if not exists reached_lair_5 boolean default false;

comment on column public.parsed_morgues.reached_lair_5 is 'True if player reached Lair:5 (Branches section contains Lair (5/5)).';
