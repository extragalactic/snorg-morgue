-- Profiles table for per-user data and unique username slugs
-- Run this once in Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username_slug text not null unique
);

alter table public.profiles enable row level security;

-- Anyone can read usernames (no sensitive data in this table)
create policy "Public read profiles"
  on public.profiles
  for select
  using (true);

-- Users can insert/update only their own profile row
create policy "Users manage own profile"
  on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

