-- Store DCSS server URL for sync-imported morgues so the viewer can fetch raw text
-- from the server instead of from morgue_files. Sync-imported rows have no morgue_files row.
-- Run once in the Supabase SQL editor.

alter table public.parsed_morgues
  add column if not exists morgue_url text;

comment on column public.parsed_morgues.morgue_url is 'For source=online_sync: URL to fetch raw morgue text from the DCSS server. Null for manual uploads.';

-- Allow null morgue_file_id for sync-imported morgues (no raw file stored).
alter table public.parsed_morgues
  alter column morgue_file_id drop not null;
