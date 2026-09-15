-- ============================================================
-- NEXUS CORE CONTRACT — RETIRED / NEUTRALISED
-- ============================================================
--
-- ORIGINAL INTENT (kept for the audit trail, do not "restore" it):
--   Re-assert the locked search_path and client EXECUTE grants of a set of
--   "canonical core helpers" supposedly created by `001_nexus_core.sql`.
--
-- WHY IT IS NEUTRALISED
--   That lineage does not exist in this repository. Verified, not assumed:
--
--     * `001_nexus_core.sql` … `005_nexus_worker.sql` were never committed to
--       any ref  —  `git log --all --diff-filter=A --name-only` returns nothing,
--       the files are absent from disk, not ignored (`git check-ignore -v`),
--       and no dangling object contains them (`git fsck --dangling`).
--     * The lineage of record is `001_nexus_base_schema.sql` -> `006`…`027`.
--       Those 23 files apply to an empty database with ZERO failures.
--     * Replayed statement by statement on that lineage, 6 of this file's 13
--       original statements failed:
--           #1 #3 #5  function public.is_workspace_member(uuid) does not exist
--           #2 #4 #7  type "public.workspace_member_role" does not exist
--       Statement #1 was an unguarded ALTER FUNCTION, so a transactional
--       runner rolled the whole file back and nothing was repaired.
--     * Creating the missing enum would NOT have rescued it. The original
--       `can_manage_workspace()` body compared `workspace_members.role`
--       against an enum array, but that column is `text` here:
--           operator does not exist: text = workspace_member_role
--       Installing it would have broken the 4 stored policy expressions that
--       call `can_manage_workspace()`, plus `enforce_member_limit()` (007/021)
--       and the `role text` OUT parameter of `get_or_create_personal_workspace()`
--       (021) — the RPC onboarding depends on.
--     * `is_workspace_member`, `has_workspace_role` and
--       `public.workspace_member_role` have ZERO consumers anywhere in
--       `supabase/migrations/`, `src/` or `scripts/`. The lineage uses
--       `is_active_workspace_member` (39 occurrences inside stored policies),
--       `can_manage_workspace` (4) and `is_workspace_owner` (1).
--
-- WHAT THIS FILE DOES NOW
--   It CREATES NOTHING. No table, no type, no function, no policy, no trigger.
--   Every function body from the original has been removed.
--
--   All that remains is the one part of the original intent that is valid on
--   any lineage: pin `search_path = public, pg_temp` and make the EXECUTE ACL
--   explicit, for whichever of these helpers actually exist. Each statement is
--   guarded by `to_regprocedure`, which returns NULL (it does not raise) even
--   when the signature references a type that does not exist — verified.
--
--   On the lineage of record this block therefore only touches the three real
--   helpers, and `20260915130500_nexus_lineage_reconciliation.sql` — which
--   sorts immediately after this file — re-states the same hardening and is
--   the AUTHORITATIVE contract. On a database following the other lineage this
--   block hardens whatever exists there and still creates nothing.
--
-- WHY NOT DELETED
--   Removing the file would make a remote database that already recorded
--   version `20260915130000` report it as remote-only, and `db push` would
--   then refuse without `--include-all` or a `migration repair` — both remote
--   operations, both out of scope while that history is unresolved. Neutralising
--   keeps the version key stable in every world. The file is intentionally kept
--   as the evidence for that decision.
--
-- Full analysis: docs/supabase/LINEAGE_RECONCILIATION.md (§1, §4.1, Annex A/B)
-- Proof harness:  supabase/tests/lineage-reconciliation.test.mjs (phases 2, 3, 7)
-- ============================================================

do $nexus_core_contract_retired$
declare
  -- Signatures probed, never created. to_regprocedure() returns NULL for an
  -- unresolvable signature instead of raising, including when the signature
  -- names a type that does not exist.
  v_iwm regprocedure := to_regprocedure('public.is_workspace_member(uuid)');
  v_hwr regprocedure := to_regprocedure(
    'public.has_workspace_role(uuid, public.workspace_member_role[])'
  );
  v_awm regprocedure := to_regprocedure('public.is_active_workspace_member(uuid, uuid)');
  v_cmw regprocedure := to_regprocedure('public.can_manage_workspace(uuid, uuid)');
  v_iwo regprocedure := to_regprocedure('public.is_workspace_owner(uuid, uuid)');

  v_sig  regprocedure;
  v_role text;
begin
  -- ----------------------------------------------------------
  -- 1. Pin search_path on the helpers that really exist.
  --    Non-semantic: it closes the pg_temp shadowing hole and
  --    changes no signature, no body and no return type.
  -- ----------------------------------------------------------
  foreach v_sig in array array[v_iwm, v_hwr, v_awm, v_cmw, v_iwo]::regprocedure[]
  loop
    if v_sig is not null then
      execute format('alter function %s set search_path = public, pg_temp', v_sig::text);
    end if;
  end loop;

  -- ----------------------------------------------------------
  -- 2. Make EXECUTE explicit instead of leaving it to platform
  --    default privileges nobody wrote down. Same role set as
  --    20260915130500, so the two files cannot disagree.
  --
  --    anon keeps EXECUTE on purpose: RLS policy expressions are
  --    evaluated as the invoking role, so revoking it would turn
  --    "zero visible rows" into a hard permission error for
  --    unauthenticated reads.
  -- ----------------------------------------------------------
  foreach v_sig in array array[v_iwm, v_hwr, v_awm, v_cmw, v_iwo]::regprocedure[]
  loop
    if v_sig is not null then
      execute format('revoke all on function %s from public', v_sig::text);
      foreach v_role in array array['anon', 'authenticated', 'service_role']
      loop
        if exists (select 1 from pg_roles where rolname = v_role) then
          execute format('grant execute on function %s to %I', v_sig::text, v_role);
        end if;
      end loop;
    end if;
  end loop;

  -- ----------------------------------------------------------
  -- 3. Record the retirement where an operator inspecting a live
  --    database will actually see it.
  -- ----------------------------------------------------------
  foreach v_sig in array array[v_iwm, v_hwr, v_awm, v_cmw, v_iwo]::regprocedure[]
  loop
    if v_sig is not null then
      execute format(
        'comment on function %s is %L',
        v_sig::text,
        'Hardened by 20260915130000 (retired/no-op) and re-asserted by '
        '20260915130500_nexus_lineage_reconciliation.sql, which is the '
        'authoritative contract. Lineage of record: 001_nexus_base_schema.sql -> 027.'
      );
    end if;
  end loop;
end
$nexus_core_contract_retired$;

-- ============================================================
-- END CORE CONTRACT (RETIRED)
-- ============================================================
