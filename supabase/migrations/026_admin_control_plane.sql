-- ============================================================
-- 026. ADMIN CONTROL PLANE — PLATFORM IDENTITY, READS, AUDIT
-- ============================================================
-- NEXUS has three distinct authorities, and until now only two of them
-- existed:
--
--   1. NEXUS USER           — owns their profile
--   2. WORKSPACE ADMIN      — owner/admin role in workspace_members
--   3. NEXUS PLATFORM ADMIN — did not exist. Nothing in the schema
--                             distinguished the operator of the SaaS
--                             from any of its customers.
--
-- This migration adds the third one, plus the two things a control
-- plane cannot function without: cross-tenant reads and an audit trail.
--
-- ------------------------------------------------------------
-- SECURITY MODEL (read before editing)
-- ------------------------------------------------------------
-- The admin tables are RLS-enabled with NO policies. That is a deny-all
-- default: no role, not even the table owner through PostgREST, can
-- select a single row of platform_admins or admin_audit_log directly.
--
-- The only door in is a small set of SECURITY DEFINER functions that
--  a) resolve the caller from the JWT (`auth.uid()`, set by PostgREST),
--  b) refuse everything unless that uuid holds an active admin row,
--  c) then perform the read/insert as the definer.
--
-- Consequences that are deliberate:
--   * There is no service_role key anywhere in the application. The
--     admin surface runs on the ordinary SSR client with the user's own
--     session, so every admin action is attributable to a real person.
--   * Knowing the /admin URL grants nothing. The gate is the database.
--   * The audit log is append-only at the storage engine level, not by
--     convention: UPDATE/DELETE/TRUNCATE are blocked by trigger, so no
--     admin — including an owner — can rewrite history.
--
-- ------------------------------------------------------------
-- BOOTSTRAPPING THE FIRST ADMIN
-- ------------------------------------------------------------
-- There is intentionally no self-service or env-var path into
-- platform_admins: that would make the first row forgeable. Run this
-- once against the project (Supabase SQL editor / psql), with the user
-- id of the operator (Dashboard → Authentication → Users):
--
--   insert into public.platform_admins (user_id, role, note)
--   values ('<operator-user-uuid>', 'owner', 'bootstrap operator')
--   on conflict (user_id) do update
--     set role = 'owner', status = 'active', updated_at = now();
--
-- Later admins are granted from inside the control plane itself
-- (PR 5: /admin/settings), which writes an audit entry.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PLATFORM ADMINS
-- ------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  -- owner    : everything, including granting/revoking admin access
  -- operator : full operational reads + audited actions
  -- viewer   : read-only
  role       text not null default 'operator'
               check (role in ('owner','operator','viewer')),
  status     text not null default 'active'
               check (status in ('active','revoked')),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_admins_active_idx
  on public.platform_admins (role) where status = 'active';

-- ------------------------------------------------------------
-- 2. ADMIN AUDIT LOG (append-only)
-- ------------------------------------------------------------
-- actor_email is denormalised on purpose: auth.users rows can be deleted,
-- and an audit trail that loses the identity of the actor when an account
-- is removed is not an audit trail.
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_role  text,
  action      text not null check (char_length(action) between 3 and 80),
  outcome     text not null default 'success'
                check (outcome in ('success','denied','failed')),
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Newest-first is the only access pattern the control plane has.
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log (actor_id, created_at desc);
create index if not exists admin_audit_log_action_idx
  on public.admin_audit_log (action, created_at desc);

-- Append-only is a property of the table, not a promise made by the UI.
-- A row-level trigger covers UPDATE/DELETE; TRUNCATE is statement-level
-- and needs its own trigger.
create or replace function public.admin_audit_reject_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception using
    errcode = '42501',
    message = 'NEXUS_ADMIN_AUDIT_IMMUTABLE: the admin audit log is append-only';
end;
$$;

drop trigger if exists admin_audit_no_row_mutation on public.admin_audit_log;
create trigger admin_audit_no_row_mutation
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_reject_mutation();

drop trigger if exists admin_audit_no_truncate on public.admin_audit_log;
create trigger admin_audit_no_truncate
  before truncate on public.admin_audit_log
  for each statement execute function public.admin_audit_reject_mutation();

create or replace function public.admin_audit_set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_admins_set_updated_at on public.platform_admins;
create trigger platform_admins_set_updated_at
  before update on public.platform_admins
  for each row execute function public.admin_audit_set_updated_at();

