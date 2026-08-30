-- ============================================================
-- 021. WORKSPACE BOOTSTRAP — BOUNDED WAIT, OBSERVABILITY, REPAIR
-- ============================================================
-- 016-018 made the personal-workspace bootstrap idempotent and race-safe,
-- but three production gaps remained, and together they explain the
-- infinite "Preparing your workspace" state:
--
--   1. UNBOUNDED LOCK WAIT. bootstrap_personal_workspace() took
--      pg_advisory_xact_lock() without any bound. Whenever the lock was
--      held by a transaction that did not finish quickly (a slow signup
--      commit, a wedged pooled connection, a long-lived open
--      transaction), every page render for that user blocked for as
--      long as the holder lived. The application layer had no timeout
--      either, so the page simply never rendered.
--
--   2. ZERO OBSERVABILITY. The application swallowed the RPC error
--      (bare `catch { return null }`) and the database emitted no
--      marker, so a failing bootstrap was indistinguishable from a
--      slow one: the user sat on the retry screen and nobody could see
--      what Postgres was actually doing.
--
--   3. MISSING-MEMBERSHIP WAS A SILENT EMPTY SET. The final check of
--      get_or_create_personal_workspace() sat AFTER the RETURN QUERY
--      (unreachable), so a workspace whose owner membership could not be
--      established returned an empty set instead of a structured error.
--
-- This migration is additive (create or replace only) and does not touch
-- RLS policies, grants, table definitions or the security model:
--   * the caller can still only bootstrap auth.uid();
--   * RLS stays authoritative for every normal table path;
--   * the advisory lock still serializes concurrent bootstraps per user;
--   * the wait for that lock is now BOUNDED (8s) and raises a structured
--     error (55P03) instead of blocking forever.
-- ============================================================

-- ---- 1. Bounded advisory-lock acquisition + DB-side markers ----------
-- Replace the unbounded pg_advisory_xact_lock() with a bounded
-- try-lock + wait loop. The loop never holds a row lock while waiting,
-- so it cannot participate in a deadlock; it either acquires the lock
-- or gives up with a structured error after 8 seconds (well under the
-- application's 10s RPC timeout, so the database is always the one that
-- reports the failure first).
--
-- RAISE WARNING markers (WORKSPACE_BOOTSTRAP_STARTED / WORKSPACE_FOUND /
-- WORKSPACE_CREATED / MEMBERSHIP_FOUND / MEMBERSHIP_CREATED /
-- SUBSCRIPTION_FOUND / SUBSCRIPTION_CREATED / WORKSPACE_BOOTSTRAP_COMPLETED)
-- are emitted to the server log so the bootstrap state is observable
-- from the database itself. They are diagnostics only and never change
-- behaviour.

