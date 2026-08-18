-- ============================================================
-- NEXUS — RLS AUDIT (READ-ONLY, SAFE TO RUN ON PRODUCTION)
-- ============================================================
-- Migrations 001-005 (base schema + RLS policies) are not versioned in this
-- repository, so the real policies cannot be reviewed from the codebase.
-- Run this script in the Supabase SQL editor and read the output to verify
-- that every table is protected.
--
-- It only performs SELECTs on catalog views. It changes nothing.
-- ============================================================

-- 1. Which tables have RLS enabled / forced?
select
  c.relname                                   as table_name,
  c.relrowsecurity                            as rls_enabled,
  c.relforcerowsecurity                       as rls_forced,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles', 'workspaces', 'workspace_members', 'workspace_subscriptions',
    'projects', 'tasks', 'goals', 'notifications', 'activities'
  )
order by c.relname;

-- EXPECTED: rls_enabled = true AND policy_count > 0 for every row.
-- A table with rls_enabled = false is fully readable/writable by any
-- authenticated user through the public API.

-- 2. Full policy list, per command
select
  tablename,
  policyname,
  cmd          as command,
  roles,
  qual         as using_expression,
  with_check   as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- EXPECTED for every workspace-scoped table (projects, tasks, goals,
-- notifications, activities):
--   * SELECT / INSERT / UPDATE / DELETE policies that all resolve the
--     caller through public.workspace_members (workspace_id = ... and
--     user_id = auth.uid() and status = 'active')
--   * INSERT policies must use WITH CHECK (not only USING)
--   * notifications should additionally scope on user_id = auth.uid()
--
-- RED FLAGS to look for in the expressions below:
--   * `true` as USING/WITH CHECK on a workspace table
--   * a policy granting the `anon` role anything
--   * an UPDATE policy without WITH CHECK (allows moving a row to another
--     workspace)

-- 3. Tables that are exposed but have zero policies (hard failure)
select c.relname as unprotected_table
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = true
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname
  );

-- 4. Freemium enforcement objects installed?
select tgname as trigger_name, c.relname as table_name, tgenabled as enabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and tgname in (
    'trg_enforce_project_limit',
    'trg_enforce_task_limit',
    'trg_enforce_goal_limit',
    'trg_enforce_member_limit',
    'trg_enforce_workspace_limit',      -- migration 011
    'trg_default_subscription',
    'trg_assert_workspace_member',      -- migration 012
    'trg_assert_authorship'             -- migration 012
  )
order by c.relname, tgname;

-- 5. Plan limits actually installed in the database
select plan,
       public.get_plan_limit(plan, 'workspaces')   as workspaces,
       public.get_plan_limit(plan, 'projects')     as projects,
       public.get_plan_limit(plan, 'active_tasks') as active_tasks,
       public.get_plan_limit(plan, 'goals')        as goals,
       public.get_plan_limit(plan, 'members')      as members
from (values ('FREE'), ('PRO'), ('TEAM')) as p(plan);

-- EXPECTED (must match src/lib/plan-limits.ts exactly):
--   FREE  1 /   2 /  100 /   3 /  1
--   PRO   5 /  10 / 1000 /  20 /  5
--   TEAM 20 /  50 / 5000 / 100 / 20

-- 6. Does the activities table exist, and is anything writing to it?
select
  to_regclass('public.activities') as activities_table,
  (select count(*) from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
      and pg_get_triggerdef(t.oid) ilike '%activities%') as triggers_writing_activities;

-- If activities_table is null, the dashboard "Recent activity" panel will
-- report "Activity feed unavailable" (expected, non-blocking).
-- If triggers_writing_activities = 0, the table exists but nothing fills it.
