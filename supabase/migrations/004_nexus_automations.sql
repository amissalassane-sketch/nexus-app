-- ============================================================
-- NEXUS
-- Migration 004: Automation Engine
-- Triggers / Conditions / Actions / Executions
-- ============================================================


-- ============================================================
-- 1. ENUMS
-- ============================================================

create type public.automation_status as enum (
  'active',
  'paused',
  'disabled'
);
create type public.automation_trigger_type as enum (
  'task_created',
  'task_updated',
  'task_completed',
  'task_overdue',
  'project_created',
  'project_updated',
  'project_completed',
  'note_created',
  'file_uploaded',
  'goal_updated',
  'schedule',
  'manual'
);
create type public.automation_action_type as enum (
  'create_task',
  'update_task',
  'create_notification',
  'create_note',
  'update_project',
  'create_event',
  'send_email',
  'run_ai',
  'webhook'
);
create type public.automation_execution_status as enum (
  'queued',
  'running',
  'success',
  'failed',
  'cancelled'
);
-- ============================================================
-- 2. AUTOMATIONS
-- ============================================================

create table public.automations (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  name text not null,

  description text,

  status public.automation_status
    not null default 'active',

  trigger_type public.automation_trigger_type not null,

  trigger_config jsonb not null default '{}'::jsonb,

  conditions jsonb not null default '[]'::jsonb,

  actions jsonb not null default '[]'::jsonb,

  run_count integer not null default 0,

  last_run_at timestamptz,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint automations_run_count_valid
    check (run_count >= 0)
);
-- ============================================================
-- 3. AUTOMATION EXECUTIONS
-- ============================================================

create table public.automation_executions (
  id uuid primary key default gen_random_uuid(),

  automation_id uuid not null
    references public.automations(id)
    on delete cascade,

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  status public.automation_execution_status
    not null default 'queued',

  trigger_payload jsonb not null default '{}'::jsonb,

  execution_result jsonb not null default '{}'::jsonb,

  error_message text,

  started_at timestamptz,

  completed_at timestamptz,

  created_at timestamptz not null default now()
);
-- ============================================================
-- 4. AUTOMATION SCHEDULES
-- ============================================================

create table public.automation_schedules (
  id uuid primary key default gen_random_uuid(),

  automation_id uuid not null
    references public.automations(id)
    on delete cascade,

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  cron_expression text not null,

  timezone text not null default 'UTC',

  next_run_at timestamptz,

  last_run_at timestamptz,

  enabled boolean not null default true,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);
-- ============================================================
-- 5. INDEXES
-- ============================================================

create index idx_automations_workspace
on public.automations(workspace_id);
create index idx_automations_status
on public.automations(
  workspace_id,
  status
);
create index idx_automations_trigger
on public.automations(
  workspace_id,
  trigger_type
);
create index idx_automation_executions_automation
on public.automation_executions(
  automation_id,
  created_at desc
);
create index idx_automation_executions_workspace
on public.automation_executions(
  workspace_id,
  created_at desc
);
create index idx_automation_schedules_next_run
on public.automation_schedules(
  enabled,
  next_run_at
);
-- ============================================================
-- 6. UPDATED_AT
-- ============================================================

create trigger automations_updated_at
before update on public.automations
for each row
execute function public.handle_updated_at();
create trigger automation_schedules_updated_at
before update on public.automation_schedules
for each row
execute function public.handle_updated_at();
-- ============================================================
-- 7. ENABLE RLS
-- ============================================================

alter table public.automations enable row level security;
alter table public.automation_executions enable row level security;
alter table public.automation_schedules enable row level security;
-- ============================================================
-- 8. AUTOMATION POLICIES
-- ============================================================

create policy "Members can view automations"
on public.automations
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create automations"
on public.automations
for insert
with check (
  auth.uid() = created_by
  and public.is_workspace_member(workspace_id)
);
create policy "Members can update automations"
on public.automations
for update
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can delete automations"
on public.automations
for delete
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 9. EXECUTION POLICIES
-- ============================================================

create policy "Members can view automation executions"
on public.automation_executions
for select
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 10. SCHEDULE POLICIES
-- ============================================================

create policy "Members can view automation schedules"
on public.automation_schedules
for select
using (
  public.is_workspace_member(workspace_id)
);
create policy "Members can create automation schedules"
on public.automation_schedules
for insert
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can update automation schedules"
on public.automation_schedules
for update
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);
create policy "Members can delete automation schedules"
on public.automation_schedules
for delete
using (
  public.is_workspace_member(workspace_id)
);
-- ============================================================
-- 11. CONDITION EVALUATOR
-- ============================================================

