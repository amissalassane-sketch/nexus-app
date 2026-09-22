-- Additive, no country inference and no change to existing workspace legal metadata.
begin;
-- Existing event instants are unchanged; their original input timezone is unknown.
alter table public.events add column if not exists source_timezone text;

create table public.user_regional_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  context jsonb not null,
  updated_at timestamptz not null default now(),
  constraint regional_context_object check (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 4096)
);
alter table public.user_regional_preferences enable row level security;
create policy regional_read_own on public.user_regional_preferences for select to authenticated using (user_id = auth.uid());
create policy regional_insert_own on public.user_regional_preferences for insert to authenticated with check (user_id = auth.uid());
create policy regional_update_own on public.user_regional_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy regional_delete_own on public.user_regional_preferences for delete to authenticated using (user_id = auth.uid());
revoke all on public.user_regional_preferences from anon;
grant select, insert, update, delete on public.user_regional_preferences to authenticated;
grant all on public.user_regional_preferences to service_role;

-- Inactive working-memory policy, not a promise about logs, provider copies or backups.
create index if not exists intelligence_memory_retention_idx on public.intelligence_memory (updated_at);
create or replace function public.purge_inactive_intelligence_memory()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare deleted_count integer;
begin
  with expired as (
    select id from public.intelligence_memory
    where updated_at < now() - interval '90 days'
    order by updated_at limit 1000 for update skip locked
  )
  delete from public.intelligence_memory m using expired e where m.id = e.id;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function public.purge_inactive_intelligence_memory() from public, anon, authenticated;
grant execute on function public.purge_inactive_intelligence_memory() to service_role;
-- Scheduling is deliberately NOT fabricated. Operator must configure daily invocation and alerting.
commit;
