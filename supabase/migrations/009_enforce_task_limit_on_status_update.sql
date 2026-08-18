-- ============================================================
-- 009. ENFORCE ACTIVE TASK LIMIT ON STATUS UPDATES
-- Prevents bypassing FREE/PRO/TEAM active task limits by
-- reopening done/cancelled tasks through direct Supabase access.
-- ============================================================

create or replace function public.enforce_task_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  if new.status in ('done', 'cancelled') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.workspace_id = new.workspace_id
     and old.status not in ('done', 'cancelled') then
    return new;
  end if;

  v_plan  := public.get_workspace_plan(new.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'active_tasks');

  select count(*) into v_count
    from public.tasks
    where workspace_id = new.workspace_id
      and status not in ('done', 'cancelled')
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: active_tasks (% / %). Upgrade to unlock more.', v_count, v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_task_limit on public.tasks;
create trigger trg_enforce_task_limit
  before insert or update of status, workspace_id on public.tasks
  for each row
  execute function public.enforce_task_limit();

-- ============================================================
-- END 009
-- ============================================================
