-- Add short_id to parsed_morgues for shareable URLs (e.g. /username/morgues/abc12X).
-- 6 chars is enough for short links; globally unique so API can look up by short_id alone.
-- Run once in Supabase SQL Editor.

ALTER TABLE parsed_morgues
  ADD COLUMN IF NOT EXISTS short_id text;

-- Backfill existing rows with 6-char hex (unique per row).
UPDATE parsed_morgues
SET short_id = substring(md5(id::text || gen_random_uuid()::text), 1, 6)
WHERE short_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS parsed_morgues_short_id_key ON parsed_morgues (short_id);

ALTER TABLE parsed_morgues
  ALTER COLUMN short_id SET NOT NULL;