create or replace function public.evaluate_automation_conditions(
  target_conditions jsonb,
  payload jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  condition jsonb;
  field_name text;
  operator text;
  expected_value text;
  actual_value text;
begin

  if target_conditions is null
     or jsonb_array_length(target_conditions) = 0 then
    return true;
  end if;

  for condition in
    select value
    from jsonb_array_elements(target_conditions)
  loop

    field_name :=
      condition ->> 'field';

    operator :=
      condition ->> 'operator';

    expected_value :=
      condition ->> 'value';

    actual_value :=
      payload ->> field_name;

    if operator = 'equals'
       and actual_value <> expected_value then

      return false;

    elsif operator = 'not_equals'
       and actual_value = expected_value then

      return false;

    elsif operator = 'contains'
       and position(
         expected_value in coalesce(actual_value, '')
       ) = 0 then

      return false;

    elsif operator = 'exists'
       and actual_value is null then

      return false;

    end if;

  end loop;

  return true;

end;
$$;
-- ============================================================
-- 12. CREATE EXECUTION
-- ============================================================

create or replace function public.queue_automation(
  target_automation_id uuid,
  payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  automation_workspace uuid;
  execution_id uuid;
begin

  select workspace_id
  into automation_workspace
  from public.automations
  where id = target_automation_id
    and status = 'active';

  if automation_workspace is null then
    return null;
  end if;

  if not public.is_workspace_member(automation_workspace) then
    raise exception 'Access denied';
  end if;

  insert into public.automation_executions (
    automation_id,
    workspace_id,
    status,
    trigger_payload
  )
  values (
    target_automation_id,
    automation_workspace,
    'queued',
    payload
  )
  returning id into execution_id;

  return execution_id;

end;
$$;
-- ============================================================
-- 13. TRIGGER AUTOMATION DISCOVERY
-- ============================================================

create or replace function public.find_matching_automations(
  target_workspace_id uuid,
  target_trigger public.automation_trigger_type,
  payload jsonb
)
returns table (
  automation_id uuid,
  actions jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.actions
  from public.automations a
  where a.workspace_id = target_workspace_id
    and a.status = 'active'
    and a.trigger_type = target_trigger
    and public.evaluate_automation_conditions(
      a.conditions,
      payload
    );
$$;
-- ============================================================
-- 14. TASK AUTOMATION EVENT
-- ============================================================

create or replace function public.emit_task_automation_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  automation_record record;
  payload jsonb;
begin

  payload := jsonb_build_object(
    'task_id', new.id,
    'workspace_id', new.workspace_id,
    'project_id', new.project_id,
    'title', new.title,
    'status', new.status,
    'priority', new.priority,
    'assignee_id', new.assignee_id,
    'due_at', new.due_at
  );

  if tg_op = 'INSERT' then

    for automation_record in
      select *
      from public.find_matching_automations(
        new.workspace_id,
        'task_created',
        payload
      )
    loop

      insert into public.automation_executions (
        automation_id,
        workspace_id,
        status,
        trigger_payload
      )
      values (
        automation_record.automation_id,
        new.workspace_id,
        'queued',
        payload
      );

    end loop;

  elsif tg_op = 'UPDATE'
        and new.status = 'done'
        and old.status <> 'done' then

    for automation_record in
      select *
      from public.find_matching_automations(
        new.workspace_id,
        'task_completed',
        payload
      )
    loop

      insert into public.automation_executions (
        automation_id,
        workspace_id,
        status,
        trigger_payload
      )
      values (
        automation_record.automation_id,
        new.workspace_id,
        'queued',
        payload
      );

    end loop;

  elsif tg_op = 'UPDATE' then

    for automation_record in
      select *
      from public.find_matching_automations(
        new.workspace_id,
        'task_updated',
        payload
      )
    loop

      insert into public.automation_executions (
        automation_id,
        workspace_id,
        status,
        trigger_payload
      )
      values (
        automation_record.automation_id,
        new.workspace_id,
        'queued',
        payload
      );

    end loop;

  end if;

  return new;

end;
$$;
create trigger task_automation_events
after insert or update on public.tasks
for each row
execute function public.emit_task_automation_event();
-- ============================================================
-- 15. PROJECT AUTOMATION EVENT
-- ============================================================

create or replace function public.emit_project_automation_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  automation_record record;
  payload jsonb;
  target_trigger public.automation_trigger_type;
begin

  payload := jsonb_build_object(
    'project_id', new.id,
    'workspace_id', new.workspace_id,
    'name', new.name,
    'status', new.status,
    'progress', new.progress,
    'priority', new.priority
  );

  if tg_op = 'INSERT' then
    target_trigger := 'project_created';

  elsif new.status = 'completed'
        and old.status <> 'completed' then
    target_trigger := 'project_completed';

  else
    target_trigger := 'project_updated';
  end if;

  for automation_record in
    select *
    from public.find_matching_automations(
      new.workspace_id,
      target_trigger,
      payload
    )
  loop

    insert into public.automation_executions (
      automation_id,
      workspace_id,
      status,
      trigger_payload
    )
    values (
      automation_record.automation_id,
      new.workspace_id,
      'queued',
      payload
    );

  end loop;

  return new;

end;
$$;
create trigger project_automation_events
after insert or update on public.projects
for each row
execute function public.emit_project_automation_event();
-- ============================================================
-- 16. FILE AUTOMATION EVENT
-- ============================================================

create or replace function public.emit_file_automation_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  automation_record record;
  payload jsonb;
begin

  payload := jsonb_build_object(
    'file_id', new.id,
    'workspace_id', new.workspace_id,
    'project_id', new.project_id,
    'name', new.name,
    'mime_type', new.mime_type,
    'size_bytes', new.size_bytes
  );

  for automation_record in
    select *
    from public.find_matching_automations(
      new.workspace_id,
      'file_uploaded',
      payload
    )
  loop

    insert into public.automation_executions (
      automation_id,
      workspace_id,
      status,
      trigger_payload
    )
    values (
      automation_record.automation_id,
      new.workspace_id,
      'queued',
      payload
    );

  end loop;

  return new;

end;
$$;
create trigger file_automation_events
after insert on public.files
for each row
execute function public.emit_file_automation_event();
-- ============================================================
-- 17. AUTOMATION STATISTICS
-- ============================================================

create or replace function public.get_automation_stats(
  target_automation_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(

    'total_runs',
    count(*),

    'successful_runs',
    count(*) filter (
      where status = 'success'
    ),

    'failed_runs',
    count(*) filter (
      where status = 'failed'
    ),

    'queued_runs',
    count(*) filter (
      where status = 'queued'
    ),

    'last_run',
    max(created_at)

  )
  from public.automation_executions
  where automation_id = target_automation_id;
$$;
-- ============================================================
-- END
-- ============================================================;
