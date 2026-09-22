-- ============================================================
-- NEXUS
-- Migration 20260922130000: Context & Integration Platform
--
-- P0 of the platform mission. Four independent additions:
--
--   1. INTEGRATION CONNECTIONS + CREDENTIALS + SYNC RUNS
--      Real connection state per (workspace, provider). Provider
--      tokens are stored as AES-256-GCM ciphertext produced with a
--      key that exists only in the server environment
--      (NEXUS_INTEGRATION_ENCRYPTION_KEY). Even a workspace member
--      reading the raw row obtains ciphertext, never a usable token.
--
--   2. INTELLIGENCE REQUEST LOG
--      One row per Intelligence request (query / action / signals /
--      mission): provider, model, latency, outcome, tokens. This is
--      the only source the Admin "Intelligence health" panel reads —
--      no metric on that screen is estimated.
--
--   3. ADMIN HEALTH RPCs
--      admin_intelligence_health(), admin_integration_health(),
--      admin_automation_health() — additive companions to
--      admin_overview() (026) so a failure in one panel never blanks
--      the others. Same guard, same revocation discipline.
--
--   4. FILE PLAN LIMIT
--      files is a first-class domain now; enforce a per-plan file
--      count at the database boundary, like projects/tasks/goals.
-- ============================================================

-- ============================================================
-- 0. LOCAL updated_at helper
-- ============================================================
-- Migration 001 defines public.handle_updated_at(), but hardened test
-- fixtures and partial deployments may not have it. This migration
-- carries its own copy so its triggers never depend on another
-- migration's objects.

create or replace function public.nexus_context_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1. INTEGRATION CONNECTIONS
-- ============================================================

-- PostgreSQL has no `create type if not exists`; guard with a DO block
-- so re-application and partial states are safe.
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'integration_connection_state'
      and n.nspname = 'public'
  ) then
    create type public.integration_connection_state as enum (
      'connecting',
      'connected',
      'syncing',
      'stale',
      'error',
      'reauth_required'
    );
  end if;
end
$$;

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  -- Stable provider ids from src/lib/integrations/providers.ts
  -- (gmail, google-calendar, slack, notion, github, linear).
  provider_id text not null,

  state public.integration_connection_state
    not null default 'connecting',

  -- What the provider told us at connect time (e.g. "marie@example.com").
  -- Display only; never a secret.
  account_label text,

  -- OAuth scopes actually granted. Shown to the user on the
  -- Integrations page before and after connecting.
  scopes text[] not null default '{}',

  last_sync_at timestamptz,

  last_error text,
  last_error_code text,
  last_error_at timestamptz,

  connected_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One connection per provider per workspace. Connecting twice
  -- replaces, it never duplicates.
  unique (workspace_id, provider_id)
);

create index if not exists integration_connections_workspace_idx
  on public.integration_connections (workspace_id);

create trigger trg_integration_connections_updated_at
  before update on public.integration_connections
  for each row execute function public.nexus_context_touch_updated_at();

-- ============================================================
-- 2. INTEGRATION CREDENTIALS (server-held, encrypted)
-- ============================================================

create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),

  connection_id uuid not null
    references public.integration_connections(id)
    on delete cascade,

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  -- AES-256-GCM: iv:authTag:ciphertext, base64. The key lives only in
  -- the server environment. RLS lets members read the row (the server
  -- route reads it back through the user-scoped client because this
  -- application deliberately holds no service-role key), but a member
  -- reading it obtains ciphertext they cannot decrypt.
  encrypted_token text not null,

  encrypted_refresh_token text,

  token_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (connection_id)
);

create index if not exists integration_credentials_workspace_idx
  on public.integration_credentials (workspace_id);

create trigger trg_integration_credentials_updated_at
  before update on public.integration_credentials
  for each row execute function public.nexus_context_touch_updated_at();

-- ============================================================
-- 3. INTEGRATION SYNC RUNS (audit of every sync)
-- ============================================================

create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),

  connection_id uuid not null
    references public.integration_connections(id)
    on delete cascade,

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  provider_id text not null,

  status text not null
    check (status in ('running', 'success', 'partial', 'failed')),

  items_read integer not null default 0,
  items_created integer not null default 0,

  error_code text,
  error text,

  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists integration_sync_runs_workspace_idx
  on public.integration_sync_runs (workspace_id);
create index if not exists integration_sync_runs_started_idx
  on public.integration_sync_runs (started_at desc);

-- ============================================================
-- 4. RLS — connections & sync runs
-- ============================================================

