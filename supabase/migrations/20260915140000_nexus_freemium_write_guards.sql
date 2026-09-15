-- ============================================================
-- NEXUS — FREEMIUM WRITE GUARDS
-- ============================================================
-- Additive correction for the final freemium contract.
--
-- The earlier migrations correctly protect direct INSERTs, but their
-- resource triggers do not run the same limit check when a row is moved
-- into another workspace. A concurrent pair of INSERTs can also observe
-- the same pre-insert count. This migration keeps the existing functions
-- and subscription mechanism, and closes those two write paths.
--
-- Contract:
--   * limits come from public.get_plan_limit() (008's final values);
--   * absent active subscription means FREE;
--   * active-task means status not in ('done', 'cancelled');
--   * direct client writes still pass through the existing RLS/membership
--     triggers; these guards are an additional server-side boundary;
--   * one transaction-scoped advisory lock serializes limit checks for the
--     same resource/workspace (or owner for workspace creation).
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROJECTS — INSERT + WORKSPACE TRANSFER
-- ------------------------------------------------------------
create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  -- Editing a project in place does not consume another project slot.
  if tg_op = 'UPDATE' and old.workspace_id is not distinct from new.workspace_id then
    return new;
  end if;

  -- The lock makes the check-and-write atomic for this workspace/resource.
  perform pg_advisory_xact_lock(
    hashtextextended('nexus:projects:' || new.workspace_id::text, 0)
  );

  v_plan  := public.get_workspace_plan(new.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'projects');

  select count(*) into v_count
    from public.projects
   where workspace_id = new.workspace_id
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: projects (% / %). Upgrade to add more.', v_count, v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_project_limit on public.projects;
create trigger trg_enforce_project_limit
  before insert or update of workspace_id on public.projects
  for each row
  execute function public.enforce_project_limit();

-- ------------------------------------------------------------
-- 2. GOALS — INSERT + WORKSPACE TRANSFER
-- ------------------------------------------------------------
create or replace function public.enforce_goal_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  if tg_op = 'UPDATE' and old.workspace_id is not distinct from new.workspace_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nexus:goals:' || new.workspace_id::text, 0)
  );

  v_plan  := public.get_workspace_plan(new.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'goals');

  select count(*) into v_count
    from public.goals
   where workspace_id = new.workspace_id
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: goals (% / %). Upgrade to add more.', v_count, v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_goal_limit on public.goals;
create trigger trg_enforce_goal_limit
  before insert or update of workspace_id on public.goals
  for each row
  execute function public.enforce_goal_limit();

-- ------------------------------------------------------------
-- 3. MEMBERS — INSERT + WORKSPACE TRANSFER
-- ------------------------------------------------------------
-- Keep the existing owner re-claim exception from 021: repairing the
-- owner's missing row is not a new member and must work at the cap.
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  if new.role = 'owner' and exists (
    select 1
      from public.workspaces w
     where w.id = new.workspace_id
       and w.owner_id = new.user_id
  ) then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.workspace_id is not distinct from new.workspace_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nexus:members:' || new.workspace_id::text, 0)
  );

  v_plan  := public.get_workspace_plan(new.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'members');

  select count(*) into v_count
    from public.workspace_members
   where workspace_id = new.workspace_id
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: members (% / %). Upgrade to add more.', v_count, v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_member_limit on public.workspace_members;
create trigger trg_enforce_member_limit
  before insert or update of workspace_id on public.workspace_members
  for each row
  execute function public.enforce_member_limit();

-- ------------------------------------------------------------
-- 4. ACTIVE TASKS — INSERT, REOPEN, WORKSPACE TRANSFER
-- ------------------------------------------------------------
create or replace function public.enforce_task_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  -- Done/cancelled rows never consume an active-task slot, including when
  -- they are inserted or moved between workspaces.
  if new.status in ('done', 'cancelled') then
    return new;
  end if;

  -- An already-active task staying in the same workspace does not increase
  -- the active count. This permits ordinary edits without a needless count.
  if tg_op = 'UPDATE'
     and old.workspace_id is not distinct from new.workspace_id
     and old.status not in ('done', 'cancelled') then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nexus:active_tasks:' || new.workspace_id::text, 0)
  );

  v_plan  := public.get_workspace_plan(new.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'active_tasks');

  select count(*) into v_count
    from public.tasks
   where workspace_id = new.workspace_id
     and status not in ('done', 'cancelled')
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: active_tasks (% / %). Upgrade to add more.', v_count, v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_task_limit on public.tasks;
create trigger trg_enforce_task_limit
  before insert or update of status, workspace_id on public.tasks
  for each row
  execute function public.enforce_task_limit();

