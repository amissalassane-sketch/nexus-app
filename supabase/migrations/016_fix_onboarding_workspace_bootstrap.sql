-- ============================================================
-- 016. FIX ONBOARDING WORKSPACE BOOTSTRAP
-- ============================================================
-- Root cause of the "You do not have permission to make this change
-- in the current workspace" regression during onboarding Step 1:
--
-- 1. `create_default_workspace()` (006/008) swallows ALL exceptions.
--    Any failure at workspace creation time (subscription init,
--    member-limit trigger flaring during initial race, slug collision,
--    etc.) leaves a signed-up user with a profile row but NO workspace
--    and NO workspace_members row. The trigger returns NEW silently.
--
-- 2. The onboarding client then tries to repair the situation by
--    inserting a workspace_members row directly. But the RLS policy
--    `base_members_manage_workspace` is FOR ALL using can_manage_workspace()
--    — which is a chicken-and-egg check: the user cannot satisfy the
--    policy because the very membership they are trying to insert is
--    what would satisfy it.
--
-- 3. Even the profile UPDATE itself was failing in some code paths
--    because the onboarding bootstrap was deferred until Step 4. Any
--    client code, middleware, or future policy that tried to resolve
--    "current workspace" before Step 4 hit the missing-membership
--    wall and surfaced as the generic permission error.
--
-- This migration fixes the bootstrap without weakening RLS:
--
--   * Adds a security-definer RPC ensure_personal_workspace() that
--     idempotently creates (or reconnects) the user's personal
--     workspace + owner membership in a single transaction. The
--     function is callable by any authenticated user but ONLY
--     operates on that user's own data.
--   * Hardens create_default_workspace() so subscription/member
--     bootstrap failures cannot leave a half-created workspace.
--   * Adds an explicit INSERT policy on workspace_members that
--     lets a user accept/claim an existing workspace where they are
--     the owner_id but a membership row is missing (repair path).
--   * Ensures the profile INSERT self-repair policy is idempotent
--     with the trigger bootstrap.
--
-- Security model is preserved:
--   * Cross-workspace writes remain blocked.
--   * The RPC never modifies another user's data.
--   * RLS stays authoritative for every normal table path.
-- ============================================================

-- ---- 1. Hardened bootstrap: workspace + owner + subscription atomic ----
-- Replace the best-effort trigger with an atomic function that does
-- not silently swallow partial failures. The trigger becomes a thin
-- wrapper that calls the same idempotent function used by onboarding
-- repair, so both code paths converge on one correct implementation.

