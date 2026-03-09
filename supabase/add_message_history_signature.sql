-- Add message_history_signature to parsed_morgues for duplicate detection.
-- Run in Supabase SQL Editor if you already have the parsed_morgues table.

alter table public.parsed_morgues
add column if not exists message_history_signature text not null default '';

comment on column public.parsed_morgues.message_history_signature is 'First 5 lines of Message History section for duplicate detection';