alter table public.integration_connections enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.integration_sync_runs enable row level security;

-- Connections: members can see connection state, permissions and
-- errors of their own workspace integrations.
create policy "integration_connections_read_members"
  on public.integration_connections for select
  using (public.is_active_workspace_member(workspace_id));

create policy "integration_connections_write_members"
  on public.integration_connections for insert
  with check (public.is_active_workspace_member(workspace_id));

create policy "integration_connections_update_members"
  on public.integration_connections for update
  using (public.is_active_workspace_member(workspace_id))
  with check (public.is_active_workspace_member(workspace_id));

create policy "integration_connections_delete_members"
  on public.integration_connections for delete
  using (public.is_active_workspace_member(workspace_id));

-- Credentials: the row is readable inside the workspace because the
-- server reads it back through the user-scoped client — but the
-- payload is ciphertext. There is intentionally no policy that ever
-- returns a plaintext token.
create policy "integration_credentials_read_members"
  on public.integration_credentials for select
  using (public.is_active_workspace_member(workspace_id));

create policy "integration_credentials_write_members"
  on public.integration_credentials for insert
  with check (public.is_active_workspace_member(workspace_id));

create policy "integration_credentials_update_members"
  on public.integration_credentials for update
  using (public.is_active_workspace_member(workspace_id))
  with check (public.is_active_workspace_member(workspace_id));

-- Sync runs: read-only audit trail for members.
create policy "integration_sync_runs_read_members"
  on public.integration_sync_runs for select
  using (public.is_active_workspace_member(workspace_id));

-- Writes to sync runs happen server-side through the member-scoped
-- client during a sync, which is a member action by construction.
create policy "integration_sync_runs_insert_members"
  on public.integration_sync_runs for insert
  with check (public.is_active_workspace_member(workspace_id));

create policy "integration_sync_runs_update_members"
  on public.integration_sync_runs for update
  using (public.is_active_workspace_member(workspace_id))
  with check (public.is_active_workspace_member(workspace_id));

-- ============================================================
-- 5. INTELLIGENCE REQUEST LOG (AI observability)
-- ============================================================

create table if not exists public.intelligence_request_log (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  -- Which Intelligence surface produced the request.
  surface text not null default 'query'
    check (surface in ('query', 'action', 'signals', 'mission')),

  provider text not null
    check (provider in ('openai', 'anthropic', 'nexus-engine')),

  model text,

  intent_id text,

  latency_ms integer
    check (latency_ms is null or latency_ms >= 0),

  status text not null
    check (status in ('ok', 'error', 'fallback')),

  error_code text,

  input_tokens integer
    check (input_tokens is null or input_tokens >= 0),
  output_tokens integer
    check (output_tokens is null or output_tokens >= 0),

  created_at timestamptz not null default now()
);

create index if not exists intelligence_request_log_workspace_idx
  on public.intelligence_request_log (workspace_id);
create index if not exists intelligence_request_log_created_idx
  on public.intelligence_request_log (created_at desc);

alter table public.intelligence_request_log enable row level security;

-- Users can read their own request history (and nothing else).
create policy "intelligence_request_log_read_own"
  on public.intelligence_request_log for select
  using (
    user_id = auth.uid()
    and public.is_active_workspace_member(workspace_id)
  );

-- Only the server routes log requests, always as the calling user.
create policy "intelligence_request_log_insert_own"
  on public.intelligence_request_log for insert
  with check (
    user_id = auth.uid()
    and public.is_active_workspace_member(workspace_id)
  );

-- ============================================================
-- 6. FILE PLAN LIMIT
-- ============================================================
-- get_plan_limit is recreated with the values that were already
-- synced by migration 008 (identical to PLAN_LIMITS in
-- src/lib/plan-limits.ts) plus the new 'files' resource. Only the
-- 'files' case is new; every other value is carried over verbatim
-- so this migration cannot drift the existing contract.

create or replace function public.get_plan_limit(p_plan text, p_resource text)
returns integer
language plpgsql
immutable
security definer
set search_path = public, pg_temp
as $$
begin
  case p_plan
    when 'FREE' then
      case p_resource
        when 'projects'     then return 2;
        when 'active_tasks' then return 100;
        when 'goals'        then return 3;
        when 'members'      then return 1;
        when 'workspaces'   then return 1;
        when 'files'        then return 20;
        else return 0;
      end case;
    when 'PRO' then
      case p_resource
        when 'projects'     then return 10;
        when 'active_tasks' then return 1000;
        when 'goals'        then return 20;
        when 'members'      then return 5;
        when 'workspaces'   then return 5;
        when 'files'        then return 200;
        else return 0;
      end case;
    when 'TEAM' then
      case p_resource
        when 'projects'     then return 50;
        when 'active_tasks' then return 5000;
        when 'goals'        then return 100;
        when 'members'      then return 20;
        when 'workspaces'   then return 20;
        when 'files'        then return 1000;
        else return 0;
      end case;
    else
      return 0;
  end case;