-- ------------------------------------------------------------
-- 3. RLS — DENY ALL, NO POLICIES
-- ------------------------------------------------------------
-- Enabled and left without a single policy: direct table access is
-- impossible for anon, authenticated and service_role alike. Every read
-- below goes through a SECURITY DEFINER function that checks the caller
-- first. If someone later adds a policy here, that is a security
-- regression, not a feature.
alter table public.platform_admins  enable row level security;
alter table public.admin_audit_log  enable row level security;

-- Belt and braces: even a role that somehow bypasses RLS must not be
-- able to write to the audit log or grant itself admin.
--
-- `revoke from public` does not clear explicit ACL entries left by
-- Supabase's platform default privileges (the same trap documented in
-- 021), so anon/authenticated are revoked explicitly. The roles only
-- exist on a real Supabase project — the repository's PGlite fixture has
-- just `authenticated` — hence the pg_roles guard.
do $$
declare
  r      text;
  target text;
begin
  foreach r in array array['public','anon','authenticated'] loop
    -- PUBLIC is a keyword, not a role: quoting it would look for a role
    -- literally named "public". Everything else is a real role name and
    -- only exists on a provisioned Supabase project.
    if r <> 'public' and not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;
    target := case when r = 'public' then 'PUBLIC' else quote_ident(r) end;
    execute format('revoke all on table public.platform_admins from %s', target);
    execute format('revoke all on table public.admin_audit_log from %s', target);
  end loop;

  -- service_role is deliberately NOT revoked from platform_admins: it is
  -- the only path the operator has to insert the bootstrap row, and it
  -- still cannot forge an audit entry because the log is trigger-locked.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on table public.admin_audit_log from service_role;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. IDENTITY
-- ------------------------------------------------------------
-- The single definition of "is this caller a platform admin". Every
-- admin function below starts with admin_assert_access(), and nothing
-- else may call these two.
--
-- HARDENING: this takes NO parameter. It can only ever answer for the
-- caller identified by the JWT. The earlier signature accepted an
-- arbitrary uuid, which would have turned the function into an
-- admin-discovery oracle the moment anyone granted EXECUTE on it — a
-- caller could have walked the user table asking "is this one an
-- operator?". EXECUTE is revoked below, but removing the parameter makes
-- probing impossible by construction rather than by ACL, and the only
-- caller in this file was already passing auth.uid().
create or replace function public.platform_admin_is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and status = 'active'
  );
$$;

/** Resolves the caller's platform-admin identity from the JWT.
 *  Returns is_admin=false rather than raising, so the app can render an
 *  honest "platform access required" screen instead of a 500. */
create or replace function public.platform_admin_context()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    return jsonb_build_object('is_admin', false, 'role', null, 'user_id', null);
  end if;

  select role into v_role
  from public.platform_admins
  where user_id = v_uid and status = 'active';

  return jsonb_build_object(
    'is_admin', v_role is not null,
    'role', v_role,
    'user_id', v_uid
  );
end;
$$;

/** Role ladder used by admin_assert_access(). */
create or replace function public.admin_role_rank(p_role text)
returns int language sql immutable set search_path = public, pg_temp as $$
  select case p_role
    when 'owner'    then 3
    when 'operator' then 2
    when 'viewer'   then 1
    else 0
  end;
$$;

/** Internal gate. Raises NEXUS_ADMIN_FORBIDDEN unless the caller holds
 *  at least p_required_role. Not executable from outside: the definer
 *  functions below call it as the owner. */