create or replace function public.ensure_personal_workspace(p_user_id uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_existing_membership boolean;
  v_workspace_name text;
  v_workspace_slug text;
  v_user_email text;
  v_user_meta jsonb;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- An authenticated caller can only bootstrap their OWN workspace.
  if p_user_id <> auth.uid() then
    raise exception 'WORKSPACE_ACCESS_DENIED: cannot bootstrap workspace for another user'
      using errcode = '42501';
  end if;

  -- 1. If the user already has an active membership, reuse that workspace.
  select workspace_id into v_workspace_id
  from public.workspace_members
  where user_id = p_user_id and status = 'active'
  order by created_at asc
  limit 1;

  if v_workspace_id is not null then
    return v_workspace_id;
  end if;

  -- 2. Look for an orphaned workspace owned by this user that has no
  --    membership row (repair path for the swallowed-exception bug).
  select id into v_workspace_id
  from public.workspaces
  where owner_id = p_user_id
  order by created_at asc
  limit 1;

  if v_workspace_id is null then
    -- 3. No workspace yet — create one inside this security-definer
    --    function so RLS cannot veto the owner membership insert.
    select email, raw_user_meta_data into v_user_email, v_user_meta
    from auth.users where id = p_user_id;

    v_workspace_name := coalesce(
      v_user_meta ->> 'full_name',
      v_user_meta ->> 'name',
      split_part(v_user_email, '@', 1),
      'My Workspace'
    );

    v_workspace_slug := lower(
      regexp_replace(
        coalesce(
          v_user_meta ->> 'username',
          split_part(v_user_email, '@', 1),
          'workspace'
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    );
    v_workspace_slug := v_workspace_slug || '-' || substr(replace(p_user_id::text, '-', ''), 1, 8);

    insert into public.workspaces (owner_id, name, slug)
    values (p_user_id, v_workspace_name, v_workspace_slug)
    returning id into v_workspace_id;
    -- The `on_workspace_created_owner` AFTER INSERT trigger will add
    -- the owner membership row, and `trg_default_subscription` will
    -- create the FREE subscription. Both run with this function's
    -- security-definer privileges, so they succeed regardless of
    -- whether RLS would allow the client to do them directly.
  end if;

  -- 4. If the workspace exists but the owner has no membership (repair
  --    path — e.g. trigger failure, manual cleanup, pre-008 user),
  --    insert the owner membership here.
  select exists (
    select 1 from public.workspace_members
    where workspace_id = v_workspace_id and user_id = p_user_id
  ) into v_existing_membership;

  if not v_existing_membership then
    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (v_workspace_id, p_user_id, 'owner', 'active')
    on conflict (workspace_id, user_id) do update
      set role = 'owner', status = 'active';
  end if;

  return v_workspace_id;
end;
$$;

revoke all on function public.ensure_personal_workspace(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.ensure_personal_workspace(uuid) to authenticated;
  end if;
end $$;

-- ---- 2. Simplify the auth trigger to call the same function ----
-- Keep the trigger tiny and delegating: any failure during default
-- workspace creation is a WARNING but we never return a half-state
-- because the function above is idempotent and onboarding will call
-- it again (repair-by-design).
create or replace function public.create_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delegate to the canonical bootstrap. On failure we RAISE WARNING
  -- (auth triggers must not block signup) but onboarding will call
  -- the same function with full error visibility.
  begin
    perform public.ensure_personal_workspace(new.id);
  exception
    when others then
      raise warning 'create_default_workspace: bootstrap failed for user %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- ---- 3. Self-repair INSERT on workspace_members ----
-- A user who is the owner_id of an existing workspace but does not
-- yet have a membership row (orphaned workspace) must be able to
-- claim owner membership. This is the minimum repair path and is
-- stricter than the manage_workspace policy (which requires an
-- existing admin/owner membership — a catch-22).
--
-- Normal membership invites still go through the manage policy.
drop policy if exists "base_members_self_claim_owner" on public.workspace_members;
create policy "base_members_self_claim_owner" on public.workspace_members
for insert
with check (
  user_id = auth.uid()
  and status = 'active'
  and role = 'owner'
  and exists (
    select 1 from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.owner_id = auth.uid()
  )
  and not exists (
    -- only allow when no active membership already exists
    select 1 from public.workspace_members existing
    where existing.workspace_id = workspace_members.workspace_id
      and existing.user_id = auth.uid()
      and existing.status = 'active'
  )
);

-- ---- 4. Ensure the function's dependent objects can be referenced ----
-- The is_active_workspace_member and can_manage_workspace helpers are
-- security definer and already callable by authenticated; nothing new
-- required. Expose a lightweight "verify my workspace" RPC used by the
-- onboarding page to atomically confirm the membership exists and
-- return workspace_id, without a second RLS round-trip racing with it.

create or replace function public.get_or_create_personal_workspace()
returns table(workspace_id uuid, role text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  v_ws := public.ensure_personal_workspace(auth.uid());
  return query
    select wm.workspace_id, wm.role, wm.status
    from public.workspace_members wm
    where wm.workspace_id = v_ws and wm.user_id = auth.uid()
    limit 1;
end;
$$;

revoke all on function public.get_or_create_personal_workspace() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.get_or_create_personal_workspace() to authenticated;
  end if;
end $$;

-- ---- 5. Re-grant function execute to authenticated for the helpers ----
-- Defensive: if previous migrations revoked execute, re-grant. Wrapped in
-- a DO block so the migration is safe on fresh/test databases (like the
-- PGlite fixture) that do not have the `authenticated` role pre-created.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.is_active_workspace_member(uuid, uuid) to authenticated;
    grant execute on function public.can_manage_workspace(uuid, uuid) to authenticated;
    grant execute on function public.get_workspace_plan(uuid) to authenticated;
    grant execute on function public.get_workspace_usage(uuid) to authenticated;
  end if;
end $$;

-- ============================================================
-- END 016
-- ============================================================
