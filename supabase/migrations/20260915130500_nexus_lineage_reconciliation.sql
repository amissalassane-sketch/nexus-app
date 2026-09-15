-- ============================================================
-- NEXUS
-- Migration 20260915130500
-- Lineage Reconciliation — canonical RLS helper contract
-- ============================================================
-- Full analysis: docs/supabase/LINEAGE_RECONCILIATION.md
--
-- WHY THIS FILE EXISTS
-- ------------------------------------------------------------
-- The repository has exactly one versioned schema lineage:
--
--   001_nexus_base_schema.sql -> 006 … 027
--
-- Applying those 23 files in order to an empty database succeeds with
-- ZERO failures (verified in supabase/tests/lineage-reconciliation.test.mjs).
-- That lineage is therefore complete and self-consistent, and it is the
-- source of truth for the versioned schema.
--
-- 20260915130000_nexus_core_contract.sql (PR #68) was written against a
-- DIFFERENT contract that this repository has never contained. Its own
-- header says: "The canonical core helpers already exist in 001_nexus_core."
-- No file named 001_nexus_core.sql has ever been committed here — verified
-- across every commit with `git log --all --diff-filter=A --name-only`.
-- That comment is the only reference to the other lineage anywhere in the
-- repository.
--
-- Replayed statement by statement against the real lineage, 6 of its 13
-- statements fail:
--
--   #1 #3 #5  function public.is_workspace_member(uuid) does not exist
--   #2 #4 #7  type "public.workspace_member_role" does not exist
--
-- The "obvious" repair — create the enum — does NOT work and is actively
-- dangerous. Statement #7 replaces the working can_manage_workspace() with
-- a body comparing workspace_members.role against an enum array. In this
-- lineage that column is `text`, so PostgreSQL rejects it:
--
--   operator does not exist: text = workspace_member_role
--
-- Making it typecheck would require converting workspace_members.role to
-- the enum, which would invalidate every already-stored expression that
-- compares that column: can_manage_workspace() (001) and the
-- base_members_self_claim_owner policy (016/017) both compare `role`
-- directly, and get_or_create_personal_workspace() (021) returns
-- `role text`. Those are 14 policy call sites plus the onboarding RPC the
-- application depends on. Converting a column type to satisfy a migration
-- that has no consumers is not a reconciliation; it is a regression.
--
-- So this file does the opposite: it states the real contract explicitly
-- and makes it deterministic.
--
-- WHAT THIS MIGRATION DOES
-- ------------------------------------------------------------
--   1. Re-asserts the three canonical membership helpers that the versioned
--      lineage actually uses, with a locked search path.
--   2. Makes their EXECUTE ACL explicit instead of leaving it to Supabase
--      platform default privileges, which is what caused the drift in the
--      first place (an ACL nobody wrote down and nobody could review).
--   3. Records the contract as a COMMENT on each function, so an operator
--      inspecting a live database can see which lineage it belongs to.
--
-- Reference counts that justify calling these three canonical
-- (measured across supabase/migrations, src, scripts and supabase/tests):
--
--   public.is_active_workspace_member(uuid, uuid)   49 policy call sites
--   public.is_workspace_owner(uuid, uuid)           14 policy call sites
--   public.can_manage_workspace(uuid, uuid)         14 policy call sites
--   public.is_workspace_member(uuid)                 0 — only inside
--                                                      20260915130000 and
--                                                      its own test fixture
--   public.has_workspace_role(uuid, enum[])          0 — same
--   public.workspace_member_role                     0 — same
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
-- ------------------------------------------------------------
--   * No enum type is created. workspace_members.role and .status stay
--     `text` with their CHECK constraints, exactly as 001 defined them.
--   * No column type is altered, no table is touched, no data is changed.
--   * No RLS policy is created, altered or dropped.
--   * No duplicate helper is added. is_workspace_member() and
--     has_workspace_role() are NOT created: nothing in the repository calls
--     them, and adding them next to is_active_workspace_member() would put
--     two names for one rule in front of every future contributor.
--   * 20260915130000_nexus_core_contract.sql is not modified. Retiring it
--     is an operator decision recorded in the reconciliation document.
--
-- Every statement is guarded or idempotent, so this file is safe to re-run
-- and safe on a database that follows a different lineage (see scenario B
-- in the reconciliation document): if a helper is absent, nothing happens.
-- ============================================================

do $$
declare
  v_has_anon boolean := exists (select 1 from pg_roles where rolname = 'anon');
  v_has_auth boolean := exists (select 1 from pg_roles where rolname = 'authenticated');
  v_has_svc  boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  -- ------------------------------------------------------------
  -- 1. is_active_workspace_member(uuid, uuid) — the membership rule.
  -- ------------------------------------------------------------
  -- Referenced by 49 policy call sites: 001 (20), 015 (3), 016 (2),
  -- 017 (1), 023 (5), 024 (5), 025 (5).
  if to_regprocedure('public.is_active_workspace_member(uuid, uuid)') is not null then
    alter function public.is_active_workspace_member(uuid, uuid)
      set search_path = public, pg_temp;

    -- PUBLIC is revoked: an unqualified grant to every role is not a
    -- contract. The three real client/backend roles are granted explicitly.
    revoke all on function public.is_active_workspace_member(uuid, uuid) from public;

    -- anon KEEPS execute, and this is deliberate. A policy expression is
    -- evaluated with the privileges of the role running the query, and
    -- anonymous PostgREST requests do reach these tables. Revoking anon
    -- would turn a correct "zero rows visible" answer into a hard
    -- `permission denied for function` error, which is both a worse client
    -- contract and a behaviour change no policy review asked for.
    -- The function is STABLE, returns a boolean and exposes no row; for an
    -- anonymous caller auth.uid() is NULL so it always returns false.
    if v_has_anon then
      grant execute on function public.is_active_workspace_member(uuid, uuid) to anon;
    end if;
    if v_has_auth then
      grant execute on function public.is_active_workspace_member(uuid, uuid) to authenticated;
    end if;
    -- service_role is used by repair scripts and by 026/027 admin paths.
    if v_has_svc then
      grant execute on function public.is_active_workspace_member(uuid, uuid) to service_role;
    end if;

    comment on function public.is_active_workspace_member(uuid, uuid) is
      'NEXUS canonical membership rule (lineage 001_nexus_base_schema -> 027). '
      'True when p_user_id has an ACTIVE row in public.workspace_members. '
      'workspace_members.role/status are text with CHECK constraints in this '
      'lineage; there is no workspace_member_role enum. SECURITY DEFINER so a '
      'policy can read membership without recursing into workspace_members'' '
      'own policies. Granted to anon because RLS policy expressions are '
      'evaluated as the invoking role.';
  end if;

  -- ------------------------------------------------------------
  -- 2. can_manage_workspace(uuid, uuid) — the owner/admin rule.
  -- ------------------------------------------------------------
  -- Referenced by 14 policy call sites: 001 (5), 016 (3), 017 (1), and the
  -- table-level policies on workspaces and workspace_members.
  --
  -- NOTE: 20260915130000 statement #7 tries to replace this body with one
  -- that casts to public.workspace_member_role. That replacement is void in
  -- this lineage and is NOT reproduced here; the 001 body (role in
  -- ('owner','admin'), both text) remains the definition of record.
  if to_regprocedure('public.can_manage_workspace(uuid, uuid)') is not null then
    alter function public.can_manage_workspace(uuid, uuid)
      set search_path = public, pg_temp;

    revoke all on function public.can_manage_workspace(uuid, uuid) from public;

    if v_has_anon then
      grant execute on function public.can_manage_workspace(uuid, uuid) to anon;
    end if;
    if v_has_auth then
      grant execute on function public.can_manage_workspace(uuid, uuid) to authenticated;
    end if;
    if v_has_svc then
      grant execute on function public.can_manage_workspace(uuid, uuid) to service_role;
    end if;

    comment on function public.can_manage_workspace(uuid, uuid) is
      'NEXUS canonical management rule (lineage 001_nexus_base_schema -> 027). '
      'True when p_user_id is an ACTIVE member with role owner or admin. '
      'role is text with a CHECK constraint, not an enum: the replacement '
      'attempted by 20260915130000 does not typecheck against this schema '
      'and is void here.';
  end if;

  -- ------------------------------------------------------------
  -- 3. is_workspace_owner(uuid, uuid) — the orphan-owner repair rule.
  -- ------------------------------------------------------------
  -- Referenced by 14 call sites: the base_members_self_claim_owner policy
  -- (017) plus 018 and supabase/diagnostics. It exists because a user who
  -- owns a workspace but has no membership row cannot satisfy a
  -- membership-based policy — the chicken-and-egg documented in 016/017.
  --
  -- Unlike the two helpers above, this one already refuses to answer for any
  -- p_user_id other than auth.uid(), so no caller can use it as an oracle
  -- about somebody else's ownership. anon still KEEPS execute, for the same
  -- structural reason: it is referenced by the base_members_self_claim_owner
  -- INSERT policy on workspace_members, and a policy expression is evaluated
  -- as the invoking role. Revoking anon here would convert a clean RLS
  -- denial into `permission denied for function`, which is a behaviour
  -- change this reconciliation is explicitly not allowed to make.
  if to_regprocedure('public.is_workspace_owner(uuid, uuid)') is not null then
    alter function public.is_workspace_owner(uuid, uuid)
      set search_path = public, pg_temp;

    revoke all on function public.is_workspace_owner(uuid, uuid) from public;

    if v_has_anon then
      grant execute on function public.is_workspace_owner(uuid, uuid) to anon;
    end if;
    if v_has_auth then
      grant execute on function public.is_workspace_owner(uuid, uuid) to authenticated;
    end if;
    if v_has_svc then
      grant execute on function public.is_workspace_owner(uuid, uuid) to service_role;
    end if;

    comment on function public.is_workspace_owner(uuid, uuid) is
      'NEXUS canonical ownership rule (lineage 017/018). True only when '
      'p_user_id IS auth.uid() AND workspaces.owner_id = p_user_id. Used by '
      'the base_members_self_claim_owner repair policy so an orphaned owner '
      'can re-claim a membership. Deliberately cannot be used to probe '
      'another user''s ownership.';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 4. Record the lineage decision where an operator will see it.
-- ------------------------------------------------------------
-- A database that has this comment has been reconciled against the versioned
-- repository lineage. A database that does not is either older than this
-- migration or follows a different lineage. Guarded so this file stays
-- harmless on a database whose workspace_members came from elsewhere.
do $$
begin
  if to_regclass('public.workspace_members') is not null then
    comment on table public.workspace_members is
      'NEXUS tenant membership. Lineage of record: 001_nexus_base_schema.sql -> 027. '
      'role and status are text with CHECK constraints, NOT PostgreSQL enums. '
      'The enum-based contract assumed by 20260915130000_nexus_core_contract.sql '
      '(public.workspace_member_role, is_workspace_member(uuid), '
      'has_workspace_role(uuid, workspace_member_role[])) has never existed in '
      'this repository and is void for this lineage. See '
      'docs/supabase/LINEAGE_RECONCILIATION.md.';
  end if;
end
$$;

-- PostgREST caches function signatures; nothing changed here, but the
-- COMMENT/ACL writes are cheap to publish and keep the pattern consistent
-- with 018/020/021.
notify pgrst, 'reload schema';

-- ============================================================
-- END 20260915130500 — LINEAGE RECONCILIATION
-- ============================================================
