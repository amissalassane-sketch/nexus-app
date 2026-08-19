-- ============================================================
-- NEXUS — DEVELOPMENT ACCOUNT CLEANUP
-- ============================================================
-- Purpose: let you test signup/login from a clean slate WITHOUT touching
-- schema, RLS, migrations, triggers, plans or any structural data.
--
-- ⚠️  DESTRUCTIVE for the listed accounts only. Run it in the Supabase SQL
--     editor of your DEVELOPMENT project, never in production.
--     Nothing here runs automatically: STEP 1 is read-only, STEP 2 is
--     commented out on purpose and requires you to fill in the emails.
--
-- Deleting a row in auth.users cascades to profiles / workspaces /
-- workspace_members (and therefore to their projects, tasks, goals,
-- notifications and subscriptions) through the existing foreign keys.
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1 — INVENTORY (read-only). Run this first and read it.
-- ------------------------------------------------------------
select
  u.id,
  u.email,
  u.created_at,
  u.email_confirmed_at is not null            as email_confirmed,
  u.last_sign_in_at,
  p.username,
  p.onboarding_completed,
  (select count(*) from public.workspaces w where w.owner_id = u.id)        as workspaces,
  (select count(*) from public.projects pr
     join public.workspaces w2 on w2.id = pr.workspace_id
    where w2.owner_id = u.id)                                               as projects,
  (select count(*) from public.tasks t
     join public.workspaces w3 on w3.id = t.workspace_id
    where w3.owner_id = u.id)                                               as tasks
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;

-- Accounts that never completed onboarding or never signed in are usually
-- leftovers from failed signup attempts:
select u.id, u.email, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where u.last_sign_in_at is null
   or p.id is null
   or coalesce(p.onboarding_completed, false) = false
order by u.created_at desc;

-- ------------------------------------------------------------
-- STEP 2 — DELETION (uncomment, fill in, run knowingly)
-- ------------------------------------------------------------
-- Replace the list with the EXACT dev emails you want to remove.
-- Never use a wildcard here: an unqualified delete would wipe real users.
--
-- begin;
--
-- with doomed as (
--   select id from auth.users
--   where email in (
--     'dev1@example.com',
--     'test@example.com'
--   )
-- )
-- select count(*) as accounts_to_delete from doomed;   -- sanity check
--
-- delete from auth.users
-- where email in (
--   'dev1@example.com',
--   'test@example.com'
-- );
--
-- -- Verify what remains before committing:
-- select id, email from auth.users order by created_at desc;
--
-- commit;    -- or: rollback;

-- ------------------------------------------------------------
-- STEP 3 — ORPHAN CHECK (read-only)
-- ------------------------------------------------------------
-- Workspaces whose owner no longer exists, profiles without an auth user:
select 'orphan_workspace' as kind, w.id, w.name
from public.workspaces w
left join auth.users u on u.id = w.owner_id
where u.id is null
union all
select 'orphan_profile', p.id, coalesce(p.display_name, p.username)
from public.profiles p
left join auth.users u2 on u2.id = p.id
where u2.id is null;

-- ------------------------------------------------------------
-- STEP 4 — AUTH SETTINGS CHECKLIST (manual, in the dashboard)
-- ------------------------------------------------------------
-- Authentication → Sign In / Providers → Email:
--   * "Confirm email" ON  -> signup returns NO session; NEXUS displays
--     "Confirm your email address, then sign in." (expected behaviour)
--   * "Confirm email" OFF -> signup returns a session; NEXUS goes straight
--     to /onboarding.
-- Both paths are handled; turn it OFF for fast local testing.
