-- ============================================================
-- NEXUS CORE CONTRACT
-- Compatibility helpers for the canonical 001-005 core lineage.
--
-- This migration deliberately does not change tables, activities,
-- authentication triggers, subscriptions, intelligence, or admin objects.
-- ============================================================

-- The canonical core helpers already exist in 001_nexus_core. Re-assert
-- their locked search path and client execution grants without changing
-- their signatures or policy semantics.
alter function public.is_workspace_member(uuid)
  set search_path = public, pg_temp;

alter function public.has_workspace_role(uuid, public.workspace_member_role[])
  set search_path = public, pg_temp;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid, public.workspace_member_role[]) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.is_workspace_member(uuid) to authenticated;
    grant execute on function public.has_workspace_role(uuid, public.workspace_member_role[]) to authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.is_workspace_member(uuid) to service_role;
    grant execute on function public.has_workspace_role(uuid, public.workspace_member_role[]) to service_role;
  end if;
end
$$;

-- Compatibility wrapper for the legacy two-argument helper. The explicit
-- user argument is retained only for existing SQL policies and repair paths.
create or replace function public.is_active_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = p_user_id
      and status = 'active'
  );
$$;

-- Compatibility wrapper for the legacy owner/admin management check.
create or replace function public.can_manage_workspace(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = p_user_id
      and status = 'active'
      and role = any (
        array[
          'owner'::public.workspace_member_role,
          'admin'::public.workspace_member_role
        ]
      )
  );
$$;

-- Internal repair helper for an owner whose membership row is missing.
-- Callers cannot use it to inspect another user's ownership.
create or replace function public.is_workspace_owner(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null
     and p_user_id = auth.uid()
     and exists (
       select 1
       from public.workspaces
       where id = p_workspace_id
         and owner_id = p_user_id
     );
$$;

revoke all on function public.is_active_workspace_member(uuid, uuid) from public;
revoke all on function public.can_manage_workspace(uuid, uuid) from public;
revoke all on function public.is_workspace_owner(uuid, uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.is_active_workspace_member(uuid, uuid) to authenticated;
    grant execute on function public.can_manage_workspace(uuid, uuid) to authenticated;
    grant execute on function public.is_workspace_owner(uuid, uuid) to authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.is_active_workspace_member(uuid, uuid) to service_role;
    grant execute on function public.can_manage_workspace(uuid, uuid) to service_role;
    grant execute on function public.is_workspace_owner(uuid, uuid) to service_role;
  end if;
end
$$;

-- ============================================================
-- END CORE CONTRACT
-- ============================================================
