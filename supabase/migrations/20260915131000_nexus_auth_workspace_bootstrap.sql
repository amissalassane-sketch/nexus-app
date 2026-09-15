-- ============================================================
-- NEXUS
-- Migration 20260915131000
-- Auth + Personal Workspace Bootstrap
-- ============================================================
-- Target flow, made canonical and deterministic:
--
--   auth.users
--     -> profile                        (bootstrap_profile)
--     -> personal workspace             (bootstrap_personal_workspace)
--     -> workspace owner membership     (001 bootstrap_workspace_owner
--                                        + the repair path inside
--                                        bootstrap_personal_workspace)
--     -> FREE subscription              (007 workspace_subscriptions,
--                                        already created by
--                                        trg_default_subscription and
--                                        re-asserted by the bootstrap)
--
-- This migration is additive except for the audited removals listed in
-- sections 1 and 3. It does not touch tables, columns, RLS policies, table
-- grants, plan limits, freemium enforcement, activity, intelligence or
-- admin objects, and it does not edit any previously applied migration.
-- Every statement is guarded or `create or replace`, so the file is safe to
-- re-run.
--
-- ------------------------------------------------------------
-- WHAT WAS ACTUALLY FOUND IN THE BASELINE (no guessing)
-- ------------------------------------------------------------
-- public.profiles            id (pk -> auth.users), display_name, username
--                            (unique, nullable), bio, avatar_url,
--                            onboarding_completed, onboarding_intent (013),
--                            job_title (020), onboarding_progress (022),
--                            created_at, updated_at.
--                            Only `id` has no default.
-- public.workspaces          id, owner_id (not null -> auth.users),
--                            name (not null, char_length 1..120),
--                            slug (not null, unique), description, icon,
--                            color, created_at, updated_at.
-- public.workspace_members   id, workspace_id, user_id,
--                            role text in (owner|admin|member|viewer),
--                            status text in (active|invited|suspended),
--                            created_at, unique (workspace_id, user_id).
-- Subscriptions              There is NO public.subscriptions table. The
--                            canonical table is public.workspace_subscriptions
--                            (007) and it is already wired to workspaces with
--                            a partial unique index on (workspace_id) where
--                            status = 'active'. So a FREE subscription IS part
--                            of the existing contract and is reused as-is:
--                            no new table, no invented column.
-- Triggers on auth.users     on_auth_user_created_profile  -> bootstrap_profile()
--                            on_auth_user_created_workspace -> create_default_workspace()
--                            Two triggers, whose execution order was only
--                            correct by alphabetical accident.
-- Owner membership           Already created by 001's on_workspace_created_owner
--                            trigger for every workspace insert, and repaired
--                            by bootstrap_personal_workspace(). Both are
--                            idempotent against unique (workspace_id, user_id).
--                            No second mechanism is introduced here.
-- Application code           Calls rpc get_or_create_personal_workspace()
--                            (src/lib/auth-flow.ts, src/app/api/profile/route.ts)
--                            which delegates to ensure_personal_workspace(auth.uid())
--                            -> bootstrap_personal_workspace(auth.uid()).
--                            No application change is required.
-- ============================================================

-- ============================================================
-- 1. CANONICAL PROFILE BOOTSTRAP
-- ============================================================
-- One function, one behaviour: create the profile row, or normalise an
-- existing one without ever clobbering identity the user already chose.
--
-- SECURITY DEFINER is required, not convenient: the signup trigger runs
-- while auth.uid() is NULL, so the client-facing profiles INSERT policy
-- (010: `with check (auth.uid() = id)`) cannot be satisfied from inside
-- the trigger. The definer scope is limited to this one upsert on
-- public.profiles; no other table is touched.
--
-- Access-first contract from 020 is preserved exactly:
--   * display_name is stored ONLY when the provider actually asserted one;
--   * username is always NULL at signup - it is a NEXUS profile identity
--     the user chooses later, never auto-generated (019's derived username
--     is deliberately not reintroduced);
--   * profile completeness never gates access.