create or replace function public.admin_assert_access(
  p_required_role text default 'viewer'
)
returns void language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.platform_admins
  where user_id = auth.uid() and status = 'active';

  if v_role is null then
    raise exception using
      errcode = '42501',
      message = 'NEXUS_ADMIN_FORBIDDEN: platform admin access required';
  end if;

  -- Fail closed on an unknown requirement. admin_role_rank() maps anything
  -- it does not recognise to 0, so a NULL or misspelled p_required_role
  -- would rank below every real role and be cleared by any active admin.
  -- That turns a typo in a caller into an unguarded door, so it is
  -- rejected here instead.
  if p_required_role is null or public.admin_role_rank(p_required_role) = 0 then
    raise exception using
      errcode = '42501',
      message = format(
        'NEXUS_ADMIN_BAD_REQUIREMENT: %s is not a platform admin role',
        coalesce(p_required_role, '<null>')
      );
  end if;

  -- An unrecognised role on the admin row itself ranks 0 and therefore
  -- fails the comparison against every real requirement.
  if public.admin_role_rank(v_role) < public.admin_role_rank(p_required_role) then
    raise exception using
      errcode = '42501',
      message = format('NEXUS_ADMIN_INSUFFICIENT_ROLE: requires %s', p_required_role);
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 5. AUDIT WRITER
-- ------------------------------------------------------------
create or replace function public.admin_audit_record(
  p_action      text,
  p_outcome     text default 'success',
  p_target_type text default null,
  p_target_id   text default null,
  p_metadata    jsonb default '{}'::jsonb,
  p_ip_address  text default null,
  p_user_agent  text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_role  text;
  v_email text;
  v_id    uuid;
begin
  -- Writing an audit entry is itself a privileged act: an unauthenticated
  -- or non-admin caller must not be able to pollute the trail.
  perform public.admin_assert_access('viewer');

  select role into v_role
  from public.platform_admins
  where user_id = v_uid and status = 'active';

  select email into v_email from auth.users where id = v_uid;

  insert into public.admin_audit_log (
    actor_id, actor_email, actor_role, action, outcome,
    target_type, target_id, metadata, ip_address, user_agent
  )
  values (
    v_uid, v_email, v_role, p_action, p_outcome,
    p_target_type, p_target_id,
    coalesce(p_metadata, '{}'::jsonb),
    nullif(p_ip_address, '')::inet,
    nullif(p_user_agent, '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

/** Narrow door for recording a REFUSED admin access attempt.
 *
 *  admin_audit_record() requires the caller to already be an admin, which
 *  is right for actions — but the most security-relevant event in the log
 *  is a signed-in customer probing /admin, and that caller is by
 *  definition not an admin. So this function exists, and it is tightly
 *  boxed in:
 *
 *    * action and outcome are hard-coded — the caller cannot write an
 *      arbitrary entry, or forge a "success" that never happened;
 *    * the actor always comes from the JWT, never from a parameter;
 *    * one row per actor per 5 minutes, so an authenticated user cannot
 *      flood the log by reloading the URL.
 */
create or replace function public.admin_audit_record_denied(
  p_reason     text default null,
  p_path       text default null,
  p_ip_address text default null,
  p_user_agent text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_id    uuid;
begin
  -- Not signed in at all: there is no attributable actor, and an
  -- anonymous caller must not be able to write to this table.
  if v_uid is null then
    return null;
  end if;

  -- Already an admin? Then nothing was denied; do not write a misleading
  -- row. The caller uses platform_admin_context() to know which case it is.
  if public.platform_admin_is_admin() then
    return null;
  end if;

  -- Flood guard: at most one denied row per actor per 5 minutes.
  if exists (
    select 1 from public.admin_audit_log
    where actor_id = v_uid
      and action = 'admin.access.denied'
      and created_at > now() - interval '5 minutes'
  ) then
    return null;
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.admin_audit_log (
    actor_id, actor_email, actor_role, action, outcome,
    target_type, target_id, metadata, ip_address, user_agent
  )
  values (
    v_uid, v_email, null, 'admin.access.denied', 'denied',
    'platform_admin', v_uid::text,
    -- Both caller-supplied strings are bounded: this function is callable
    -- by any authenticated user and the table is append-only, so an
    -- unbounded column is a way to grow a log nobody can clean up.
    jsonb_build_object(
      'reason', left(nullif(p_reason, ''), 120),
      'path', left(nullif(p_path, ''), 200)
    ),
    nullif(p_ip_address, '')::inet,
    nullif(p_user_agent, '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- 6. SAFE COUNT HELPER
-- ------------------------------------------------------------
-- NOTE: an earlier revision of this migration had an
-- admin_safe_count(p_table text) helper here. It has been REMOVED.
--
-- It ran a SECURITY DEFINER dynamic COUNT against a caller-supplied
-- relation name. Its ACL was already locked down (EXECUTE revoked from
-- PUBLIC, anon, authenticated and service_role), but that made it a
-- latent footgun rather than a safe one: a single future
-- `grant execute ... to authenticated` would have turned it into an
-- arbitrary-table inspector executing as the function owner.
--
-- Every count the overview needs is now a plain, static query against a
-- fully qualified relation. There is no dynamic SQL left in this
-- migration, so there is nothing to accidentally expose.

-- ------------------------------------------------------------
-- 7. OVERVIEW — THE ONLY CROSS-TENANT AGGREGATE THE SHELL NEEDS
-- ------------------------------------------------------------
-- Every number here comes from a real table. Nothing is estimated and
-- nothing is synthesised:
--   * monetary fields are ABSENT on purpose — no payment provider is
--     connected (see /api/billing/upgrade → PAYMENT_PROVIDER_NOT_CONFIGURED),
--     so the UI shows "Not available" rather than a fabricated MRR;
--   * `activity.*` counts public.activities, which migration 015 fills
--     from a database trigger on task/project/goal changes. Application
--     code never writes to it, so the stream covers data mutations only —
--     the UI says exactly that instead of implying full instrumentation;
--   * `users.active_30d` is defined by auth.users.last_sign_in_at, and
--     the UI states that definition rather than implying "active in product".
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_users_total     bigint;
  v_users_confirmed bigint;
  v_users_new_7d    bigint;
  v_users_new_30d   bigint;
  v_users_active_30 bigint;
  v_users_orphans   bigint;
  v_ws_total        bigint;
  v_ws_new_7d       bigint;
  v_ws_new_30d      bigint;
  v_ws_no_owner     bigint;
  v_mem_total       bigint;
  v_mem_active      bigint;
  v_plan_free       bigint;
  v_plan_pro        bigint;
  v_plan_team       bigint;
  v_sub_active      bigint;
  v_sub_past_due    bigint;
  v_sub_trialing    bigint;
  v_tasks           bigint;
  v_tasks_open      bigint;
  v_tasks_blocked   bigint;
  v_tasks_done      bigint;
  v_goals           bigint;
  v_projects        bigint;
  v_notifications   bigint;
  v_act_total       bigint;
  v_act_7d          bigint;
  v_act_actors_30d  bigint;
  v_int_signals     bigint;
  v_int_missions    bigint;
  v_int_memory      bigint;
  v_result          jsonb;
begin
  perform public.admin_assert_access('viewer');

  select count(*) into v_users_total from auth.users;

  select count(*) into v_users_confirmed
  from auth.users where email_confirmed_at is not null;

  select count(*) into v_users_new_7d
  from auth.users where created_at >= now() - interval '7 days';

  select count(*) into v_users_new_30d
  from auth.users where created_at >= now() - interval '30 days';

  -- "Active" means GoTrue saw a sign-in in the window. It is not a
  -- measure of in-product activity (see public.activities below) and the
  -- UI states exactly this, rather than letting a reader assume more.
  select count(*) into v_users_active_30
  from auth.users where last_sign_in_at >= now() - interval '30 days';

  select count(*) into v_users_orphans
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);

  select count(*) into v_ws_total from public.workspaces;

  select count(*) into v_ws_new_7d
  from public.workspaces where created_at >= now() - interval '7 days';

  select count(*) into v_ws_new_30d
  from public.workspaces where created_at >= now() - interval '30 days';

  -- A workspace with no active owner membership cannot be opened by
  -- anyone: this is exactly the failure the bootstrap diagnostics log.
  select count(*) into v_ws_no_owner
  from public.workspaces w
  where not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = w.id and m.role = 'owner' and m.status = 'active'
  );

  select count(*) into v_mem_total from public.workspace_members;

  select count(*) into v_mem_active
  from public.workspace_members where status = 'active';

  -- Plan distribution. A workspace with no subscription row is FREE
  -- (the same rule get_workspace_plan() applies).
  select count(*) into v_plan_pro
  from public.workspace_subscriptions
  where plan = 'PRO' and status = 'active';

  select count(*) into v_plan_team
  from public.workspace_subscriptions
  where plan = 'TEAM' and status = 'active';

  select count(*) into v_plan_free
  from public.workspaces w
  where not exists (
    select 1 from public.workspace_subscriptions s
    where s.workspace_id = w.id and s.status = 'active'
      and s.plan in ('PRO','TEAM')
  );

  select count(*) into v_sub_active
  from public.workspace_subscriptions where status = 'active';

  select count(*) into v_sub_past_due
  from public.workspace_subscriptions where status = 'past_due';

  select count(*) into v_sub_trialing
  from public.workspace_subscriptions where status = 'trialing';

  select count(*) into v_tasks from public.tasks;

  select count(*) into v_tasks_open
  from public.tasks where status in ('todo','in_progress','in_review','blocked');

  select count(*) into v_tasks_blocked
  from public.tasks where status = 'blocked';

  select count(*) into v_tasks_done
  from public.tasks where status = 'done';

  select count(*) into v_goals   from public.goals;
  select count(*) into v_projects from public.projects;

  select count(*) into v_notifications
  from public.notifications where read_at is null;

  select count(*) into v_act_total from public.activities;

  select count(*) into v_act_7d
  from public.activities where created_at >= now() - interval '7 days';

  select count(distinct actor_id) into v_act_actors_30d
  from public.activities
  where created_at >= now() - interval '30 days' and actor_id is not null;

  -- Static counts, fully qualified. These tables are created by
  -- migrations 023-025, which ship in this repository; if a deployment is
  -- missing them the function fails loudly and the UI reports the
  -- platform as unavailable, which is the honest outcome.
  select count(*) into v_int_signals  from public.intelligence_signals;
  select count(*) into v_int_missions from public.intelligence_missions;
  select count(*) into v_int_memory   from public.intelligence_memory;

  v_result := jsonb_build_object(
    'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'users', jsonb_build_object(
      'total',           v_users_total,
      'email_confirmed', v_users_confirmed,
      'new_7d',          v_users_new_7d,
      'new_30d',         v_users_new_30d,
      'active_30d',      v_users_active_30,
      'without_profile', v_users_orphans
    ),
    'workspaces', jsonb_build_object(
      'total',                v_ws_total,
      'new_7d',               v_ws_new_7d,
      'new_30d',              v_ws_new_30d,
      'without_active_owner', v_ws_no_owner
    ),
    'memberships', jsonb_build_object(
      'total',  v_mem_total,
      'active', v_mem_active
    ),
    'plans', jsonb_build_object(
      'free',            v_plan_free,
      'pro',             v_plan_pro,
      'team',            v_plan_team,
      'active',          v_sub_active,
      'past_due',        v_sub_past_due,
      'trialing',        v_sub_trialing,
      -- No payment provider is connected, so there is no revenue to
      -- report. NULL, not 0: the UI must say "Not available".
      'mrr',             null,
      'currency',        null,
      'provider',        null
    ),
    'usage', jsonb_build_object(
      'projects',            v_projects,
      'goals',               v_goals,
      'tasks',               v_tasks,
      'tasks_open',          v_tasks_open,
      'tasks_blocked',       v_tasks_blocked,
      'tasks_done',          v_tasks_done,
      'notifications_unread', v_notifications,
      'intelligence_signals',  v_int_signals,
      'intelligence_missions', v_int_missions,
      'intelligence_memory',   v_int_memory
    ),
    'activity', jsonb_build_object(
      'events_total',        v_act_total,
      'events_7d',           v_act_7d,
      'distinct_actors_30d', v_act_actors_30d,
      -- True when the 015 triggers have produced rows. False means the
      -- stream is empty, which the UI reports as an honest empty state.
      'instrumented',        v_act_total > 0
    ),
    -- Computed here, not in the UI: the definition of "needs attention"
    -- is a data question and belongs next to the data.
    'needs_attention', (
      select coalesce(jsonb_agg(item), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', 'workspaces_without_owner',
          'severity', 'danger',
          'title', 'Workspaces without an active owner',
          'detail', 'Nobody can open these workspaces. Usually a failed bootstrap.',
          'count', count(*)
        ) as item
        from public.workspaces w
        where not exists (
          select 1 from public.workspace_members m
          where m.workspace_id = w.id and m.role = 'owner' and m.status = 'active'
        )
        having count(*) > 0

        union all

        select jsonb_build_object(
          'id', 'users_without_profile',
          'severity', 'warning',
          'title', 'Accounts without a profile row',
          'detail', 'The signup trigger did not create a profile. The app self-repairs on next load.',
          'count', count(*)
        )
        from auth.users u
        where not exists (select 1 from public.profiles p where p.id = u.id)
        having count(*) > 0

        union all

        select jsonb_build_object(
          'id', 'subscriptions_past_due',
          'severity', 'warning',
          'title', 'Subscriptions past due',
          'detail', 'Billing could not collect. No provider is connected yet, so this is normally empty.',
          'count', count(*)
        )
        from public.workspace_subscriptions where status = 'past_due'
        having count(*) > 0

        union all

        select jsonb_build_object(
          'id', 'activity_not_instrumented',
          'severity', 'info',
          'title', 'Activity stream is not instrumented',
          'detail', 'public.activities is empty. It is filled by the 015 triggers on task/project/goal changes, so an empty stream means no workspace has changed anything yet.',
          'count', 0
        )
        from public.activities
        having count(*) = 0
      ) as signals
    )
  );

  return v_result;
end;
$$;

-- ------------------------------------------------------------
-- 8. RECENT ACTIVITY — REAL ROWS ONLY
-- ------------------------------------------------------------
-- Assembled from rows that genuinely exist, newest first, with the
-- source table named in every entry so the UI never has to guess what it
-- is looking at. `activities` is included when it has rows.
create or replace function public.admin_recent_activity(p_limit int default 12)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 12), 50));
  v_items jsonb;