end;
$$;

create or replace function public.enforce_file_limit()
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
  v_plan  := public.get_workspace_plan(NEW.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'files');
  select count(*) into v_count
    from public.files
    where workspace_id = NEW.workspace_id;
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: files (% / %). Upgrade to upload more.', v_count, v_limit
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

-- The files table exists on every real project (migration 001), but
-- hardened fixtures may not carry it. Guard so this migration applies
-- either way; when the table is absent there is nothing to enforce.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_tables
    where schemaname = 'public' and tablename = 'files'
  ) then
    execute 'drop trigger if exists trg_enforce_file_limit on public.files';
    execute 'create trigger trg_enforce_file_limit
      before insert on public.files
      for each row
      execute function public.enforce_file_limit()';
  end if;
end
$$;

-- ============================================================
-- 7. ADMIN HEALTH RPCs (additive companions to admin_overview)
-- ============================================================
-- Same discipline as migration 026: SECURITY DEFINER, re-check the
-- caller inside the function, return nulls when nothing was measured
-- (null ≠ 0), and revoke EXECUTE from everyone but authenticated.

-- 7a. Intelligence health ------------------------------------------------
create or replace function public.admin_intelligence_health()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_requests_24h  bigint;
  v_requests_30d  bigint;
  v_errors_24h    bigint;
  v_fallbacks_24h bigint;
  v_latency_avg   numeric;
  v_users_7d      bigint;
  v_tokens_in_30d bigint;
  v_tokens_out_30d bigint;
  v_first_at      timestamptz;
  v_last_at       timestamptz;
begin
  if not public.platform_admin_is_admin() then
    raise exception 'ADMIN_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  select
    count(*) filter (where created_at > now() - interval '24 hours'),
    count(*) filter (where created_at > now() - interval '30 days'),
    count(*) filter (where status = 'error' and created_at > now() - interval '24 hours'),
    count(*) filter (where status = 'fallback' and created_at > now() - interval '24 hours'),
    avg(latency_ms) filter (where created_at > now() - interval '24 hours'),
    count(distinct user_id) filter (where created_at > now() - interval '7 days'),
    coalesce(sum(input_tokens) filter (where created_at > now() - interval '30 days'), 0),
    coalesce(sum(output_tokens) filter (where created_at > now() - interval '30 days'), 0),
    min(created_at),
    max(created_at)
  into
    v_requests_24h, v_requests_30d, v_errors_24h, v_fallbacks_24h,
    v_latency_avg, v_users_7d, v_tokens_in_30d, v_tokens_out_30d,
    v_first_at, v_last_at
  from public.intelligence_request_log;

  v_result := jsonb_build_object(
    'generated_at', now(),
    'requests_24h', v_requests_24h,
    'requests_30d', v_requests_30d,
    'errors_24h', v_errors_24h,
    'fallbacks_24h', v_fallbacks_24h,
    'avg_latency_ms_24h', case when v_latency_avg is null then null else round(v_latency_avg) end,
    'distinct_users_7d', v_users_7d,
    'input_tokens_30d', v_tokens_in_30d,
    'output_tokens_30d', v_tokens_out_30d,
    'first_request_at', v_first_at,
    'last_request_at', v_last_at
  );

  return v_result;
end;
$$;

-- 7b. Integration health -------------------------------------------------
create or replace function public.admin_integration_health()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_result       jsonb;
  v_total        bigint;
  v_connected    bigint;
  v_syncing      bigint;
  v_stale        bigint;
  v_error        bigint;
  v_reauth       bigint;
  v_last_sync    timestamptz;
  v_failed_runs  bigint;
