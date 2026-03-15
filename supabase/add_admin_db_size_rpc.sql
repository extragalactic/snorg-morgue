-- RPCs for admin dashboard. Run once in Supabase SQL editor.
-- Only call from server-side admin API (service role).

create or replace function public.admin_db_size()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

create or replace function public.admin_counts()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'users_with_morgues', (select count(distinct user_id)::int from public.parsed_morgues),
    'total_parsed_morgues', (select count(*)::int from public.parsed_morgues),
    'total_morgue_files', (select count(*)::int from public.morgue_files),
    'total_user_stats', (select count(*)::int from public.user_stats)
  );
$$;

comment on function public.admin_db_size() is 'Total database size in bytes; for admin dashboard only.';
comment on function public.admin_counts() is 'Counts for admin dashboard; for admin API only.';