begin
  perform public.admin_assert_access('viewer');

  select coalesce(jsonb_agg(entry order by occurred_at desc), '[]'::jsonb)
  into v_items
  from (
    select jsonb_build_object(
             'id', 'user:' || u.id,
             'source', 'auth.users',
             'kind', 'account_created',
             'title', 'Account created',
             'subject', coalesce(u.email, u.id::text),
             'occurred_at', to_char(u.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           ) as entry,
           u.created_at as occurred_at
    from auth.users u
    union all
    select jsonb_build_object(
             'id', 'workspace:' || w.id,
             'source', 'workspaces',
             'kind', 'workspace_created',
             'title', 'Workspace created',
             'subject', w.name,
             'occurred_at', to_char(w.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           ),
           w.created_at
    from public.workspaces w
    union all
    select jsonb_build_object(
             'id', 'subscription:' || s.id,
             'source', 'workspace_subscriptions',
             'kind', 'subscription_changed',
             'title', 'Subscription ' || s.status,
             'subject', s.plan,
             'occurred_at', to_char(s.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           ),
           s.updated_at
    from public.workspace_subscriptions s
    union all
    select jsonb_build_object(
             'id', 'activity:' || a.id,
             'source', 'activities',
             'kind', coalesce(a.action, 'activity'),
             'title', coalesce(a.entity_type, 'Workspace activity'),
             'subject', coalesce(a.action, ''),
             'occurred_at', to_char(a.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           ),
           a.created_at
    from public.activities a
  ) as stream
  limit v_limit;

  return v_items;
end;
$$;

-- ------------------------------------------------------------
-- 9. GRANTS
-- ------------------------------------------------------------
-- `authenticated` only. `anon` gets nothing: an anonymous visitor must
-- not even be able to invoke these and learn that the surface exists.
-- Guarded by pg_roles so the same migration runs on a real project (which
-- has anon/authenticated/service_role) and in the PGlite test harness
-- (which only creates `authenticated`).
do $$
declare
  r      text;
  fn     text;
  target text;
begin
  foreach r in array array['public','anon','authenticated','service_role'] loop
    if r <> 'public' and not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;
    target := case when r = 'public' then 'PUBLIC' else quote_ident(r) end;
    foreach fn in array array[
      'public.platform_admin_is_admin()',
      'public.platform_admin_context()',
      'public.admin_role_rank(text)',
      'public.admin_assert_access(text)',
      'public.admin_overview()',
      'public.admin_recent_activity(int)',
      'public.admin_audit_record(text,text,text,text,jsonb,text,text)',
      'public.admin_audit_record_denied(text,text,text,text)',
      'public.admin_audit_reject_mutation()',
      'public.admin_audit_set_updated_at()'
    ] loop
      execute format('revoke all on function %s from %s', fn, target);
    end loop;
  end loop;
end $$;

-- The four doors a signed-in user may knock on. Every one of them checks
-- the caller before doing anything; the rest stay owner-only.
grant execute on function public.platform_admin_context()   to authenticated;
grant execute on function public.admin_overview()           to authenticated;
grant execute on function public.admin_recent_activity(int) to authenticated;
grant execute on function public.admin_audit_record(text, text, text, text, jsonb, text, text)
  to authenticated;
grant execute on function public.admin_audit_record_denied(text, text, text, text)
  to authenticated;

-- platform_admin_is_admin / admin_assert_access / admin_role_rank stay
-- owner-only: they are implementation details of the definer functions
-- above and must not be callable from PostgREST.

-- ============================================================
-- END 026
-- ============================================================
