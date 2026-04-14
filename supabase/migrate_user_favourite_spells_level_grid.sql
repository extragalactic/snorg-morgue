-- One-shot upgrade: replace legacy global top-10 favourite spells with per–spell-level top 3 (3×3 grid).
-- Run in Supabase SQL editor if you already created user_favourite_spells with the old schema.

drop policy if exists "user_favourite_spells_delete_own" on public.user_favourite_spells;
drop policy if exists "user_favourite_spells_insert_own" on public.user_favourite_spells;
drop policy if exists "user_favourite_spells_select_authenticated" on public.user_favourite_spells;

drop table if exists public.user_favourite_spells;

create table public.user_favourite_spells (
  user_id uuid not null references auth.users(id) on delete cascade,
  level_group text not null,
  rank int not null check (rank >= 1 and rank <= 3),
  spell_key text not null,
  spell_name text not null,
  total_uses int not null check (total_uses >= 0),
  morgue_count int not null check (morgue_count >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, level_group, rank)
);

create index user_favourite_spells_user_idx on public.user_favourite_spells (user_id);

comment on table public.user_favourite_spells is
  'Top 3 spells per spell level (1–9) from Action history; level_group stores level as text.';

alter table public.user_favourite_spells enable row level security;

create policy "user_favourite_spells_select_authenticated"
  on public.user_favourite_spells
  for select
  to authenticated
  using (true);

create policy "user_favourite_spells_insert_own"
  on public.user_favourite_spells
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_favourite_spells_delete_own"
  on public.user_favourite_spells
  for delete
  to authenticated
  using (auth.uid() = user_id);
