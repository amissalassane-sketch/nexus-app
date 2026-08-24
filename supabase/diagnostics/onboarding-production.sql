-- ============================================================
-- NEXUS — PRODUCTION ONBOARDING DIAGNOSTIC (READ-ONLY)
-- ============================================================
-- Run this in the SQL editor of the *production* Supabase project, or with
-- a database connection that has catalog/auth read access. Replace the UUID
-- in `target_user` before running the data queries.
--
-- This script does not repair anything and does not disable RLS. It verifies
-- the live schema, migration history, function security, policy definition,
-- and the complete auth -> profile -> workspace -> membership -> subscription
-- chain for one account.
-- ============================================================

-- 1. Confirm the migrations on the live database. Supabase records migration
-- names/versions in this schema; the repository files alone are not evidence.
select version, name
  from supabase_migrations.schema_migrations
 where version in ('016', '017', '018')
    or name in (
      'fix_onboarding_workspace_bootstrap',
      'fix_self_claim_rls_recursion',
      'harden_onboarding_bootstrap'
    )
 order by version;

-- 2. Confirm the functions really exist and are security-definer functions.
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as returns,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as configuration
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'ensure_personal_workspace',
     'get_or_create_personal_workspace',
     'is_workspace_owner'
   )
 order by p.proname, arguments;

-- 3. Confirm the exact self-claim policy on the live table. The policy must
-- use is_workspace_owner(), not an RLS-gated subquery against workspaces.
select schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual,
       with_check
  from pg_policies
 where schemaname = 'public'
   and tablename = 'workspace_members'
   and policyname = 'base_members_self_claim_owner';

-- 4. Replace this value with the affected auth.users.id.
with target_user as (
  select '00000000-0000-0000-0000-000000000000'::uuid as user_id
)
select u.id as auth_user_id,
       u.created_at as auth_created_at,
       (u.email is not null) as has_email,
       (p.id is not null) as has_profile,
       p.display_name,
       p.username,
       p.onboarding_completed,
       p.onboarding_intent
  from target_user t
  left join auth.users u on u.id = t.user_id
  left join public.profiles p on p.id = t.user_id;

-- 5. Owned-workspace chain. This makes missing membership/subscription and
-- owner/workspace mismatches visible in one result row per owned workspace.
with target_user as (
  select '00000000-0000-0000-0000-000000000000'::uuid as user_id
)
select w.id as workspace_id,
       w.owner_id,
       (w.owner_id = t.user_id) as owner_matches_auth_uid,
       w.name as workspace_name,
       w.slug,
       wm.id as membership_id,
       wm.user_id as membership_user_id,
       wm.role,
       wm.status as membership_status,
       (wm.user_id = t.user_id) as membership_matches_user,
       s.id as subscription_id,
       s.plan,
       s.status as subscription_status
  from target_user t
  left join public.workspaces w on w.owner_id = t.user_id
  left join public.workspace_members wm
    on wm.workspace_id = w.id
   and wm.user_id = t.user_id
  left join public.workspace_subscriptions s
    on s.workspace_id = w.id
   and s.status = 'active';

-- 6. All memberships, including memberships in somebody else's workspace.
-- This catches the bug where "any active membership" was mistaken for a
-- personal workspace context.
with target_user as (
  select '00000000-0000-0000-0000-000000000000'::uuid as user_id
)
select wm.workspace_id,
       wm.user_id,
       wm.role,
       wm.status,
       w.owner_id,
       (w.owner_id = t.user_id) as workspace_is_owned_by_user
  from target_user t
  join public.workspace_members wm on wm.user_id = t.user_id
  left join public.workspaces w on w.id = wm.workspace_id
 order by wm.created_at;

-- 7. Safe aggregate flags for support notes.
with target_user as (
  select '00000000-0000-0000-0000-000000000000'::uuid as user_id),
owned as (
  select w.id
    from target_user t
    join public.workspaces w on w.owner_id = t.user_id),
active_owned_memberships as (
  select wm.workspace_id
    from target_user t
    join public.workspace_members wm on wm.user_id = t.user_id
    join public.workspaces w on w.id = wm.workspace_id and w.owner_id = t.user_id
   where wm.role = 'owner' and wm.status = 'active'),
active_subscriptions as (
  select s.workspace_id
    from public.workspace_subscriptions s
   where s.status = 'active')
select (select count(*) from owned)::int as owned_workspace_count,
       (select count(*) from active_owned_memberships)::int as active_owner_membership_count,
       (select count(*) from active_subscriptions s join owned o on o.id = s.workspace_id)::int
         as active_owned_subscription_count;

-- 8. Function identity check. Run the next call with an authenticated
-- user's session (Supabase REST/PostgREST or a test JWT), not as a browser
-- anon client and not with a user-supplied workspace id:
--
--   select * from public.get_or_create_personal_workspace();
--
-- Expected: exactly one row whose role is owner and status is active. The
-- onboarding Step 1 route then performs profiles.update (or profiles.insert
-- only when the profile row is absent), followed by a read-back.
