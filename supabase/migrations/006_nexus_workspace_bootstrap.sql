-- ============================================================
-- 006. AUTOMATIC PERSONAL WORKSPACE & LINEAGE BRIDGE PREAMBLE
-- ============================================================

-- ------------------------------------------------------------
-- LINEAGE BRIDGE PREAMBLE
-- Connects remote 001..005 baseline schema to 006+ migrations.
-- Non-destructive, idempotent, preserves ENUMs and existing data.
-- ------------------------------------------------------------

-- 1. Ensure workspaces.slug has a fallback default so 006 insert can succeed
alter table public.workspaces
  alter column slug set default ('ws-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

-- 2. Core helper: is_active_workspace_member
-- Accepts optional p_user_id (defaults to auth.uid()).
-- Casts role::text and status::text for ENUM/text compatibility.
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
      and status::text = 'active'
  );
$$;

-- 3. Core helper: can_manage_workspace
-- Accepts optional p_user_id (defaults to auth.uid()).
-- True if user is an active owner or admin.
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
      and status::text = 'active'
      and role::text in ('owner', 'admin')
  );
$$;

-- 4. Secure helper permissions: revoke anon/public, grant authenticated & service_role
revoke all on function public.is_active_workspace_member(uuid, uuid) from public, anon;
grant execute on function public.is_active_workspace_member(uuid, uuid) to authenticated, service_role;

revoke all on function public.can_manage_workspace(uuid, uuid) from public, anon;
grant execute on function public.can_manage_workspace(uuid, uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 006 CORE WORKSPACE BOOTSTRAP
-- ------------------------------------------------------------

create or replace function public.create_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  workspace_name text;
begin

  workspace_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.email,
    'My Workspace'
  );

  insert into public.workspaces (
    owner_id,
    name
  )
  values (
    new.id,
    workspace_name
  )
  returning id into new_workspace_id;

  return new;

exception
  when others then
    raise warning 'Could not create default workspace for user %: %',
      new.id,
      sqlerrm;

    return new;
end;
$$;


create trigger on_auth_user_created_workspace
after insert on auth.users
for each row
execute function public.create_default_workspace();


-- ============================================================
-- END
-- ============================================================