-- ------------------------------------------------------------
-- 5. PLAN RESOLUTION — VALIDATE THE ACTIVE PLAN VALUE
-- ------------------------------------------------------------
-- A missing subscription, a cancelled subscription, or a malformed active
-- row must not grant capacity. The canonical plan vocabulary is deliberately
-- repeated here so an incoherent row fails closed to FREE rather than
-- producing an unknown plan with a zero-shaped limit.
create or replace function public.get_workspace_plan(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select s.plan
        from public.workspace_subscriptions s
       where s.workspace_id = p_workspace_id
         and s.status = 'active'
         and s.plan in ('FREE', 'PRO', 'TEAM')
       limit 1
    ),
    'FREE'
  );
$$;

create or replace function public.get_owner_plan(p_owner_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select s.plan
        from public.workspace_subscriptions s
        join public.workspaces w on w.id = s.workspace_id
       where w.owner_id = p_owner_id
         and s.status = 'active'
         and s.plan in ('FREE', 'PRO', 'TEAM')
       order by case s.plan
                  when 'TEAM' then 3
                  when 'PRO' then 2
                  else 1
                end desc
       limit 1
    ),
    'FREE'
  );
$$;

-- ------------------------------------------------------------
-- 6. WORKSPACES — INSERT + OWNER PLAN CAPACITY
-- ------------------------------------------------------------
-- The existing workspace guard was INSERT-only. An owner_id transfer must
-- not let a user acquire a workspace beyond the plan allowance. The current
-- workspace is excluded from the target owner's count during an UPDATE.
create or replace function public.enforce_workspace_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  if new.owner_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.owner_id is not distinct from new.owner_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nexus:workspaces:' || new.owner_id::text, 0)
  );

  v_plan  := public.get_owner_plan(new.owner_id);
  v_limit := public.get_plan_limit(v_plan, 'workspaces');

  select count(*) into v_count
    from public.workspaces
   where owner_id = new.owner_id
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: workspaces (% / %). Upgrade to add more.', v_count, v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_workspace_limit on public.workspaces;
create trigger trg_enforce_workspace_limit
  before insert or update of owner_id on public.workspaces
  for each row
  execute function public.enforce_workspace_limit();

-- ------------------------------------------------------------
-- 7. SECURITY HARDENING FOR THE GUARD FAMILY
-- ------------------------------------------------------------
-- Trigger functions never need client EXECUTE. Trigger invocation does not
-- consult function EXECUTE privileges. The usage RPC remains the one public
-- application read, explicitly granted to authenticated below.
alter function public.get_workspace_plan(uuid)
  set search_path = public, pg_temp;
alter function public.get_plan_limit(text, text)
  set search_path = public, pg_temp;
alter function public.get_owner_plan(uuid)
  set search_path = public, pg_temp;
alter function public.get_workspace_usage(uuid)
  set search_path = public, pg_temp;
alter function public.create_default_subscription()
  set search_path = public, pg_temp;

revoke all on function public.enforce_project_limit() from public;
revoke all on function public.enforce_task_limit() from public;
revoke all on function public.enforce_goal_limit() from public;
revoke all on function public.enforce_member_limit() from public;
revoke all on function public.enforce_workspace_limit() from public;
revoke all on function public.create_default_subscription() from public;
revoke all on function public.get_workspace_plan(uuid) from public;
revoke all on function public.get_plan_limit(text, text) from public;
revoke all on function public.get_owner_plan(uuid) from public;
revoke all on function public.get_workspace_usage(uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.enforce_project_limit() from anon;
    revoke all on function public.enforce_task_limit() from anon;
    revoke all on function public.enforce_goal_limit() from anon;
    revoke all on function public.enforce_member_limit() from anon;
    revoke all on function public.enforce_workspace_limit() from anon;
    revoke all on function public.create_default_subscription() from anon;
    revoke all on function public.get_workspace_plan(uuid) from anon;
    revoke all on function public.get_plan_limit(text, text) from anon;
    revoke all on function public.get_owner_plan(uuid) from anon;
    revoke all on function public.get_workspace_usage(uuid) from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.enforce_project_limit() from authenticated;
    revoke all on function public.enforce_task_limit() from authenticated;
    revoke all on function public.enforce_goal_limit() from authenticated;
    revoke all on function public.enforce_member_limit() from authenticated;
    revoke all on function public.enforce_workspace_limit() from authenticated;
    revoke all on function public.create_default_subscription() from authenticated;
    revoke all on function public.get_workspace_plan(uuid) from authenticated;
    revoke all on function public.get_plan_limit(text, text) from authenticated;
    revoke all on function public.get_owner_plan(uuid) from authenticated;
    revoke all on function public.get_workspace_usage(uuid) from authenticated;
    grant execute on function public.get_workspace_usage(uuid) to authenticated;
  end if;
end
$$;

-- ============================================================
-- END 20260915140000
-- ============================================================
