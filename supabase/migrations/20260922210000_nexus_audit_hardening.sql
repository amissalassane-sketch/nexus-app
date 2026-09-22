-- Additive hardening. No rows deleted, no existing migration rewritten.
-- Deployment fails explicitly if old cross-workspace links exist; investigate
-- those rows before retrying. Never silently reassign their workspace.
begin;

-- Bounded sync telemetry; no tokens, provider payloads or content.
alter table public.integration_sync_runs
  add column request_id uuid not null default gen_random_uuid(),
  add column duration_ms integer check (duration_ms is null or duration_ms >= 0),
  add column retry_count integer not null default 0 check (retry_count >= 0);

alter table public.integration_connections
  add constraint integration_connections_id_workspace_unique unique (id, workspace_id);
alter table public.integration_credentials
  add constraint integration_credentials_connection_workspace_fk
  foreign key (connection_id, workspace_id)
  references public.integration_connections(id, workspace_id) on delete cascade;
alter table public.integration_sync_runs
  add constraint integration_sync_runs_connection_workspace_fk
  foreign key (connection_id, workspace_id)
  references public.integration_connections(id, workspace_id) on delete cascade;

-- Legacy SECURITY DEFINER queue/AI helpers have no actor check. Restrict
-- execution to a trusted worker role; none is called by the product client.
-- Optional subsystems may not be installed in reconciled deployments.
do $$
declare fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
      'create_worker_job', 'claim_next_worker_job', 'complete_worker_job',
      'fail_worker_job', 'expand_automation_execution', 'recover_stuck_worker_jobs',
      'get_worker_stats', 'find_matching_automations',
      'get_automation_stats', 'cleanup_expired_ai_memories'
    ])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- Unknown token measurements are not zero usage.
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
    sum(input_tokens) filter (where created_at > now() - interval '30 days'),
    sum(output_tokens) filter (where created_at > now() - interval '30 days'),
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


commit;
