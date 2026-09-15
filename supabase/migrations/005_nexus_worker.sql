-- ============================================================
-- NEXUS
-- Migration 005: Worker / Action Engine
-- ============================================================

create type public.worker_job_status as enum (
  'queued',
  'running',
  'success',
  'failed',
  'retrying',
  'cancelled'
);
-- ============================================================
-- 1. WORKER JOBS
-- ============================================================

create table public.worker_jobs (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  automation_id uuid
    references public.automations(id)
    on delete set null,

  execution_id uuid
    references public.automation_executions(id)
    on delete set null,

  action_type public.automation_action_type not null,

  payload jsonb not null default '{}'::jsonb,

  status public.worker_job_status
    not null default 'queued',

  attempts integer not null default 0,

  max_attempts integer not null default 3,

  available_at timestamptz not null default now(),

  started_at timestamptz,

  completed_at timestamptz,

  error_message text,

  result jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint worker_attempts_valid
    check (attempts >= 0),

  constraint worker_max_attempts_valid
    check (max_attempts > 0)
);
-- ============================================================
-- 2. WORKER JOB INDEXES
-- ============================================================

create index idx_worker_jobs_queue
on public.worker_jobs(
  status,
  available_at
);
create index idx_worker_jobs_workspace
on public.worker_jobs(
  workspace_id,
  created_at desc
);
create index idx_worker_jobs_execution
on public.worker_jobs(execution_id);
-- ============================================================
-- 3. UPDATED AT
-- ============================================================

create trigger worker_jobs_updated_at
before update on public.worker_jobs
for each row
execute function public.handle_updated_at();
-- ============================================================
-- 4. ENABLE RLS
-- ============================================================

alter table public.worker_jobs enable row level security;
create policy "Members can view worker jobs"
on public.worker_jobs
for select
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 5. CREATE WORKER JOB
-- ============================================================

create or replace function public.create_worker_job(
  target_execution_id uuid,
  target_action public.automation_action_type,
  target_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  job_id uuid;
begin

  select workspace_id
  into target_workspace
  from public.automation_executions
  where id = target_execution_id;

  if target_workspace is null then
    raise exception 'Execution not found';
  end if;

  insert into public.worker_jobs (
    workspace_id,
    automation_id,
    execution_id,
    action_type,
    payload
  )
  select
    target_workspace,
    automation_id,
    target_execution_id,
    target_action,
    target_payload
  from public.automation_executions
  where id = target_execution_id
  returning id into job_id;

  return job_id;

end;
$$;
-- ============================================================
-- 6. CLAIM NEXT JOB
-- ============================================================

create or replace function public.claim_next_worker_job()
returns public.worker_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_job public.worker_jobs;
begin

  update public.worker_jobs
  set
    status = 'running',
    attempts = attempts + 1,
    started_at = now(),
    updated_at = now()
  where id = (
    select id
    from public.worker_jobs
    where status in ('queued', 'retrying')
      and available_at <= now()
      and attempts < max_attempts
    order by created_at
    for update skip locked
    limit 1
  )
  returning *
  into claimed_job;

  return claimed_job;

end;
$$;
-- ============================================================
-- 7. COMPLETE JOB
-- ============================================================

create or replace function public.complete_worker_job(
  target_job_id uuid,
  target_result jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_execution uuid;
begin

  update public.worker_jobs
  set
    status = 'success',
    result = target_result,
    completed_at = now(),
    updated_at = now()
  where id = target_job_id
  returning execution_id
  into target_execution;

  if target_execution is not null then

    update public.automation_executions
    set
      status = 'success',
      execution_result = target_result,
      completed_at = now()
    where id = target_execution;

  end if;

end;
$$;
-- ============================================================
-- 8. FAIL JOB
-- ============================================================

create or replace function public.fail_worker_job(
  target_job_id uuid,
  target_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_attempts integer;
  current_max_attempts integer;
  target_execution uuid;
begin

  select
    attempts,
    max_attempts,
    execution_id
  into
    current_attempts,
    current_max_attempts,
    target_execution
  from public.worker_jobs
  where id = target_job_id;

  if current_attempts < current_max_attempts then

    update public.worker_jobs
    set
      status = 'retrying',
      error_message = target_error,
      available_at = now() + interval '30 seconds',
      updated_at = now()
    where id = target_job_id;

  else

    update public.worker_jobs
    set
      status = 'failed',
      error_message = target_error,
      completed_at = now(),
      updated_at = now()
    where id = target_job_id;

    if target_execution is not null then

      update public.automation_executions
      set
        status = 'failed',
        error_message = target_error,
        completed_at = now()
      where id = target_execution;

    end if;

  end if;

end;
$$;
-- ============================================================
-- 9. CONVERT AUTOMATION ACTIONS INTO JOBS
-- ============================================================

create or replace function public.expand_automation_execution(
  target_execution_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  execution_record record;
  action jsonb;
  created_count integer := 0;
begin

  select *
  into execution_record
  from public.automation_executions
  where id = target_execution_id;

  if execution_record.id is null then
    raise exception 'Execution not found';
  end if;

  for action in
    select value
    from jsonb_array_elements(
      (
        select actions
        from public.automations
        where id = execution_record.automation_id
      )
    )
  loop

    insert into public.worker_jobs (
      workspace_id,
      automation_id,
      execution_id,
      action_type,
      payload
    )
    values (
      execution_record.workspace_id,
      execution_record.automation_id,
      execution_record.id,
      (action ->> 'type')::public.automation_action_type,
      action
    );

    created_count := created_count + 1;

  end loop;

  update public.automation_executions
  set status = 'running'
  where id = target_execution_id;

  return created_count;

end;
$$;
-- ============================================================
-- 10. RECOVER STUCK JOBS
-- ============================================================

create or replace function public.recover_stuck_worker_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_count integer;
begin

  update public.worker_jobs
  set
    status = 'retrying',
    available_at = now(),
    updated_at = now()
  where status = 'running'
    and started_at < now() - interval '10 minutes';

  get diagnostics recovered_count = row_count;

  return recovered_count;

end;
$$;
-- ============================================================
-- 11. WORKER STATISTICS
-- ============================================================

create or replace function public.get_worker_stats(
  target_workspace_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(

    'queued',
    count(*) filter (
      where status = 'queued'
    ),

    'running',
    count(*) filter (
      where status = 'running'
    ),

    'success',
    count(*) filter (
      where status = 'success'
    ),

    'failed',
    count(*) filter (
      where status = 'failed'
    ),

    'retrying',
    count(*) filter (
      where status = 'retrying'
    )

  )
  from public.worker_jobs
  where workspace_id = target_workspace_id;
$$;
-- ============================================================
-- END
-- ============================================================;
