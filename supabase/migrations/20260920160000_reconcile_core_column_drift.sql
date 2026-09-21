-- ============================================================
-- 20260920160000. RECONCILE HOSTED-SCHEMA COLUMN DRIFT
-- ============================================================
-- WHY THIS FILE EXISTS
-- ------------------------------------------------------------
-- The remote project predates the versioned lineage: it was built from an
-- unversioned hosted schema that 001_nexus_base_schema.sql only
-- reconstructs. `create table if not exists` (and the guarded
-- `add column` patterns of 013/020/022) never fix column-level drift on a
-- table that already existed before the migrations started, so the two
-- columns the product and the control plane depend on may be missing on
-- the live database:
--
--   projects.due_date     — ORDER BY and insert payload of the project
--                           manager, dashboard snapshot, 027 workspace
--                           inspector (recent_projects)
--   activities.actor_id   — INSERT target of the 015 audit triggers and
--                           read by 026/027/028 plus the app activity
--                           feeds (dashboard, /activity, intelligence)
--
-- Observed while the drift was live:
--   * /projects answered PGRST204 (order by / payload column missing from
--     the PostgREST schema cache) on BOTH load and create;
--   * admin_overview(), admin_activity_list() and
--     admin_workspace_detail() failed with 42703 on actor_id while
--     admin_workspaces_list() (no actor_id reference) kept working;
--   * the 015 trigger failed inside every project/task/goal write, which
--     independently broke creation.
--
-- WHAT THIS FILE DOES — strictly additive, idempotent, no data risk
-- ------------------------------------------------------------
--   1. Adds each column only if it is absent (guarded on
--      information_schema, so a database that already matches the
--      lineage of record is untouched).
--   2. Backfills from legacy aliases ONLY when the alias exists and the
--      target row is NULL — never overwrites a measured value, never
--      drops, renames or retypes anything.
--   3. Adds one index per new column (guarded, `if not exists`).
--   4. Reloads the PostgREST schema cache at the end: PostgREST resolves
--      ORDER BY and payload columns against its own cache, so without the
--      reload the new columns stay invisible to the client (PGRST204)
--      until PostgREST restarts on its own.
--
-- Verification: the read-only probes in
-- docs/supabase/PROD_DRIFT_DIAGNOSTIC.md (Q1–Q8) show the column lists
-- before and after.
-- ============================================================

-- ------------------------------------------------------------
-- 1. projects.due_date
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.projects') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'projects'
         and column_name = 'due_date'
     ) then
    alter table public.projects
      add column due_date date;
  end if;
end
$$;

-- Backfill from a legacy alias, if one exists. Only date/timestamp
-- aliases are considered, and only into rows where due_date is NULL —
-- an already-measured deadline is never overwritten.
do $$
declare
  alias   text;
  dtype   text;
begin
  if to_regclass('public.projects') is null then
    return;
  end if;
  foreach alias in array array['deadline', 'due_at', 'end_date'] loop
    select data_type into dtype
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = alias;
    if dtype is not null
       and dtype in ('date', 'timestamp with time zone', 'timestamp without time zone') then
      execute format(
        'update public.projects
           set due_date = %I::date
           where due_date is null and %I is not null',
        alias, alias
      );
    end if;
  end loop;
end
$$;

-- Defensive: the code writes and sorts both timestamps on projects.
do $$
begin
  if to_regclass('public.projects') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'projects'
        and column_name = 'created_at'
    ) then
      alter table public.projects
        add column created_at timestamptz not null default now();
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'projects'
        and column_name = 'updated_at'
    ) then
      alter table public.projects
        add column updated_at timestamptz not null default now();
    end if;
  end if;
end
$$;

-- ------------------------------------------------------------
-- 2. activities.actor_id
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.activities') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'activities'
         and column_name = 'actor_id'
     ) then
    -- Same contract as the lineage of record: nullable, survives user
    -- deletion (the feed then uses the passive voice — the UI is built
    -- for exactly that).
    alter table public.activities
      add column actor_id uuid
      references auth.users(id) on delete set null;
  end if;
end
$$;

-- Legacy alias: if the hosted table carried the actor as user_id, lift
-- it into actor_id for rows that do not have one yet. The old column is
-- kept (nothing in the repository reads it; dropping it is an operator
-- decision, not this migration's).
do $$
begin
  if to_regclass('public.activities') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'activities'
         and column_name = 'user_id'
     ) then
    update public.activities
    set actor_id = user_id
    where actor_id is null
      and user_id is not null;
  end if;
end
$$;

-- Defensive: the activity feeds sort by created_at.
do $$
begin
  if to_regclass('public.activities') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'activities'
         and column_name = 'created_at'
     ) then
    alter table public.activities
      add column created_at timestamptz not null default now();
  end if;
end
$$;

-- ------------------------------------------------------------
-- 3. Indexes (guarded: some test worlds apply this file without the
--    tables existing — `create index` on a missing table would raise)
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.projects') is not null then
    execute 'create index if not exists projects_due_date_idx on public.projects(due_date)';
  end if;
  if to_regclass('public.activities') is not null then
    execute 'create index if not exists activities_actor_idx on public.activities(actor_id)';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 4. PostgREST schema cache reload
-- ------------------------------------------------------------
-- The client resolves ORDER BY and JSON payload columns against this
-- cache; without the reload the columns above stay invisible to
-- PostgREST until it restarts on its own.
notify pgrst, 'reload schema';

-- ============================================================
-- END 20260920160000 — RECONCILE CORE COLUMN DRIFT
-- ============================================================
