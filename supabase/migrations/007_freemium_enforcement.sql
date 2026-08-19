-- ============================================================
-- 007. FREEMIUM -- SERVER-SIDE ENFORCEMENT
-- Workspace-scoped plan limits enforced atomically in PostgreSQL.
-- Plans are defined in code (plan-limits.ts); this migration
-- only adds the subscription table and enforcement functions.
-- ============================================================

-- 1. workspace_subscriptions table
--    Stores the active plan per workspace.
--    No plans table -- plan names are sourced from application code.
create table if not exists public.workspace_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  plan                text not null default 'FREE'
                        check (plan in ('FREE', 'PRO', 'TEAM')),
  status              text not null default 'active'
                        check (status in ('active', 'cancelled', 'past_due', 'trialing')),
  -- billing stubs (unconnected for now -- will be wired to FedaPay later)
  billing_customer_id text,
  billing_subscription_id text,
  trial_ends_at       timestamptz,
  current_period_end  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Unique active subscription per workspace
create unique index if not exists workspace_subscriptions_active_workspace_idx
  on public.workspace_subscriptions (workspace_id)
  where status = 'active';

-- RLS
alter table public.workspace_subscriptions enable row level security;

-- Workspace members can read their own workspace subscription
create policy "workspace_members_can_read_subscription"
  on public.workspace_subscriptions
  for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_subscriptions.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

-- Only service_role (backend) can insert/update/delete
-- Frontend never writes to this table directly.

-- -- 2. Helper: get the plan for a workspace (defaults to FREE) --
create or replace function public.get_workspace_plan(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select plan from public.workspace_subscriptions
      where workspace_id = p_workspace_id
        and status = 'active'
      limit 1
    ),
    'FREE'
  );
$$;

-- -- 3. Helper: get numeric limit from plan name ---------------
-- These values must mirror PLAN_LIMITS in src/lib/plan-limits.ts
create or replace function public.get_plan_limit(p_plan text, p_resource text)
returns integer
language plpgsql
immutable
security definer
set search_path = public
as $$
begin
  case p_plan
    when 'FREE' then
      case p_resource
        when 'projects'     then return 2;
        when 'active_tasks' then return 50;
        when 'goals'        then return 3;
        when 'members'      then return 1;
        when 'workspaces'   then return 1;
        else return 0;
      end case;
    when 'PRO' then
      case p_resource
        when 'projects'     then return 15;
        when 'active_tasks' then return 1000;
        when 'goals'        then return 25;
        when 'members'      then return 5;
        when 'workspaces'   then return 5;
        else return 0;
      end case;
    when 'TEAM' then
      case p_resource
        when 'projects'     then return 50;
        when 'active_tasks' then return 5000;
        when 'goals'        then return 100;
        when 'members'      then return 20;
        when 'workspaces'   then return 20;
        else return 0;
      end case;
    else
      return 0;
  end case;
end;
$$;

-- -- 4. Enforce project limit atomically ----------------------
create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  v_plan  := public.get_workspace_plan(NEW.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'projects');
  select count(*) into v_count
    from public.projects
    where workspace_id = NEW.workspace_id;
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: projects (% / %). Upgrade to unlock more.', v_count, v_limit
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_project_limit on public.projects;
create trigger trg_enforce_project_limit
  before insert on public.projects
  for each row
  execute function public.enforce_project_limit();

-- -- 5. Enforce active task limit atomically -------------------
create or replace function public.enforce_task_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  -- Only enforce on active (non-done, non-cancelled) inserts
  if NEW.status in ('done', 'cancelled') then
    return NEW;
  end if;
  v_plan  := public.get_workspace_plan(NEW.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'active_tasks');
  select count(*) into v_count
    from public.tasks
    where workspace_id = NEW.workspace_id
      and status not in ('done', 'cancelled');
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: active_tasks (% / %). Upgrade to unlock more.', v_count, v_limit
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_task_limit on public.tasks;
create trigger trg_enforce_task_limit
  before insert on public.tasks
  for each row
  execute function public.enforce_task_limit();

-- -- 6. Enforce goal limit atomically -------------------------
create or replace function public.enforce_goal_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  v_plan  := public.get_workspace_plan(NEW.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'goals');
  select count(*) into v_count
    from public.goals
    where workspace_id = NEW.workspace_id;
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: goals (% / %). Upgrade to unlock more.', v_count, v_limit
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_goal_limit on public.goals;
create trigger trg_enforce_goal_limit
  before insert on public.goals
  for each row
  execute function public.enforce_goal_limit();

-- -- 7. Enforce member limit atomically -----------------------
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
begin
  v_plan  := public.get_workspace_plan(NEW.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'members');
  select count(*) into v_count
    from public.workspace_members
    where workspace_id = NEW.workspace_id;
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: members (% / %). Upgrade to unlock more.', v_count, v_limit
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_member_limit on public.workspace_members;
create trigger trg_enforce_member_limit
  before insert on public.workspace_members
  for each row
  execute function public.enforce_member_limit();

-- -- 8. Auto-create FREE subscription on workspace creation ----
create or replace function public.create_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_subscriptions (workspace_id, plan, status)
  values (NEW.id, 'FREE', 'active')
  on conflict do nothing;
  return NEW;
end;
$$;

drop trigger if exists trg_default_subscription on public.workspaces;
create trigger trg_default_subscription
  after insert on public.workspaces
  for each row
  execute function public.create_default_subscription();

-- -- 9. Expose usage via RPC (callable from client with RLS) ---
create or replace function public.get_workspace_usage(p_workspace_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan          text;
  v_projects      integer;
  v_active_tasks  integer;
  v_goals         integer;
  v_members       integer;
begin
  -- Security: caller must be active member of this workspace
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and status = 'active'
  ) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  v_plan := public.get_workspace_plan(p_workspace_id);

  select count(*) into v_projects from public.projects
    where workspace_id = p_workspace_id;

  select count(*) into v_active_tasks from public.tasks
    where workspace_id = p_workspace_id
      and status not in ('done', 'cancelled');

  select count(*) into v_goals from public.goals
    where workspace_id = p_workspace_id;

  select count(*) into v_members from public.workspace_members
    where workspace_id = p_workspace_id;

  return json_build_object(
    'plan', v_plan,
    'usage', json_build_object(
      'projects',      v_projects,
      'active_tasks',  v_active_tasks,
      'goals',         v_goals,
      'members',       v_members
    ),
    'limits', json_build_object(
      'projects',      public.get_plan_limit(v_plan, 'projects'),
      'active_tasks',  public.get_plan_limit(v_plan, 'active_tasks'),
      'goals',         public.get_plan_limit(v_plan, 'goals'),
      'members',       public.get_plan_limit(v_plan, 'members')
    )
  );
end;
$$;

-- ============================================================
-- END 007
-- ============================================================