-- The legacy zero-arg trigger version is replaced by this signature. Its
-- only reference was the on_auth_user_created_profile trigger, dropped in
-- section 3; it is not called by any application code, script or test.
drop trigger if exists on_auth_user_created_profile on auth.users;
drop function if exists public.bootstrap_profile();

create or replace function public.bootstrap_profile(
  p_user_id  uuid,
  p_metadata jsonb default null,
  p_email    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_metadata     jsonb;
  v_email        text;
  v_display_name text;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- Defense in depth, same rule as bootstrap_personal_workspace(): when a
  -- JWT identity is present, only that user's profile may be written.
  -- Internal contexts (the signup trigger) have auth.uid() NULL.
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'PROFILE_ACCESS_DENIED: can only bootstrap auth.uid()'
      using errcode = '42501';
  end if;

  v_metadata := p_metadata;
  v_email    := p_email;

  -- Repair/backfill callers may pass only the user id; the identity then
  -- comes from the same source the trigger uses (auth.users), never from
  -- auth.email() or any other session-derived helper.
  if v_metadata is null and v_email is null then
    select u.raw_user_meta_data, u.email
      into v_metadata, v_email
      from auth.users u
     where u.id = p_user_id;

    if not found then
      raise exception 'AUTH_REQUIRED' using errcode = '42501';
    end if;
  end if;

  v_metadata := coalesce(v_metadata, '{}'::jsonb);

  -- Identity the provider actually asserted. `name` is what Google OAuth
  -- stores, `full_name` what explicit signup metadata may carry,
  -- `display_name` what a client may send. Nothing is invented.
  v_display_name := nullif(
    btrim(
      coalesce(
        v_metadata ->> 'display_name',
        v_metadata ->> 'full_name',
        v_metadata ->> 'name'
      )
    ),
    ''
  );

  -- Idempotent by construction: the primary key on profiles.id is the
  -- uniqueness constraint we rely on, so repeated calls converge on one
  -- row. The DO UPDATE branch only fills a display_name that is still
  -- NULL, so it can never overwrite a name the user has since set, and it
  -- never writes username.
  insert into public.profiles (id, display_name, username)
  values (p_user_id, v_display_name, null)
  on conflict (id) do update
    set display_name = excluded.display_name
    where profiles.display_name is null
      and excluded.display_name is not null;

  return p_user_id;
end;
$$;

-- ============================================================
-- 2. CANONICAL SIGNUP CHAIN
-- ============================================================
-- One trigger function runs the whole chain in an explicit order instead
-- of relying on the alphabetical firing order of two separate triggers.
--
-- A signup trigger must be atomic (018): if the bootstrap cannot complete,
-- the signup transaction fails rather than returning a valid auth user with
-- a half-created tenant. Errors are therefore NOT swallowed here.

create or replace function public.bootstrap_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.users -> profile
  perform public.bootstrap_profile(new.id, new.raw_user_meta_data, new.email);

  -- profile -> personal workspace -> owner membership -> FREE subscription
  perform public.bootstrap_personal_workspace(new.id);

  return new;
end;
$$;

-- ============================================================
-- 3. ONE TRIGGER ON auth.users
-- ============================================================
-- Both legacy triggers are removed and replaced by a single canonical one.
-- Reference audit performed before removal:
--   * on_auth_user_created_profile   -> only bootstrap_profile()  (section 1)
--   * on_auth_user_created_workspace -> only create_default_workspace()
--   * create_default_workspace()     -> referenced by no other trigger, by
--     no application code (src/), by no script (scripts/) and by no test
--     (supabase/tests/). Since 018 its entire body was
--     `perform bootstrap_personal_workspace(new.id)`, i.e. a legacy third
--     name for an operation that already has a canonical function. It is
--     genuinely unused once the trigger below replaces it, so it is dropped
--     rather than left as a competing entry point.

drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists on_auth_user_created_workspace on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.create_default_workspace();

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.bootstrap_auth_user();

-- ============================================================
-- 4. PERSONAL WORKSPACE BOOTSTRAP - SLUG + NAME NORMALISATION
-- ============================================================
-- 018/021 already made this function idempotent, race-safe (bounded
-- advisory lock), observable and least-privilege. All of that is preserved
-- verbatim: the bounded pg_try_advisory_xact_lock() wait, the 8s
-- WORKSPACE_BOOTSTRAP_TIMEOUT (55P03), every RAISE WARNING marker, the
-- owner-membership repair, the FREE subscription re-assertion, the final
-- verification and the foreign-uuid refusal.
--
-- Two real defects in the derivation are fixed here:
--
--   a) SLUG LOWERCASING ORDER. The previous expression was
--        lower(regexp_replace(source, '[^a-z0-9]+', '-', 'g'))
--      The regexp runs BEFORE lower(), so every uppercase letter is treated
--      as a separator and DELETED instead of being lowercased:
--        'Abdoul'       -> '-bdoul'      -> 'bdoul'
--        'Abdoul.Karim' -> '-bdoul-arim' -> 'bdoul-arim'
--        'A'            -> '-'           -> '' -> fallback 'workspace'
--      Lowercasing first yields the intended stable slug:
--        'Abdoul'       -> 'abdoul'
--        'Abdoul.Karim' -> 'abdoul-karim'
--
--   b) DOUBLE SEPARATOR BEFORE THE SUFFIX. left(slug, 90) could end on a
--      '-', and the owner suffix was concatenated with another '-', which
--      produced 'abdoul--a81f32c9'. The trimmed base removes that.
--
-- Uniqueness still comes from the existing constraints, not from fragile
-- logic: the deterministic 8-hex owner suffix derived from the user id
-- keeps workspaces.slug unique, and the same user always derives the same
-- slug, so repeated calls can never create a second personal workspace.
-- The suffix is derived from the user id rather than a random uuid so the
-- result stays deterministic across retries.
--
-- The slug never contains the email domain: only split_part(email, '@', 1)
-- is ever considered.
--
-- Name priority follows the metadata actually present in auth.users:
--   display_name -> full_name -> name -> username -> email local part
--   -> 'NEXUS Workspace'
-- workspaces.name is NOT NULL with char_length between 1 and 120, so every
-- branch is trimmed, empty-guarded and the result is capped at 120.

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
  -- by a client. Internal contexts have auth.uid() NULL - the signup
  -- trigger calls this function directly because GoTrue does not set the
  -- claims GUC while inserting the new user - and remain trusted.
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

    v_user_meta := coalesce(v_user_meta, '{}'::jsonb);

    -- NOT NULL + char_length(name) between 1 and 120.
    v_workspace_name := left(
      coalesce(
        nullif(btrim(v_user_meta ->> 'display_name'), ''),
        nullif(btrim(v_user_meta ->> 'full_name'), ''),
        nullif(btrim(v_user_meta ->> 'name'), ''),
        nullif(btrim(v_user_meta ->> 'username'), ''),
        nullif(btrim(split_part(coalesce(v_user_email, ''), '@', 1)), ''),
        'NEXUS Workspace'
      ),
      120
    );

    -- NOT NULL + unique. Lowercase FIRST, then collapse every run of
    -- non-alphanumeric characters into a single '-'. The email local part
    -- is the only email-derived input, never the full address.
    v_workspace_slug := regexp_replace(
      lower(
        coalesce(
          nullif(btrim(v_user_meta ->> 'username'), ''),
          nullif(btrim(split_part(coalesce(v_user_email, ''), '@', 1)), ''),
          'workspace'
        )
      ),
      '[^a-z0-9]+', '-', 'g'
    );
    v_workspace_slug := trim(both '-' from v_workspace_slug);
    if v_workspace_slug = '' then
      v_workspace_slug := 'workspace';
    end if;

    -- Deterministic collision suffix. Trim again so the join can never
    -- produce a double separator.
    v_owner_prefix := substr(replace(p_user_id::text, '-', ''), 1, 8);
    v_workspace_slug := trim(both '-' from left(v_workspace_slug, 90)) || '-' || v_owner_prefix;

    insert into public.workspaces (owner_id, name, slug)
    values (p_user_id, v_workspace_name, v_workspace_slug)
    returning id into v_workspace_id;

    raise warning 'WORKSPACE_CREATED workspace_id=% user_id=% slug=%', v_workspace_id, p_user_id, v_workspace_slug;
  else
    raise warning 'WORKSPACE_FOUND workspace_id=% user_id=%', v_workspace_id, p_user_id;
  end if;

  -- Repair both a missing membership and a stale membership on a workspace
  -- the caller owns. The unique (workspace_id, user_id) constraint makes
  -- this safe if a historical row is present with the wrong role/status,
  -- and guarantees at most one owner membership per user per workspace.
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

  -- 007 creates this row for new workspaces via trg_default_subscription.
  -- The insert also repairs an orphaned historical workspace whose original
  -- subscription trigger did not complete. `on conflict do nothing` respects
  -- the existing partial unique index on (workspace_id) where status =
  -- 'active' and preserves an existing paid plan. Only the columns defined
  -- by 007 are written; nothing is invented.
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

