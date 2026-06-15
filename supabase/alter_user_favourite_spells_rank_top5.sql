-- Fix empty Favourite Spells after app started inserting top 5 per level:
-- the original table only allowed rank 1–3, so INSERT failed after DELETE.
--
-- Run once in Supabase SQL editor (or psql) on existing databases.

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'user_favourite_spells'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%rank%'
  loop
    execute format('alter table public.user_favourite_spells drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.user_favourite_spells
  add constraint user_favourite_spells_rank_check
  check (rank >= 1 and rank <= 5);

comment on table public.user_favourite_spells is
  'Top 5 spells per spell level (1–9) from Action history Cast rows; level_group stores level as text.';
