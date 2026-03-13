-- Online import support for parsed_morgues.
-- Run this once in the Supabase SQL editor after the core schema has been created.

alter table public.parsed_morgues
  add column if not exists source text not null default 'manual_upload',
  add column if not exists server_abbreviation text,
  add column if not exists dcss_username text,
  add column if not exists game_signature text;

-- Indexes to make lookups by signature and server/username fast for online_sync rows.
create index if not exists parsed_morgues_game_signature_idx
  on public.parsed_morgues (game_signature)
  where source = 'online_sync';

create index if not exists parsed_morgues_server_user_idx
  on public.parsed_morgues (server_abbreviation, dcss_username)
  where source = 'online_sync';

