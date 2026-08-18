-- ============================================================
-- 012. DEFENSE-IN-DEPTH: WORKSPACE MEMBERSHIP REQUIRED ON WRITES
-- ============================================================
-- The application resolves `workspace_id`, `created_by`, `owner_id` and
-- `assignee_id` on the client before inserting. That is fine for the UI,
-- but a user could call PostgREST directly with a forged payload.
--
-- The base RLS policies (migrations 001-005) are not versioned in this
-- repository, so they cannot be reviewed here. These triggers add a second,
-- independent server-side barrier that does NOT widen access in any way:
-- they can only reject writes, never allow one that RLS refuses.
--
-- Behaviour:
--   * auth.uid() IS NULL  -> skipped (service_role, SQL editor, DB jobs)
--   * otherwise the caller must be an ACTIVE member of the target workspace
--   * `created_by`, when provided, must be the caller
--
-- Rollback:
--   drop trigger trg_assert_workspace_member on public.tasks;         -- etc.
--   drop function public.assert_workspace_member();
--   drop function public.assert_authorship();
-- ============================================================

create or replace function public.assert_workspace_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();

  -- Server-side contexts (service_role, migrations, database triggers run
  -- outside a user session) are not restricted here.
  if v_uid is null then
    return NEW;
  end if;

  if NEW.workspace_id is null then
    raise exception 'WORKSPACE_ACCESS_DENIED: workspace_id is required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = NEW.workspace_id
      and wm.user_id = v_uid
      and wm.status = 'active'
  ) then
    raise exception 'WORKSPACE_ACCESS_DENIED: caller is not an active member of workspace %', NEW.workspace_id
      using errcode = '42501';
  end if;

  -- Moving a row from one workspace to another requires membership on both.
  if tg_op = 'UPDATE' and OLD.workspace_id is distinct from NEW.workspace_id then
    if not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = OLD.workspace_id
        and wm.user_id = v_uid
        and wm.status = 'active'
    ) then
      raise exception 'WORKSPACE_ACCESS_DENIED: caller is not an active member of workspace %', OLD.workspace_id
        using errcode = '42501';
    end if;
  end if;

  return NEW;
end;
$$;

create or replace function public.assert_authorship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return NEW;
  end if;

  if NEW.created_by is not null and NEW.created_by <> v_uid then
    raise exception 'WORKSPACE_ACCESS_DENIED: created_by must be the authenticated user'
      using errcode = '42501';
  end if;

  return NEW;
end;
$$;

-- tasks -------------------------------------------------------
drop trigger if exists trg_assert_workspace_member on public.tasks;
create trigger trg_assert_workspace_member
  before insert or update on public.tasks
  for each row execute function public.assert_workspace_member();

drop trigger if exists trg_assert_authorship on public.tasks;
create trigger trg_assert_authorship
  before insert on public.tasks
  for each row execute function public.assert_authorship();

-- projects ----------------------------------------------------
drop trigger if exists trg_assert_workspace_member on public.projects;
create trigger trg_assert_workspace_member
  before insert or update on public.projects
  for each row execute function public.assert_workspace_member();

-- goals -------------------------------------------------------
drop trigger if exists trg_assert_workspace_member on public.goals;
create trigger trg_assert_workspace_member
  before insert or update on public.goals
  for each row execute function public.assert_workspace_member();

drop trigger if exists trg_assert_authorship on public.goals;
create trigger trg_assert_authorship
  before insert on public.goals
  for each row execute function public.assert_authorship();

-- notifications -----------------------------------------------
drop trigger if exists trg_assert_workspace_member on public.notifications;
create trigger trg_assert_workspace_member
  before insert or update on public.notifications
  for each row execute function public.assert_workspace_member();

-- ============================================================
-- END 012
-- ============================================================