-- ============================================================
-- 5. LEAST PRIVILEGE
-- ============================================================
-- Trigger-only functions must not be callable by a client. On Supabase the
-- platform default privileges grant EXECUTE on every new public function to
-- anon/authenticated/service_role at creation time, and `revoke from public`
-- does not remove those explicit ACL entries - so each client role is
-- revoked explicitly (the same trap documented in 021).
--
-- PostgreSQL never checks EXECUTE to fire a trigger function, so revoking
-- from the client roles cannot break signup.
--
-- The three internal entry points stripped here are:
--   public.bootstrap_profile(uuid, jsonb, text)  - called by the trigger
--   public.bootstrap_auth_user()                 - the trigger function
--   public.bootstrap_personal_workspace(uuid)    - reached only through
--                                                  ensure_personal_workspace()
-- What stays callable, and why, is stated in sections 6c and 6d.
-- service_role keeps EXECUTE everywhere: it is the trusted backend role used
-- by repair scripts.

revoke all on function public.bootstrap_profile(uuid, jsonb, text) from public;
revoke all on function public.bootstrap_auth_user() from public;
revoke all on function public.bootstrap_personal_workspace(uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.bootstrap_profile(uuid, jsonb, text) from anon;
    revoke execute on function public.bootstrap_auth_user() from anon;
    revoke execute on function public.bootstrap_personal_workspace(uuid) from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.bootstrap_profile(uuid, jsonb, text) from authenticated;
    revoke execute on function public.bootstrap_auth_user() from authenticated;
    revoke execute on function public.bootstrap_personal_workspace(uuid) from authenticated;
  end if;
end
$$;

-- ============================================================
-- 6. PINNED SEARCH PATH ON THE BOOTSTRAP FAMILY
-- ============================================================
-- Non-semantic hardening: every SECURITY DEFINER function in this flow must
-- run with a locked search path. Omitting pg_temp lets a temporary object
-- shadow a lookup inside a definer body. Bodies, signatures, grants and
-- policy semantics are untouched.
--
-- The existence guards keep this migration applicable on databases (and test
-- fixtures) where the 001 base objects are not present, so a missing object
-- can never abort the whole bootstrap contract.
--
-- The three membership helpers are re-asserted here because that is exactly
-- what 20260915130000_nexus_core_contract.sql intends to do for them; this
-- file does not modify that migration.

do $$
declare
  v_has_anon  boolean := exists (select 1 from pg_roles where rolname = 'anon');
  v_has_auth  boolean := exists (select 1 from pg_roles where rolname = 'authenticated');
  v_has_owner boolean := to_regprocedure('public.bootstrap_workspace_owner()') is not null;
  v_has_sub   boolean := to_regprocedure('public.create_default_subscription()') is not null;
begin
  -- 6a. Lock the search path of the SECURITY DEFINER functions this flow
  --     depends on but does not redefine.
  if v_has_owner then
    alter function public.bootstrap_workspace_owner()
      set search_path = public, pg_temp;
  end if;

  if v_has_sub then
    alter function public.create_default_subscription()
      set search_path = public, pg_temp;
  end if;

  if to_regprocedure('public.is_active_workspace_member(uuid, uuid)') is not null then
    alter function public.is_active_workspace_member(uuid, uuid)
      set search_path = public, pg_temp;
  end if;

  if to_regprocedure('public.can_manage_workspace(uuid, uuid)') is not null then
    alter function public.can_manage_workspace(uuid, uuid)
      set search_path = public, pg_temp;
  end if;

  if to_regprocedure('public.is_workspace_owner(uuid, uuid)') is not null then
    alter function public.is_workspace_owner(uuid, uuid)
      set search_path = public, pg_temp;
  end if;

  -- 6b. Both are trigger-only: strip client EXECUTE.
  if v_has_owner then
    revoke all on function public.bootstrap_workspace_owner() from public;
    if v_has_anon then
      revoke execute on function public.bootstrap_workspace_owner() from anon;
    end if;
    if v_has_auth then
      revoke execute on function public.bootstrap_workspace_owner() from authenticated;
    end if;
  end if;

  if v_has_sub then
    revoke all on function public.create_default_subscription() from public;
    if v_has_anon then
      revoke execute on function public.create_default_subscription() from anon;
    end if;
    if v_has_auth then
      revoke execute on function public.create_default_subscription() from authenticated;
    end if;
  end if;

  -- 6c. The two client-facing entry points. 016/018/021 revoked from PUBLIC
  --     and granted to authenticated, but never stripped the explicit `anon`
  --     ACL entry the platform default privileges create. anon has no JWT, so
  --     auth.uid() is always NULL and both functions can only ever raise
  --     WORKSPACE_ACCESS_DENIED for that role: the grant is useless, and
  --     least privilege says remove it. src/app/api/profile/route.ts already
  --     answers 401 before reaching the RPC when getUser() is null, and
  --     src/lib/auth-flow.ts only calls it for a signed-in user, so no
  --     application path loses anything.
  if v_has_anon then
    if to_regprocedure('public.ensure_personal_workspace(uuid)') is not null then
      revoke execute on function public.ensure_personal_workspace(uuid) from anon;
    end if;
    if to_regprocedure('public.get_or_create_personal_workspace()') is not null then
      revoke execute on function public.get_or_create_personal_workspace() from anon;
    end if;
  end if;

  if v_has_auth then
    if to_regprocedure('public.ensure_personal_workspace(uuid)') is not null then
      grant execute on function public.ensure_personal_workspace(uuid) to authenticated;
    end if;
    if to_regprocedure('public.get_or_create_personal_workspace()') is not null then
      grant execute on function public.get_or_create_personal_workspace() to authenticated;
    end if;
  end if;

  -- 6d. DELIBERATELY NOT REVOKED FROM anon: the three membership helpers
  --     is_active_workspace_member(uuid, uuid), can_manage_workspace(uuid, uuid)
  --     and is_workspace_owner(uuid, uuid). They are referenced inside RLS
  --     policies, and a policy expression is evaluated with the privileges of
  --     the invoking role - which can legitimately be anon (an anonymous
  --     SELECT/INSERT that RLS must then refuse). Revoking EXECUTE there would
  --     turn a clean row-level denial into a hard permission error and change
  --     the RLS contract, which is out of scope for this migration. They are
  --     already revoked from PUBLIC and expose no rows by themselves.
end
$$;

-- Signatures changed in this migration; refresh PostgREST's schema cache so
-- a live deployment cannot serve a stale definition (same pattern as 018/021).
notify pgrst, 'reload schema';

-- ============================================================
-- END 20260915131000 — AUTH + PERSONAL WORKSPACE BOOTSTRAP
-- ============================================================
