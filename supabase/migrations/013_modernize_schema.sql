-- ============================================================
-- 013. MODERNIZE — RELATIONSHIP + INTENT + ACTIONABLE NOTIFICATIONS
-- ============================================================
-- Adds the columns the "Goal -> Project -> Task -> Activity" product
-- story and the intelligence / notification systems need, WITHOUT
-- touching the existing base schema (001-005) or the enforcement
-- migrations (006-012). Every statement is idempotent so this file can
-- be re-run safely on databases that already have the columns.
--
--   1. projects.goal_id        -> links a project to its parent goal
--   2. profiles.onboarding_intent -> the "What are you trying to get
--                                  under control?" answer (step 2)
--   3. notifications.severity  -> info | warning | critical
--   4. notifications.action    -> a short, imperative label for the
--                                  call-to-action (e.g. "Open project")
--
-- Rollback (only if no other migration depends on these columns):
--   alter table public.projects        drop column if exists goal_id;
--   alter table public.profiles        drop column if exists onboarding_intent;
--   alter table public.notifications   drop column if exists severity;
--   alter table public.notifications   drop column if exists action;
-- ============================================================

-- 1. projects.goal_id -------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'goal_id'
  ) then
    alter table public.projects
      add column goal_id uuid references public.goals(id) on delete set null;
  end if;
end
$$;

-- 2. profiles.onboarding_intent --------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'onboarding_intent'
  ) then
    alter table public.profiles
      add column onboarding_intent text;
  end if;
end
$$;

-- 3. notifications.severity -------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'severity'
  ) then
    alter table public.notifications
      add column severity text not null default 'info'
      check (severity in ('info', 'warning', 'critical'));
  end if;
end
$$;

-- 4. notifications.action ---------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'action'
  ) then
    alter table public.notifications
      add column action text;
  end if;
end
$$;

-- ============================================================
-- END 013
-- ============================================================
