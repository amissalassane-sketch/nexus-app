-- ============================================================
-- 011. WORKSPACE OWNER MEMBERSHIP (P0 — CRITICAL FIX)
--
-- Root cause of "No active workspace is currently linked to this
-- account": creating a workspace never guaranteed the owner row in
-- workspace_members. Every application resolution path goes through
-- that table.
--
-- This migration is IDEMPOTENT and can be re-run safely.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Guarantee a unique index on (workspace_id, user_id)
--    Required by the ON CONFLICT clauses below.
--    First remove duplicates, keeping the most meaningful row
--    (prefer active status, then owner role, then oldest).
-- ------------------------------------------------------------
delete from public.workspace_members as a
using public.workspace_members as b
where a.workspace_id = b.workspace_id
  and a.user_id = b.user_id
  and (
    (
      case when a.status = 'active' then 1 else 0 end,
      case when a.role = 'owner' then 1 else 0 end,
      a.created_at,
      a.ctid
    ) < (
      case when b.status = 'active' then 1 else 0 end,
      case when b.role = 'owner' then 1 else 0 end,
      b.created_at,
      b.ctid
    )
  );

create unique index if not exists workspace_members_workspace_user_uidx
  on public.workspace_members (workspace_id, user_id);

-- ------------------------------------------------------------
-- 1. Rewrite enforce_member_limit: the workspace OWNER is exempt
--    from the 'members' plan limit (otherwise FREE = 1 member
--    blocks the owner's own membership insert).
-- ------------------------------------------------------------
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
  v_owner uuid;
begin
  select owner_id into v_owner
    from public.workspaces
    where id = NEW.workspace_id;

  -- The owner never counts against the member limit.
  if v_owner is not null and NEW.user_id = v_owner then
    return NEW;
  end if;

  v_plan  := public.get_workspace_plan(NEW.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'members');

  select count(*) into v_count
    from public.workspace_members
    where workspace_id = NEW.workspace_id
      and (v_owner is null or user_id <> v_owner);

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: members (% / %). Upgrade to unlock more.', v_count, v_limit
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

-- ------------------------------------------------------------
-- 2. create_owner_membership(): after every workspace insert,
--    guarantee (workspace_id, owner_id, 'owner', 'active').
--    NEVER break the signup: any failure is logged as a warning.
-- ------------------------------------------------------------
create or replace function public.create_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (NEW.id, NEW.owner_id, 'owner', 'active')
  on conflict (workspace_id, user_id)
  do update set status = 'active', role = 'owner';

  return NEW;

exception
  when others then
    raise warning 'create_owner_membership failed for workspace % (owner %): %',
      NEW.id, NEW.owner_id, sqlerrm;
    return NEW;
end;
$$;

drop trigger if exists trg_workspace_owner_membership on public.workspaces;
create trigger trg_workspace_owner_membership
  after insert on public.workspaces
  for each row
  execute function public.create_owner_membership();

-- Also repair when ownership is transferred.
drop trigger if exists trg_workspace_owner_membership_update on public.workspaces;
create trigger trg_workspace_owner_membership_update
  after update of owner_id on public.workspaces
  for each row
  when (OLD.owner_id is distinct from NEW.owner_id)
  execute function public.create_owner_membership();

-- ------------------------------------------------------------
-- 3. Backfill: insert missing owner memberships for ALL existing
--    workspaces and reactivate inactive ones.
-- ------------------------------------------------------------
insert into public.workspace_members (workspace_id, user_id, role, status)
select w.id, w.owner_id, 'owner', 'active'
from public.workspaces w
on conflict (workspace_id, user_id)
do update set
  status = 'active',
  role = 'owner'
where public.workspace_members.status <> 'active'
   or public.workspace_members.role <> 'owner';

-- ------------------------------------------------------------
-- 4. RLS: members can always read their own membership row.
--    Created only if absent (idempotent guard on pg_policies).
-- ------------------------------------------------------------
alter table public.workspace_members enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_members'
      and policyname = 'members_can_read_own_membership'
  ) then
    execute $policy$
      create policy "members_can_read_own_membership"
      on public.workspace_members
      for select
      using (user_id = auth.uid())
    $policy$;
  end if;
end
$$;

-- ============================================================
-- END 011
-- ============================================================
