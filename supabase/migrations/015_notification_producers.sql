-- ============================================================
-- 015. NOTIFICATION PRODUCERS (P8 — §17)
--
-- Until now NOTHING wrote to `notifications`: the inbox stayed
-- empty in production. This migration adds the producers, on
-- USEFUL events only:
--   • task blocked                → "project no longer moves" (trigger)
--   • project milestone 25/50/75  → progress signal           (trigger)
--   • task overdue                → time-based, refresh RPC
--   • goal at risk                → time-based, refresh RPC
--   • plan limit ≥ 80 %           → usage signal,  refresh RPC
-- Plus useful activities (task completed, milestone crossed).
-- NO noise like "X edited Y".
--
-- Rules:
--   • every trigger body is exception-guarded — a notification
--     failure must NEVER break the user's write;
--   • dedup: a new notification is skipped while an UNREAD one of
--     the same (user, type, entity) already exists;
--   • idempotent DDL (information_schema / drop-if-exists guards).
-- ============================================================

-- ------------------------------------------------------------
-- 0. notifications gains severity + action (nullable)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'severity'
  ) then
    alter table public.notifications add column severity text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'action'
  ) then
    alter table public.notifications add column action text;
  end if;
end
$$;

-- ------------------------------------------------------------
-- 1. log_activity() — useful activities only
-- ------------------------------------------------------------
create or replace function public.log_activity(
  p_workspace_id uuid,
  p_action       text,
  p_entity_type  text,
  p_metadata     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activities (workspace_id, action, entity_type, metadata)
  values (p_workspace_id, p_action, p_entity_type, coalesce(p_metadata, '{}'::jsonb));
exception
  when others then
    raise warning 'log_activity failed: %', sqlerrm;
end;
$$;

-- ------------------------------------------------------------
-- 2. notify_workspace() — deduplicated, actionable
--    Returns the number of notifications actually inserted.
-- ------------------------------------------------------------
create or replace function public.notify_workspace(
  p_workspace_id uuid,
  p_type         text,
  p_title        text,
  p_message      text,
  p_entity_type  text,
  p_entity_id    text,
  p_severity     text default 'info',
  p_action       text default 'Review'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_member record;
  v_entity uuid;
begin
  -- Normalize the entity id (empty string → NULL); valid uuids only.
  if p_entity_id is not null and p_entity_id <> ''
     and p_entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_entity := p_entity_id::uuid;
  end if;

  for v_member in
    select user_id
      from public.workspace_members
     where workspace_id = p_workspace_id
       and status = 'active'
  loop
    -- Dedup: skip while an UNREAD notification of the same shape exists.
    if exists (
      select 1 from public.notifications
       where user_id = v_member.user_id
         and type = p_type
         and coalesce(entity_id::text, '') = coalesce(p_entity_id, '')
         and read_at is null
    ) then
      continue;
    end if;

    insert into public.notifications (
      workspace_id, user_id, type, title, message,
      entity_type, entity_id, severity, action
    )
    values (
      p_workspace_id, v_member.user_id, p_type, p_title, p_message,
      nullif(p_entity_type, ''), v_entity, p_severity, p_action
    );

    v_count := v_count + 1;
  end loop;

  return v_count;

exception
  when others then
    raise warning 'notify_workspace failed (%): %', p_type, sqlerrm;
    return v_count;
end;
$$;

-- ------------------------------------------------------------
-- 3. Tasks: blocked → the project no longer moves.
--    done → useful activity (no notification, no noise).
-- ------------------------------------------------------------
create or replace function public.on_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_name text;
  v_inserted integer;
begin
  -- Blocked: entering the blocked state (insert-as-blocked or update into it)
  if NEW.status = 'blocked' and (tg_op = 'INSERT' or OLD.status <> 'blocked') then
    select name into v_project_name
      from public.projects
     where id = NEW.project_id;

    if NEW.project_id is not null and v_project_name is not null then
      v_inserted := public.notify_workspace(
        NEW.workspace_id,
        'project_blocked',
        v_project_name || ' no longer moves',
        'The task «' || NEW.title || '» is blocked. A blocked project needs a decision, not more work.',
        'project',
        NEW.project_id::text,
        'warning',
        'Reschedule'
      );
    else
      v_inserted := public.notify_workspace(
        NEW.workspace_id,
        'task_blocked',
        'Task blocked: ' || NEW.title,
        '«' || NEW.title || '» is blocked — either drop it or clear what blocks it.',
        'task',
        NEW.id::text,
        'warning',
        'Review'
      );
    end if;
  end if;

  -- Completed: one useful activity, never a notification.
  if NEW.status = 'done' and tg_op = 'UPDATE' and OLD.status <> 'done' then
    perform public.log_activity(
      NEW.workspace_id,
      'completed',
      'task',
      jsonb_build_object('title', NEW.title)
    );
  end if;

  return NEW;

exception
  when others then
    raise warning 'on_task_status_change failed: %', sqlerrm;
    return NEW;
end;
$$;

drop trigger if exists trg_task_status_notifications on public.tasks;
create trigger trg_task_status_notifications
  after insert or update of status on public.tasks
  for each row
  execute function public.on_task_status_change();

-- ------------------------------------------------------------
-- 4. Projects: milestone crossed (25 / 50 / 75 / 100 %)
-- ------------------------------------------------------------
create or replace function public.on_project_progress_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_m integer;
  v_new_m integer;
begin
  if tg_op <> 'UPDATE' then
    return NEW;
  end if;

  v_old_m := case
    when coalesce(OLD.progress, 0) >= 100 then 100
    when coalesce(OLD.progress, 0) >= 75 then 75
    when coalesce(OLD.progress, 0) >= 50 then 50
    when coalesce(OLD.progress, 0) >= 25 then 25
    else 0
  end;

  v_new_m := case
    when coalesce(NEW.progress, 0) >= 100 then 100
    when coalesce(NEW.progress, 0) >= 75 then 75
    when coalesce(NEW.progress, 0) >= 50 then 50
    when coalesce(NEW.progress, 0) >= 25 then 25
    else 0
  end;

  if v_new_m > v_old_m and v_new_m > 0 then
    perform public.log_activity(
      NEW.workspace_id,
      'milestone',
      'project',
      jsonb_build_object('name', NEW.name, 'milestone', v_new_m)
    );

    perform public.notify_workspace(
      NEW.workspace_id,
      'project_milestone',
      NEW.name || ' reached ' || v_new_m || '%',
      case v_new_m
        when 100 then '«' || NEW.name || '» is complete. Worth a look back before the next one starts.'
        else '«' || NEW.name || '» crossed the ' || v_new_m || '% mark — steady advance.'
      end,
      'project',
      NEW.id::text,
      'info',
      'Review'
    );
  end if;

  return NEW;

exception
  when others then
    raise warning 'on_project_progress_change failed: %', sqlerrm;
    return NEW;
end;
$$;

drop trigger if exists trg_project_milestone on public.projects;
create trigger trg_project_milestone
  after update of progress on public.projects
  for each row
  execute function public.on_project_progress_change();

-- ------------------------------------------------------------
-- 5. refresh_workspace_signals() — time-based signals.
--    Called by the application when intelligence data is
--    collected (dashboard / /intelligence visits).
--    Returns the number of notifications inserted.
-- ------------------------------------------------------------
create or replace function public.refresh_workspace_signals(
  p_workspace_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count   integer := 0;
  v_added   integer := 0;
  v_task    record;
  v_goal    record;
  v_plan    text;
  v_limit   integer;
  v_used    integer;
  v_days    integer;
  v_resource text;
begin
  -- Security: caller must be an active member of this workspace.
  if not exists (
    select 1 from public.workspace_members
     where workspace_id = p_workspace_id
       and user_id = auth.uid()
       and status = 'active'
  ) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  -- 5a. Overdue tasks (active, due in the past), oldest first.
  for v_task in
    select id, title, due_at
      from public.tasks
     where workspace_id = p_workspace_id
       and status not in ('done', 'cancelled')
       and due_at is not null
       and due_at < now()
     order by due_at asc
     limit 50
  loop
    v_count := v_count + public.notify_workspace(
      p_workspace_id,
      'task_overdue',
      'Task overdue: ' || v_task.title,
      '«' || v_task.title || '» passed its due date '
        || to_char(v_task.due_at, 'Mon DD') || ' and is still active.',
      'task',
      v_task.id::text,
      'critical',
      'Reschedule'
    );
  end loop;

  -- 5b. Goals at risk: deadline within 14 days and progression low.
  for v_goal in
    select id, title, progress, target_date
      from public.goals
     where workspace_id = p_workspace_id
       and status = 'active'
       and target_date is not null
       and target_date >= now()
       and target_date < now() + interval '14 days'
       and (
         (target_date < now() + interval '7 days' and coalesce(progress, 0) < 70)
         or coalesce(progress, 0) < 50
       )
  loop
    v_days := greatest(0, extract(day from (v_goal.target_date - now()))::int);
    v_count := v_count + public.notify_workspace(
      p_workspace_id,
      'goal_at_risk',
      'Goal at risk: ' || v_goal.title,
      coalesce(v_goal.progress, 0) || '% done with '
        || case when v_days = 0 then 'the deadline today' else v_days || ' day(s) left' end
        || ' — the current pace will miss it.',
      'goal',
      v_goal.id::text,
      'warning',
      'Review'
    );
  end loop;

  -- 5c. Plan limit approaching (≥ 80 %, not yet at 100 %).
  v_plan := public.get_workspace_plan(p_workspace_id);

  foreach v_resource in array array['projects', 'active_tasks', 'goals']
  loop
    v_limit := public.get_plan_limit(v_plan, v_resource);

    if v_resource = 'projects' then
      select count(*) into v_used from public.projects
        where workspace_id = p_workspace_id;
    elsif v_resource = 'active_tasks' then
      select count(*) into v_used from public.tasks
        where workspace_id = p_workspace_id
          and status not in ('done', 'cancelled');
    else
      select count(*) into v_used from public.goals
        where workspace_id = p_workspace_id;
    end if;

    if v_limit > 0 and v_used * 100 >= v_limit * 80 and v_used < v_limit then
      v_count := v_count + public.notify_workspace(
        p_workspace_id,
        'plan_limit',
        'Approaching your ' || v_plan || ' limit: ' || v_resource,
        v_used || ' of ' || v_limit || ' ' || v_resource || ' used ('
          || round(v_used * 100.0 / v_limit) || '%). The next one after that needs an upgrade.',
        'workspace',
        p_workspace_id::text,
        'warning',
        'Review'
      );
    end if;
  end loop;

  return v_count;

exception
  when others then
    raise warning 'refresh_workspace_signals failed: %', sqlerrm;
    return v_count;
end;
$$;

-- ============================================================
-- END 015
-- ============================================================
