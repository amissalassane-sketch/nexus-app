-- ============================================================
-- 018. HARDEN THE PERSONAL ONBOARDING BOOTSTRAP
-- ============================================================
-- 016/017 fixed the original chicken-and-egg failure, but the first
-- implementation selected any active membership before looking for a
-- workspace owned by the caller. That is not a personal-workspace
-- guarantee: a user invited to somebody else's workspace could be given
-- that workspace as their onboarding context, and a historical workspace
-- without a subscription stayed only partially repaired.
--
-- This migration is deliberately additive. Do not edit an already-applied
-- migration in production; apply this migration after 017.
--
-- Guarantees for an authenticated caller:
--   * only auth.uid() can be bootstrapped;
--   * an owned workspace is preferred over memberships in other workspaces;
--   * an owned workspace is created when none exists;
--   * the caller has an active owner membership for that workspace;
--   * an active FREE subscription exists for repaired/new workspaces;
--   * concurrent retries for one user are serialized and idempotent.
--
-- The normal RLS policies remain in force. This is a narrow security-definer
-- bootstrap operation, not a general-purpose workspace write API.
-- ============================================================

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
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- Page load, Step 1, refresh and a double-click can overlap. The lock is
  -- transaction-scoped, so the second call observes the first call's rows
  -- and cannot create a duplicate personal workspace.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

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
  else
    update public.workspace_members
       set role = 'owner', status = 'active'
     where workspace_id = v_workspace_id
       and user_id = p_user_id
       and (role is distinct from 'owner' or status is distinct from 'active');
  end if;

  -- 007 creates this row for new workspaces. The insert also repairs an
  -- orphaned historical workspace whose original subscription trigger did
  -- not complete. `on conflict do nothing` preserves an existing paid plan.
  insert into public.workspace_subscriptions (workspace_id, plan, status)
  values (v_workspace_id, 'FREE', 'active')
  on conflict do nothing;

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

  return v_workspace_id;
end;
$$;

revoke all on function public.bootstrap_personal_workspace(uuid) from public;

-- Public callers always go through auth.uid(). The trigger below calls the
-- private implementation directly because auth.uid() is NULL during signup.
create or replace function public.ensure_personal_workspace(
  p_user_id uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_user_id is null or p_user_id <> v_uid then
    raise exception 'WORKSPACE_ACCESS_DENIED: can only bootstrap auth.uid()'
      using errcode = '42501';
  end if;

  return public.bootstrap_personal_workspace(v_uid);
end;
$$;

revoke all on function public.ensure_personal_workspace(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.ensure_personal_workspace(uuid) to authenticated;
  end if;
end $$;

-- A signup trigger must be atomic. If bootstrap cannot complete, fail the
-- signup transaction instead of returning a successful auth user with a
-- half-created workspace that only fails later in onboarding.
create or replace function public.create_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.bootstrap_personal_workspace(new.id);
  return new;
end;
$$;

create or replace function public.get_or_create_personal_workspace()
returns table(workspace_id uuid, role text, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
begin
  v_workspace_id := public.ensure_personal_workspace(auth.uid());

  return query
    select wm.workspace_id, wm.role, wm.status
      from public.workspace_members wm
     where wm.workspace_id = v_workspace_id
       and wm.user_id = auth.uid()
     limit 1;

  if not found then
    raise exception 'WORKSPACE_ACCESS_DENIED: owner membership could not be verified'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.get_or_create_personal_workspace() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.get_or_create_personal_workspace() to authenticated;
  end if;
end $$;

-- Keep the helper useful to the RLS policy without allowing an authenticated
-- caller to probe ownership for an arbitrary third-party user id.
create or replace function public.is_workspace_owner(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null
     and p_user_id = auth.uid()
     and exists (
       select 1
         from public.workspaces w
        where w.id = p_workspace_id
          and w.owner_id = p_user_id
     );
$$;

revoke all on function public.is_workspace_owner(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.is_workspace_owner(uuid, uuid) to authenticated;
  end if;
end $$;

-- Make the newly replaced RPC signatures visible to PostgREST immediately;
-- otherwise a live deployment can still receive PGRST202 from a stale schema
-- cache even though the SQL migration completed.
notify pgrst, 'reload schema';

-- ============================================================
-- END 018
-- ============================================================
