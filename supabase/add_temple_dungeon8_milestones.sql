-- Ecumenical Temple milestone + Dungeon depth 8+ (replaces D:7 column name and semantics).
-- Run in Supabase SQL Editor after add_morgue_branch_milestones.sql.
-- Re-parse or “Refresh morgues” so stored booleans match D:8 / Temple logic.

alter table public.parsed_morgues
  add column if not exists reached_temple boolean default false;

comment on column public.parsed_morgues.reached_temple is 'True if Ecumenical Temple appears in morgue (discovered or entered), or won.';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'parsed_morgues'
      and column_name = 'reached_dungeon_7'
  ) then
    alter table public.parsed_morgues rename column reached_dungeon_7 to reached_dungeon_8;
  end if;
end $$;

alter table public.parsed_morgues
  add column if not exists reached_dungeon_8 boolean default false;

comment on column public.parsed_morgues.reached_dungeon_8 is 'True if game reached Dungeon depth 8+ (or won). Re-parse after migrating from D:7 for accurate percentages.';
