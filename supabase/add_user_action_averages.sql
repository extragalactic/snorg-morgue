-- Per-user average Action counts by level band (recalculated when morgues change).
-- Run in Supabase SQL editor once.

create table if not exists public.user_action_averages (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,
  level_group text not null,
  avg_count double precision not null,
  morgue_count int not null check (morgue_count >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, action_key, level_group)
);

create index if not exists user_action_averages_user_idx
  on public.user_action_averages (user_id);

comment on table public.user_action_averages is
  'Mean action counts per XL band across the user''s morgue files that include an Action table.';

alter table public.user_action_averages enable row level security;

-- Aggregates: any signed-in user can read (used when viewing another player''s morgue).
create policy "user_action_averages_select_authenticated"
  on public.user_action_averages
  for select
  to authenticated
  using (true);

-- Only the owner can replace their averages (client recomputes after uploads).
create policy "user_action_averages_insert_own"
  on public.user_action_averages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_action_averages_delete_own"
  on public.user_action_averages
  for delete
  to authenticated
  using (auth.uid() = user_id);
