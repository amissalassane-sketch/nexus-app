-- ============================================================
-- 011. ENFORCE WORKSPACE LIMIT SERVER-SIDE
-- The FREE/PRO/TEAM `workspaces` limit already existed in
-- get_plan_limit() and in src/lib/plan-limits.ts, but nothing stopped a
-- client from inserting extra workspaces directly through Supabase.
-- This migration closes that bypass. Values are NOT changed here:
-- they keep coming from get_plan_limit() (008).
-- ============================================================

-- Highest plan owned by a user across their active subscriptions.
-- A user upgrading one workspace unlocks their workspace allowance.
create or replace function public.get_owner_plan(p_owner_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.plan
      from public.workspace_subscriptions s
      join public.workspaces w on w.id = s.workspace_id
      where w.owner_id = p_owner_id
        and s.status = 'active'
      order by case s.plan
                 when 'TEAM' then 3
                 when 'PRO'  then 2
                 else 1
               end desc
      limit 1
    ),
    'FREE'
  );
$$;

create or replace function public.enforce_workspace_limit()
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
  if NEW.owner_id is null then
    return NEW;
  end if;

  v_plan  := public.get_owner_plan(NEW.owner_id);
  v_limit := public.get_plan_limit(v_plan, 'workspaces');

  select count(*) into v_count
    from public.workspaces
    where owner_id = NEW.owner_id;

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: workspaces (% / %). Upgrade to add more.', v_count, v_limit
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_workspace_limit on public.workspaces;
create trigger trg_enforce_workspace_limit
  before insert on public.workspaces
  for each row
  execute function public.enforce_workspace_limit();

-- Note: public.create_default_workspace() (006/008) runs on the first
-- workspace of a brand new user (count = 0 < 1), so signup is unaffected.
-- It also swallows exceptions, so this trigger can never break auth signup.

-- ============================================================
-- END 011
-- ============================================================