begin
  if not public.platform_admin_is_admin() then
    raise exception 'ADMIN_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (where state = 'connected'),
    count(*) filter (where state = 'syncing'),
    count(*) filter (where state = 'stale'),
    count(*) filter (where state = 'error'),
    count(*) filter (where state = 'reauth_required'),
    max(last_sync_at)
  into
    v_total, v_connected, v_syncing, v_stale, v_error, v_reauth, v_last_sync
  from public.integration_connections;

  select count(*)
  into v_failed_runs
  from public.integration_sync_runs
  where status = 'failed'
    and started_at > now() - interval '7 days';

  v_result := jsonb_build_object(
    'generated_at', now(),
    'connections', jsonb_build_object(
      'total', v_total,
      'connected', v_connected,
      'syncing', v_syncing,
      'stale', v_stale,
      'error', v_error,
      'reauth_required', v_reauth
    ),
    'last_sync_at', v_last_sync,
    'failed_sync_runs_7d', v_failed_runs
  );

  return v_result;
end;
$$;

-- 7c. Automation health ----------------------------------------------------
-- Resilient to a database where the automations tables (migration 004,
-- which depends on the 003 AI extension) were never applied: the panel
-- then reports installed=false and nulls instead of erroring. An absent
-- subsystem is "not installed", not a failed read.
create or replace function public.admin_automation_health()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_result          jsonb;
  v_total           bigint;
  v_active          bigint;
  v_paused          bigint;
  v_disabled        bigint;
  v_exec_total      bigint;
  v_exec_success_24h bigint;
  v_exec_failed_24h  bigint;
  v_exec_success_7d  bigint;
  v_exec_failed_7d   bigint;
  v_exec_queued      bigint;
  v_last_exec_at     timestamptz;
begin
  if not public.platform_admin_is_admin() then
    raise exception 'ADMIN_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  -- Constant table names only — never caller-supplied (SECURITY-ADMIN-03).
  if not exists (
    select 1 from pg_catalog.pg_tables
    where schemaname = 'public' and tablename = 'automations'
  ) or not exists (
    select 1 from pg_catalog.pg_tables
    where schemaname = 'public' and tablename = 'automation_executions'
  ) then
    return jsonb_build_object(
      'generated_at', now(),
      'installed', false,
      'automations', jsonb_build_object(
        'total', null, 'active', null, 'paused', null, 'disabled', null
      ),
      'executions', jsonb_build_object(
        'total', null, 'success_24h', null, 'failed_24h', null,
        'success_7d', null, 'failed_7d', null, 'queued', null,
        'last_execution_at', null
      )
    );
  end if;

  select
    count(*),
    count(*) filter (where status = 'active'),
    count(*) filter (where status = 'paused'),
    count(*) filter (where status = 'disabled')
  into v_total, v_active, v_paused, v_disabled
  from public.automations;

  select
    count(*),
    count(*) filter (where status = 'success' and created_at > now() - interval '24 hours'),
    count(*) filter (where status = 'failed' and created_at > now() - interval '24 hours'),
    count(*) filter (where status = 'success' and created_at > now() - interval '7 days'),
    count(*) filter (where status = 'failed' and created_at > now() - interval '7 days'),
    count(*) filter (where status = 'queued'),
    max(created_at)
  into
    v_exec_total, v_exec_success_24h, v_exec_failed_24h,
    v_exec_success_7d, v_exec_failed_7d, v_exec_queued, v_last_exec_at
  from public.automation_executions;

  v_result := jsonb_build_object(
    'generated_at', now(),
    'installed', true,
    'automations', jsonb_build_object(
      'total', v_total,
      'active', v_active,
      'paused', v_paused,
      'disabled', v_disabled
    ),
    'executions', jsonb_build_object(
      'total', v_exec_total,
      'success_24h', v_exec_success_24h,
      'failed_24h', v_exec_failed_24h,
      'success_7d', v_exec_success_7d,
      'failed_7d', v_exec_failed_7d,
      'queued', v_exec_queued,
      'last_execution_at', v_last_exec_at
    )
  );

  return v_result;
end;
$$;

-- 7d. Grants ---------------------------------------------------------------
-- Same revocation loop discipline as 026: nothing executable by
-- anon/public, and the three panels callable by authenticated users
-- (each re-checks platform admin internally).
do $$
declare
  r text;
  target text;
  fn text;
begin
  foreach r in array array['anon', 'authenticated', 'public'] loop
    if r <> 'public' and not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;
    target := case when r = 'public' then 'PUBLIC' else quote_ident(r) end;
    foreach fn in array array[
      'public.admin_intelligence_health()',
      'public.admin_integration_health()',
      'public.admin_automation_health()'
    ] loop
      execute format('revoke all on function %s from %s', fn, target);
    end loop;
  end loop;
end $$;

grant execute on function public.admin_intelligence_health() to authenticated;
grant execute on function public.admin_integration_health() to authenticated;
grant execute on function public.admin_automation_health() to authenticated;
