-- Table for admin activity summaries: manual uploads and online sync events.
-- Run once in the Supabase SQL editor.

create table if not exists public.import_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null check (event_type in ('manual_upload', 'online_sync')),
  morgue_count int not null check (morgue_count >= 0),
  server_abbreviation text,
  dcss_username text,
  created_at timestamptz not null default now()
);

create index if not exists import_events_created_at_idx
  on public.import_events (created_at desc);

comment on table public.import_events is 'Log of upload/sync events for admin dashboard activity summaries.';
