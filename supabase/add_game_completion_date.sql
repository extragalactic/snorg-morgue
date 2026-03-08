-- Add game_completion_date to parsed_morgues (from morgue file content, YYYY-MM-DD).
-- Run in Supabase SQL Editor if you already have the parsed_morgues table.

alter table public.parsed_morgues
add column if not exists game_completion_date text default '';

comment on column public.parsed_morgues.game_completion_date is 'Game completion date from morgue file (YYYY-MM-DD). Empty for rows created before this column existed.';
