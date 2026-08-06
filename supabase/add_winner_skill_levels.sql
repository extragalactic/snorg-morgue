-- winner_skill_levels: per winning game, the final integer level of each trained skill.
-- Floor of the last-XL value from the morgue's Skill Usage History (so winners who ended
-- below XL 27 are handled correctly). Powers the "Winner Skills" chart on the Analysis page.
-- Populated at import time (manual upload + online sync) for winning games, mirroring skill_snapshots.
--
-- Run in Supabase SQL editor once (new projects / existing databases).

create table if not exists public.winner_skill_levels (
  user_id uuid not null,
  game_id uuid not null references public.parsed_morgues(id) on delete cascade,
  skill text not null,
  level int not null check (level >= 0 and level <= 27),
  created_at timestamptz not null default now(),
  primary key (game_id, skill)
);

create index if not exists winner_skill_levels_user_idx
  on public.winner_skill_levels (user_id);

comment on table public.winner_skill_levels is
  'Per winning game, final integer level of each trained skill (floor of last-XL value from Skill Usage History). Powers the Winner Skills chart.';

alter table public.winner_skill_levels enable row level security;

create policy "winner_skill_levels_select_authenticated"
  on public.winner_skill_levels
  for select
  to authenticated
  using (true);

create policy "winner_skill_levels_insert_own"
  on public.winner_skill_levels
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "winner_skill_levels_delete_own"
  on public.winner_skill_levels
  for delete
  to authenticated
  using (auth.uid() = user_id);