create or replace function public.bootstrap_personal_workspace(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_existing_membership boolean;
  v_workspace_name text;
  v_workspace_slug text;
  v_user_email text;
  v_user_meta jsonb;
  v_owner_prefix text;
  v_sub_rows integer;
  v_lock_waited integer := 0;
  v_lock_timeout_ms integer := 8000;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- Defense in depth: when a JWT identity is present (client context), only
  -- that user may be bootstrapped. This function is designed to be reached
  -- through ensure_personal_workspace(auth.uid()) (which enforces the same
  -- rule) and the signup trigger; it must never operate on a uuid supplied
  -- by a client. Internal contexts have auth.uid() NULL — the signup
  -- trigger calls this function directly because GoTrue does not set the
  -- claims GUC while inserting the new user — and remain trusted.
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'WORKSPACE_ACCESS_DENIED: can only bootstrap auth.uid()'
      using errcode = '42501';
  end if;

  raise warning 'WORKSPACE_BOOTSTRAP_STARTED user_id=%', p_user_id;

  -- Serialize concurrent bootstraps for this user with a BOUNDED wait.
  -- Page load, Step 1, refresh and a double-click can overlap; the
  -- transaction-scoped lock means the second caller observes the first
  -- caller's rows and cannot create a duplicate personal workspace.
  loop
    if pg_try_advisory_xact_lock(hashtextextended(p_user_id::text, 0)) then
      exit;
    end if;
    v_lock_waited := v_lock_waited + 100;
    if v_lock_waited >= v_lock_timeout_ms then
      raise exception 'WORKSPACE_BOOTSTRAP_TIMEOUT: bootstrap lock still held after %ms', v_lock_timeout_ms
        using errcode = '55P03';
    end if;
    perform pg_sleep(0.1);
  end loop;

  -- Prefer a workspace owned by this caller. An active membership in an
  -- invited/foreign workspace must never become the personal onboarding
  -- context or be renamed by this function.
  select w.id
    into v_workspace_id
    from public.workspaces w
   where w.owner_id = p_user_id
   order by w.created_at asc, w.id asc
   limit 1
   for update;

  if v_workspace_id is null then
    select u.email, u.raw_user_meta_data
      into v_user_email, v_user_meta
      from auth.users u
     where u.id = p_user_id;

    if not found then
      raise exception 'AUTH_REQUIRED' using errcode = '42501';
    end if;

    v_workspace_name := left(
      coalesce(
        nullif(btrim(v_user_meta ->> 'full_name'), ''),
        nullif(btrim(v_user_meta ->> 'name'), ''),
        nullif(btrim(split_part(v_user_email, '@', 1)), ''),
        'My Workspace'
      ),
      120
    );

    v_workspace_slug := lower(regexp_replace(
      coalesce(
        nullif(btrim(v_user_meta ->> 'username'), ''),
        nullif(btrim(split_part(v_user_email, '@', 1)), ''),
        'workspace'
      ),
      '[^a-z0-9]+', '-', 'g'
    ));
    v_workspace_slug := trim(both '-' from v_workspace_slug);
    if v_workspace_slug = '' then
      v_workspace_slug := 'workspace';
    end if;

    v_owner_prefix := substr(replace(p_user_id::text, '-', ''), 1, 8);
    v_workspace_slug := left(v_workspace_slug, 90) || '-' || v_owner_prefix;

    insert into public.workspaces (owner_id, name, slug)
    values (p_user_id, v_workspace_name, v_workspace_slug)
    returning id into v_workspace_id;

    raise warning 'WORKSPACE_CREATED workspace_id=% user_id=%', v_workspace_id, p_user_id;
  else
    raise warning 'WORKSPACE_FOUND workspace_id=% user_id=%', v_workspace_id, p_user_id;
  end if;

  -- Repair both a missing membership and a stale membership on a workspace
  -- the caller owns. The unique (workspace_id, user_id) constraint makes
  -- this safe if a historical row is present with the wrong role/status.
  select exists (
    select 1
      from public.workspace_members wm
     where wm.workspace_id = v_workspace_id
       and wm.user_id = p_user_id
  ) into v_existing_membership;

  if not v_existing_membership then
    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (v_workspace_id, p_user_id, 'owner', 'active');
    raise warning 'MEMBERSHIP_CREATED workspace_id=% user_id=%', v_workspace_id, p_user_id;
  else
    update public.workspace_members
       set role = 'owner', status = 'active'
     where workspace_id = v_workspace_id
       and user_id = p_user_id
       and (role is distinct from 'owner' or status is distinct from 'active');
    if found then
      raise warning 'MEMBERSHIP_REPAIRED workspace_id=% user_id=%', v_workspace_id, p_user_id;
    else
      raise warning 'MEMBERSHIP_FOUND workspace_id=% user_id=%', v_workspace_id, p_user_id;
    end if;
  end if;

  -- 007 creates this row for new workspaces. The insert also repairs an
  -- orphaned historical workspace whose original subscription trigger did
  -- not complete. `on conflict do nothing` preserves an existing paid plan.
  insert into public.workspace_subscriptions (workspace_id, plan, status)
  values (v_workspace_id, 'FREE', 'active')
  on conflict do nothing;
  get diagnostics v_sub_rows = row_count;
  if v_sub_rows > 0 then
    raise warning 'SUBSCRIPTION_CREATED workspace_id=% plan=FREE', v_workspace_id;
  else
    raise warning 'SUBSCRIPTION_FOUND workspace_id=%', v_workspace_id;
  end if;

  -- Verify the exact context returned to the caller. Do not report success
  -- after a partially repaired state.
  if not exists (
    select 1
      from public.workspace_members wm
     where wm.workspace_id = v_workspace_id
       and wm.user_id = p_user_id
       and wm.role = 'owner'
       and wm.status = 'active'
  ) then
    raise exception 'WORKSPACE_ACCESS_DENIED: owner membership could not be established'
      using errcode = '42501';
  end if;

  raise warning 'WORKSPACE_BOOTSTRAP_COMPLETED workspace_id=% user_id=%', v_workspace_id, p_user_id;

  return v_workspace_id;
end;
$$;

revoke all on function public.bootstrap_personal_workspace(uuid) from public;

-- bootstrap_personal_workspace is intentionally NOT callable directly by
-- clients: it is reached only through ensure_personal_workspace(auth.uid())
-- (granted to authenticated below) and the signup trigger. Keep it that way.
--
-- On Supabase the platform default privileges grant execute on every public
-- function to anon/authenticated at creation time, so `revoke from public`
-- alone does not remove those explicit ACL entries. Revoke explicitly from
-- the client roles so the internal implementation is unreachable even if a
-- default privilege (or a future grant) would otherwise expose it. The
-- owner validation inside the function is the second layer.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.bootstrap_personal_workspace(uuid) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.bootstrap_personal_workspace(uuid) from authenticated;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.ensure_personal_workspace(uuid) to authenticated;
    grant execute on function public.get_or_create_personal_workspace() to authenticated;
  end if;
end $$;

-- ---- 2. Structured error when the membership cannot be verified -------
-- 018's final `if not found then raise` was placed after RETURN QUERY and
-- was unreachable, so a missing membership surfaced as an empty result set.
-- Check first, raise a structured error, then return the row.

create or replace function public.get_or_create_personal_workspace()
returns table(workspace_id uuid, role text, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_workspace_uuid uuid;
  v_role text;
  v_status text;
begin
  v_workspace_id := public.ensure_personal_workspace(auth.uid());

  select wm.workspace_id, wm.role, wm.status
    into v_workspace_uuid, v_role, v_status
    from public.workspace_members wm
   where wm.workspace_id = v_workspace_id
     and wm.user_id = auth.uid()
   limit 1;

  if not found then
    raise exception 'WORKSPACE_MEMBERSHIP_FAILED: owner membership could not be verified for workspace %', v_workspace_id
      using errcode = 'P0001';
  end if;

  return query
    select v_workspace_uuid, v_role, v_status;
end;
$$;

revoke all on function public.get_or_create_personal_workspace() from public;

-- ---- 3. Owner re-claim is data repair, not a new member ---------------
-- The FREE/PRO/TEAM member cap counts every workspace_members row. When a
-- workspace's owner row was lost (historical trigger failure) and the
-- workspace already holds `limit` members, the owner's own repair insert
-- was rejected with PLAN_LIMIT_EXCEEDED — stranding the owner of their own
-- workspace. The owner is not an additional member: skip the cap when the
-- row being inserted re-establishes ownership (user_id = workspaces.owner_id
-- AND role = 'owner'). Invited users still cannot claim owner: the RLS
-- self-claim policy and this check both require the caller to own the
-- workspace.

create or replace function public.enforce_member_limit()
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
  -- Owner re-claim (repair path) never consumes a member slot.
  if NEW.role = 'owner' and exists (
    select 1
      from public.workspaces w
     where w.id = NEW.workspace_id
       and w.owner_id = NEW.user_id
  ) then
    return NEW;
  end if;

  v_plan  := public.get_workspace_plan(NEW.workspace_id);
  v_limit := public.get_plan_limit(v_plan, 'members');
  select count(*) into v_count
    from public.workspace_members
    where workspace_id = NEW.workspace_id;
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EXCEEDED: members (% / %). Upgrade to add more.', v_count, v_limit
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

-- Make the replaced RPCs visible to PostgREST immediately; otherwise a live
-- deployment can still receive PGRST202 from a stale schema cache.
notify pgrst, 'reload schema';

-- ============================================================
-- END 021
-- ============================================================
