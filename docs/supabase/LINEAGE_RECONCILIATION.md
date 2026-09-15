# NEXUS — Supabase Lineage Reconciliation

**Status:** analysis + corrective migration `20260915130500_nexus_lineage_reconciliation.sql`
**Scope:** schema lineage only. No auth/workspace, freemium, activity, intelligence or admin change.
**Remote Supabase operations performed:** none. Everything below was measured locally in PGlite.
**Harness:** `supabase/tests/lineage-reconciliation.test.mjs` — 32 assertions, all passing.

---

## 1. Verdict

The repository has exactly **one** versioned schema lineage:

```
001_nexus_base_schema.sql → 006 … 027
```

Applying those **23 files in order to an empty database succeeds with zero failures**
(harness PHASE 1). That lineage is complete, self-consistent, and is the source of truth.

`20260915130000_nexus_core_contract.sql` (PR #68) was written against a **different contract
that this repository has never contained**. It is not a partial or drifted version of the real
lineage — it references objects that do not exist here and never did:

| Object PR #68 assumes | Exists in this repo? | Evidence |
|---|---|---|
| `public.is_workspace_member(uuid)` | **No** | never defined by any migration |
| `public.has_workspace_role(uuid, public.workspace_member_role[])` | **No** | never defined by any migration |
| `public.workspace_member_role` (enum) | **No** | `workspace_members.role` is `text` + CHECK |
| `public.workspace_member_status` (enum) | **No** | `workspace_members.status` is `text` + CHECK |
| `001_nexus_core.sql` … `005_nexus_worker.sql` | **No** | `git log --all --diff-filter=A --name-only` — never committed |

Replayed statement by statement against the real lineage, **6 of its 13 statements fail**:

```
#1 #3 #5  function public.is_workspace_member(uuid) does not exist
#2 #4 #7  type "public.workspace_member_role" does not exist
```

Its very first statement is an unguarded `ALTER FUNCTION` on a function that does not exist, so
under any transactional runner the whole file rolls back and nothing is repaired.

### The "obvious" repair is a trap

Creating the missing enum does **not** make PR #68 applicable, and would actively break the
database. Statement #7 replaces the working `can_manage_workspace()` with a body that compares
`workspace_members.role` against an enum array. In this lineage that column is `text`, so
PostgreSQL rejects it (harness PHASE 3, measured):

```
operator does not exist: text = workspace_member_role
```

Making it typecheck would require converting `workspace_members.role` to the enum. That would
invalidate every **already-stored** expression comparing that column:

- `can_manage_workspace()` (001) — `role in ('owner','admin')`
- `base_members_self_claim_owner` policy (016, rebuilt 017) — `role = 'owner'`
- `get_or_create_personal_workspace()` (021) — `returns table(… role text …)`, the RPC the
  onboarding flow depends on
- `enforce_member_limit()` (007/021) — `NEW.role = 'owner'`

That is a regression bought to satisfy a migration with **zero consumers**. Rejected.

### PR #68 has zero consumers

Measured across `supabase/migrations`, `src/`, `scripts/` and `supabase/tests/`:

| Symbol | Real references | Where |
|---|---|---|
| `public.is_active_workspace_member(uuid, uuid)` | **49 policy call sites** | 001 (20), 015 (3), 016 (2), 017 (1), 023 (5), 024 (5), 025 (5) |
| `public.is_workspace_owner(uuid, uuid)` | **14 call sites** | 017 policy, 018, diagnostics |
| `public.can_manage_workspace(uuid, uuid)` | **14 call sites** | 001 (5), 016 (3), 017 (1) |
| `public.is_workspace_member(uuid)` | **0** | only inside `20260915130000` + its own test fixture |
| `public.has_workspace_role(uuid, enum[])` | **0** | only inside `20260915130000` + its own test fixture |
| `public.workspace_member_role` | **0** | only inside `20260915130000` + its own test fixture |

`supabase/tests/core-contract.test.mjs` passes today **only because it fabricates the entire
missing world itself** — it creates the two enums, a stripped-down `profiles`/`workspaces`/
`workspace_members`, and both missing helpers, and then applies the migration on top of that
invented fixture. It never touches the real lineage. That is why a green PR #68 coexisted with
an unappliable migration.

---

## 2. Compatibility matrix

Conflict classes: **A** compatible · **B** migration nécessaire · **C** objet manquant ·
**D** migration précédente incorrecte · **E** décision à prendre.

| Objet | Base actuelle | Migration attendue | Dépendances | Conflit | Décision |
|---|---|---|---|---|---|
| `profiles` | 001: `id` pk → `auth.users(id)`, `display_name`, `username` unique nullable, `bio`, `avatar_url`, `onboarding_completed`, timestamps; + `onboarding_intent` (013/014), `job_title` (020), `onboarding_progress` (022) | none — PR #68 does not touch it | `src/lib/auth.ts`, `src/app/api/profile/route.ts`, `user-settings-panel`, `onboarding/persistence`, 020 access-first contract | **A** | Keep as-is. 1:1 with `auth.users` via the shared PK. |
| `workspaces` | 001: `owner_id` not null → `auth.users(id)`, `name` not null CHECK 1..120, `slug` not null **unique**, `description`, `icon`, `color` | none | 011 `trg_enforce_workspace_limit`, 007 `trg_default_subscription`, 001 `on_workspace_created_owner`, `base_workspaces_*` policies | **A** | Keep as-is. |
| `workspace_members` | 001: `role text` CHECK `(owner,admin,member,viewer)`, `status text` CHECK `(active,invited,suspended)`, `unique(workspace_id,user_id)` | PR #68 assumes enum-typed `role`/`status` | 007/021 `enforce_member_limit`, 016/017 self-claim policy, 021 RPC `role text`, all of `src/lib/workspace.ts` | **D** | **`text` + CHECK is the contract of record.** No column conversion. Recorded as a COMMENT on the table by `20260915130500`. |
| `workspace_member_role` | does not exist | PR #68 `ALTER`/`GRANT`/cast against it | nothing in the repo | **C** | **Deliberately not created.** Creating it cannot fix PR #68 (see §1) and would tempt a column conversion. |
| `workspace_member_status` | does not exist | referenced only by `core-contract.test.mjs`'s own fixture | nothing in the repo | **C** | **Deliberately not created.** |
| `projects` | 001 + `goal_id` (013) | none | 007 `enforce_project_limit`, 012 `assert_workspace_member`/`assert_authorship`, 015 activity trigger | **A** | Keep as-is. |
| `tasks` | 001, `status`/`priority` `text` + CHECK | none | 007/009 `enforce_task_limit`, 012, 015 | **A** | Keep as-is. Confirms `text` + CHECK is the repo-wide convention. |
| `task_dependencies` | 015: `unique(task_id,depends_on_id)`, `validate_task_dependency()` | none | 3 policies using `is_active_workspace_member` | **A** | Keep as-is. |
| `activities` | 001: `workspace_id`, **`actor_id`** → `auth.users`, `entity_type/id`, `action`, `metadata` | PR #68 silent | 015 `record_workspace_activity()` writes `actor_id`; 026/027 read `actor_id`; `src/app/(app)/activity`, `dashboard`, `api/intelligence/*`, `admin/query.ts`, `admin/types.ts` all read `actor_id` | **A** | **`actor_id` is canonical.** There is no `activities.user_id` anywhere in the repo — nothing to reconcile. |
| `actor_id` vs `user_id` | `activities.actor_id`; `notifications.user_id`; `workspace_members.user_id`; `intelligence_*.user_id`; `admin_audit_log.actor_id` | PR #68 silent | see above | **A** | No conflict. The two names have distinct, consistent meanings: `actor_id` = who did it (nullable, `on delete set null`), `user_id` = who owns/receives it (`on delete cascade`). Documented, not changed. |
| `subscriptions` | **does not exist** | PR #68 silent | — | **A** | No bare `public.subscriptions` anywhere. Do not create one. |
| `workspace_subscriptions` | 007: `workspace_id` → `workspaces`, `plan text` CHECK `(FREE,PRO,TEAM)`, `status text` CHECK, billing stubs, partial unique index `(workspace_id) where status='active'` | PR #68 silent | `get_workspace_plan`, `get_owner_plan` (011), 021 bootstrap, `src/lib/entitlements.ts`, billing/upgrade/admin pages | **A** | Canonical subscription table. FREE creation already idempotent. |
| auth triggers | `on_auth_user_created_profile` → `bootstrap_profile()` (001, re-asserted 020); `on_auth_user_created_workspace` → `create_default_workspace()` (006) | PR #68 silent | 019/020 `bootstrap_profile`, 008/016/018 `create_default_workspace` | **B** | Consolidated by PR #69 (`20260915131000`) into one `on_auth_user_created`. Not this PR's scope. |
| workspace bootstrap | `bootstrap_personal_workspace(uuid)` (018, hardened 021), `ensure_personal_workspace(uuid)`, `get_or_create_personal_workspace()` | PR #68 silent | `src/lib/auth-flow.ts`, `src/app/api/profile/route.ts`, `bootstrap-diagnostics` | **A** | Valid and canonical. PR #69 fixes slug normalisation; not this PR's scope. |
| RLS helpers | `is_active_workspace_member(uuid,uuid)`, `can_manage_workspace(uuid,uuid)` (001), `is_workspace_owner(uuid,uuid)` (017/018) — all SECURITY DEFINER, `search_path = public` | PR #68 wanted them pinned to `public, pg_temp` and granted to `authenticated`+`service_role` | **77 policy call sites** | **B** | **This is the one legitimate intent of PR #68, and it is what `20260915130500` delivers** — against the real signatures. |
| `is_workspace_member` / `has_workspace_role` | do not exist | PR #68 hardens them | 0 consumers | **C + E** | **Not created.** Adding them beside `is_active_workspace_member` puts two names for one rule in front of every future contributor. Decision recorded here so it is not silently re-litigated. |
| intelligence | 023 `intelligence_memory`, 024 `intelligence_signals`, 025 `intelligence_missions` — all `user_id` + `workspace_id`, `text` + CHECK statuses, 12 policies on `is_active_workspace_member` | PR #68 silent | `src/lib/intelligence/*`, `src/app/api/intelligence/*` | **A** | Clean. No modern-contract reference. |
| admin | 026 `platform_admins` (`role`/`status` **text** + CHECK), `admin_audit_log` (`actor_id`); 027 directory functions. No RLS policies — access is asserted in-function via `admin_assert_access()` | PR #68 silent | `src/lib/admin/*`, `src/app/admin/*` | **A** | Clean, and reinforces the finding: **the whole repo uses `text` + CHECK, never enums.** |

---

## 3. The real fork point

There is no fork *inside* the repository. The fork is between the repository and an assumption.

`001_nexus_base_schema.sql` states its own origin in its header:

> *"This repository previously depended on an unversioned hosted schema. Keeping the complete
> base here makes a clean deployment reproducible."*

So the sequence was:

1. The hosted Supabase project carried an **unversioned** schema. Nothing in git described it.
2. `001_nexus_base_schema.sql` was written as a **reconstruction** of that hosted schema, so a
   clean deployment became reproducible. It is the first versioned schema in `master`.
3. `006`–`027` were built on top of it and are internally consistent with it (23 files, 0 failures).
4. `20260915130000` (PR #68) was written against a **mental model of a different base** — its own
   comment says *"The canonical core helpers already exist in `001_nexus_core`"*. That file has
   never been committed. The claim was never verified against the tree.
5. Its test passed anyway, because the test **builds the assumed world itself** instead of
   applying the repository's migrations. The green signal was self-referential.

`GIT_CONSOLIDATION_REPORT.md` records the surrounding condition: the repo history was
reconstructed after repeated shallow re-clones, and *"Pas de base Supabase live dans
l'environnement : les vérifications RLS sont logicielles"*. An unverifiable remote plus a
reconstructed history is exactly how two incompatible baselines end up believed at once.

**The only reference to the other lineage anywhere in the repository is that one comment inside
`20260915130000_nexus_core_contract.sql`.** That is the fork point.

Why PR #69 could not be merged on top: `20260915131000` sorts after `20260915130000`, so any
runner applying the directory in order dies at PR #68 before ever reaching PR #69. This is
already visible on clean `master` — `npm run test:admin` exits 1 with
`admin-control-plane.test.mjs` reporting `FAIL migration applied:
20260915130000_nexus_core_contract.sql`, and `workspace-bootstrap.test.mjs`,
`onboarding-rls.test.mjs` and `migration-logic.test.mjs` each `process.exit(1)` at the same file.

---

## 4. Reconciliation strategy

### 4.1 What to do with `20260915130000_nexus_core_contract.sql`

**Chosen: leave it byte-identical, add a corrective migration with a higher timestamp, and record
it as void for this lineage.** Replacement, in-place edit and inverse migration were all rejected:

- *Edit it in place* — rewrites already-merged history and hides the fact that it was wrong.
- *Inverse migration* — there is nothing to undo. Under a transactional runner it never applied;
  the 7 statements that do parse are benign (`is_active_workspace_member` re-pinned to the same
  value, `is_workspace_owner` replaced by a body identical to 018's, plus revokes/grants that
  `20260915130500` re-states explicitly anyway).
- *Delete it* — loses the audit trail and rewrites merged history.

Corrective migration it is. One consequence must be stated plainly: **a corrective migration
cannot make an earlier one succeed.** In a clean rebuild the runner still reaches `130000` first
and still fails there. Retiring that file is an operator decision (see §6), deliberately kept out
of this PR because it either rewrites merged history or requires a remote
`supabase migration repair`, and both were ruled out for this step.

### 4.2 Timestamp choice

`20260915130500`, not `20260915140000`. It must sort **after** `20260915130000` (it is the
authoritative statement that follows and supersedes it) and **before** `20260915131000` (so the
auth/workspace bootstrap applies only on a reconciled lineage). The existing convention is
`YYYYMMDDHHMMSS_snake_case_name.sql`; `130500` respects it and lands in the only slot that
satisfies both constraints.

### 4.3 How the helpers used by 006–027 are preserved

They are not replaced, re-created or renamed. `20260915130500` only:

1. `ALTER FUNCTION … SET search_path = public, pg_temp` — non-semantic, closes the `pg_temp`
   shadowing hole PR #68 was right to care about;
2. makes the EXECUTE ACL **explicit** — `revoke … from public` plus named grants, instead of
   relying on Supabase platform default privileges nobody wrote down;
3. attaches a `COMMENT` recording which lineage each helper belongs to.

Bodies, signatures, return types and all 77 policy call sites are untouched. Every statement is
guarded by `to_regprocedure`, so the file is a no-op on a database that lacks a given helper.

### 4.4 How modern contracts get introduced later without breaking anything

Not in this PR. The migration path, when someone actually wants it:

1. add the new helper beside the old one (no policy change yet);
2. migrate policies table by table, verifying each with `pg_get_expr` re-planning — the exact
   check harness PHASE 6 automates;
3. only then retire the old name, once a repo-wide grep shows zero call sites.

What must **not** happen is step 0: changing a column type because a migration assumed it.

### 4.5 Enums vs `text` + CHECK

`text` + CHECK stays. It is not an accident or a leftover — it is the consistent convention across
the entire repository: `workspace_members.role/status`, `tasks.status/priority`,
`intelligence_signals.status`, `intelligence_missions.status`, `workspace_subscriptions.plan/status`,
`platform_admins.role/status`, `admin_audit_log.outcome`. Introducing one enum for one column would
make the schema *less* coherent, not more, and would invalidate stored policy expressions (§1).

If enums are ever genuinely wanted, that is its own PR with its own migration: convert the column,
then recreate every dependent function and policy in the same transaction, then re-run PHASE 6.

### 4.6 FK `auth.users` vs `profiles`

No conflict exists. `profiles.id` **is** the FK to `auth.users(id)` — a shared primary key, the
standard Supabase 1:1. `workspaces.owner_id`, `workspace_members.user_id`, `activities.actor_id`,
`intelligence_*.user_id` and `platform_admins.user_id` all reference `auth.users(id)` directly,
which is correct: they are auth-scoped facts, not profile-scoped ones. Nothing to change.

### 4.7 `activities.actor_id` vs `activities.user_id`

No conflict exists. `activities.user_id` appears nowhere in the repository. `actor_id` is written
by `record_workspace_activity()` (015) and read by 026, 027 and six `src/` files. The naming split
is deliberate and consistent — `actor_id` is nullable with `on delete set null` (history survives
the user), `user_id` is `not null` with `on delete cascade` (data belongs to the user). Documented,
not changed.

### 4.8 Supabase migration history compatibility

Supabase keys history on the filename prefix before the first `_`. This repo mixes two schemes:
`001`…`027` (short) and `20260915130000`… (timestamp). Both are valid version strings and both
sort correctly **as text** (`'0' < '2'`), which is why the directory order happens to be the right
application order. `20260915130500` follows the timestamp scheme and slots between the two
existing timestamped files without ambiguity.

---

## 5. The two scenarios, explicitly

### Scenario A — clean database rebuilt from the repository

`001 → 006…027 → 20260915130500 → 20260915131000` applies cleanly, **0 failures**, and produces a
coherent tenant bootstrap (harness PHASE 1, 4, 5). `20260915130000` **cannot** be part of this
chain and is excluded from it.

Consequence, stated honestly: as long as `20260915130000_nexus_core_contract.sql` remains in
`supabase/migrations/`, a plain `supabase db reset` — which applies every file in order — still
fails at that file. **This PR does not and cannot fix that**, because fixing it means either
editing/removing an already-merged migration or fabricating an enum that breaks 14 policy call
sites. The follow-up is §6.

### Scenario B — existing remote database whose history already contains `001`–`005`

Untouched and unresolvable from here: inspecting or repairing remote history is a remote operation,
forbidden for this step. What can be said without touching it:

- Its recorded version `001` **collides** with this repo's `001_nexus_base_schema.sql`. A
  `db push` would consider `001` already applied and skip it, while `002`–`005` exist remotely and
  not locally — Supabase reports those as remote-only and refuses to proceed without an explicit
  repair.
- If that remote really carries lineage A, then `20260915130000` may well have applied there
  successfully, and its `can_manage_workspace()` body would be comparing an enum column to an enum
  array — coherent *there*, incompatible *here*.
- `20260915130500` is **safe on both**: every statement is guarded by `to_regprocedure` /
  `to_regclass`, so on a lineage-A database where `can_manage_workspace(uuid, uuid)` does not
  exist, it simply does nothing. It cannot break either world.

Scenario B needs a decision from someone with remote access: either the remote is authoritative
(and this repository's `001` must be reconciled *to it*, in a separate effort), or the repository
is authoritative (and remote history must be repaired). This PR deliberately does not pick.

---

## 6. Recommended follow-ups (out of scope here)

1. **Retire `20260915130000_nexus_core_contract.sql`.** It is unappliable on the lineage of record
   and has zero consumers. A forward commit deleting the file — plus
   `supabase/tests/core-contract.test.mjs`, which only passes against a fixture it invents — is the
   smallest honest fix and would unblock `npm run test:admin` and every whole-directory harness.
   Kept out of this PR because the instruction was to leave it byte-identical.
2. **Settle scenario B** with someone holding remote access, then write the outcome down here.
3. **Decide the `anon` EXECUTE question deliberately.** `20260915130500` preserves today's
   effective behaviour (anon keeps EXECUTE, because RLS policy expressions are evaluated as the
   invoking role and revoking would turn "zero rows" into a hard error). But
   `is_active_workspace_member(uuid, uuid)` and `can_manage_workspace(uuid, uuid)` accept an
   explicit `p_user_id`, so any caller can use them as a boolean oracle about a third party. That
   is pre-existing, not introduced here. Closing it means a `auth.uid()`-only variant plus a policy
   sweep — its own PR.
4. **Re-run PR #69's suite against the reconciled chain** once this lands. Harness PHASE 5 already
   does exactly that and PR #69 passes unchanged, so no edit to `20260915131000` is expected.

---

## 7. What the harness proves

`supabase/tests/lineage-reconciliation.test.mjs`, PGlite, no remote access, no `db reset`:

| Phase | Proves |
|---|---|
| 1 | `001` then `006`–`027` (23 files) apply with **0 failures**; the three canonical helpers exist as `(uuid, uuid)`; PR #68's objects do **not** exist; `role`/`status` are `text`; `activities.actor_id` exists and `activities.user_id` does not |
| 2 | `20260915130000` replayed statement by statement on an isolated DB: **6 of 13 fail**, all with exactly the missing-helper or missing-enum error, and the **first** statement is already fatal |
| 3 | Creating both enums still does **not** let PR #68's `can_manage_workspace()` be created — `operator does not exist: text = workspace_member_role` |
| 4 | `20260915130500` applies cleanly and creates **no policy, no function, no column, no enum**; all three helpers become SECURITY DEFINER with `search_path = public, pg_temp`; ACLs are explicit; the lineage decision is recorded as COMMENTs |
| 5 | Migration order puts the reconciliation between PR #68 and PR #69; `20260915131000` then applies cleanly and signup still yields 1 profile / 1 workspace / 1 owner membership / 1 FREE subscription, with correct slug normalisation |
| 6 | Every stored RLS policy expression still re-plans via `pg_get_expr` — the check a column-type conversion would have failed; RLS still enabled on the tenant tables |
| 7 | `20260915130000` is the **only** migration referencing the void contract in executable SQL (prose and `COMMENT` literals excluded by a tokeniser), with a positive control proving the scanner detects real references; no migration references a bare `public.subscriptions` |
| 8 | `20260915130500` is idempotent: re-applying creates no duplicate function, each helper keeps exactly one signature, all three stay pinned |
