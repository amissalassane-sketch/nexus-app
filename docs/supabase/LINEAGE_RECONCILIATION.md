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

Its very first statement **was** an unguarded `ALTER FUNCTION` on a function that does not exist,
so under any transactional runner the whole file rolled back and nothing was repaired. It has
since been neutralised — see §4.1.

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
| `public.is_active_workspace_member(uuid, uuid)` | **43 occurrences, 39 inside stored policies** | 001 24 (21 pol.), 015 3 (3), 016 1, 023 5 (5), 024 5 (5), 025 5 (5) |
| `public.can_manage_workspace(uuid, uuid)` | **8 occurrences, 4 inside stored policies** | 001 7 (4 pol.), 016 1 |
| `public.is_workspace_owner(uuid, uuid)` | **7 occurrences, 1 inside a stored policy** | 017 4 (1 pol.), 018 3 |
| `public.is_workspace_member(uuid)` | **0** | only inside `20260915130000` + its own test fixture |
| `public.has_workspace_role(uuid, enum[])` | **0** | only inside `20260915130000` + its own test fixture |
| `public.workspace_member_role` | **0** | only inside `20260915130000` + its own test fixture |

Counts above are reproducible: they are occurrences of the bare identifier in **executable SQL
only** — `--` comments and string literals stripped by a tokeniser, including inside `DO $$ … $$`
bodies — so prose and `COMMENT` text never inflate them. `grep -c` on the raw file gives larger,
misleading numbers.

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
| RLS helpers | `is_active_workspace_member(uuid,uuid)`, `can_manage_workspace(uuid,uuid)` (001), `is_workspace_owner(uuid,uuid)` (017/018) — all SECURITY DEFINER, `search_path = public` | PR #68 wanted them pinned to `public, pg_temp` and granted to `authenticated`+`service_role` | **44 occurrences inside stored policy expressions** (58 total) | **B** | **This is the one legitimate intent of PR #68, and it is what `20260915130500` delivers** — against the real signatures. |
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

**Chosen: neutralise the file in a forward commit, and add a corrective migration with a higher
timestamp as the authoritative contract.** Two changes, one logical decision:

1. `20260915130000_nexus_core_contract.sql` is rewritten **in place, by a new forward commit**,
   into a guarded no-op. The PR #68 commit itself is untouched — this is not a history rewrite,
   no force push, no amend. Every function body is gone; what remains is a single `DO` block that
   pins `search_path = public, pg_temp` and makes the EXECUTE ACL explicit **for whichever of the
   five helpers actually exist**, each statement guarded by `to_regprocedure`. It creates nothing:
   no type, no table, no function, no policy, no trigger.
2. `20260915130500_nexus_lineage_reconciliation.sql` states the real contract and is authoritative.

Alternatives rejected:

- *Leave it byte-identical* — was the first choice, and it is the one thing that does **not** work:
  a corrective migration **cannot make an earlier one succeed**. The runner reaches `130000` first,
  its opening statement is an unguarded `ALTER FUNCTION` on a function that does not exist, and a
  plain `supabase db reset` dies there. Every whole-directory harness inherits that failure.
- *Inverse migration* — there is nothing to undo. Under a transactional runner the file never
  applied; the 7 statements that did parse were benign.
- *Delete the file* — loses the audit trail, and worse, makes a remote database that already
  recorded version `20260915130000` report it as remote-only, so `db push` would refuse without
  `--include-all` or a `migration repair`. Both are remote operations. Neutralising keeps the
  **version key stable in every world**, which is why it was preferred.

The trade-off accepted, stated plainly: a misleading filename survives in `supabase/migrations/`.
It is mitigated by a 60-line header recording exactly what it assumed, why that is void, and where
the real contract lives — plus `supabase/tests/core-contract.test.mjs`, converted into a canary
that fails loudly if anyone revives the enum contract.

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

Bodies, signatures, return types and all 44 stored policy-expression occurrences are untouched.
Every statement is
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

**The entire directory now applies in one pass.** `001 → 006…027 → 20260915130000 →
20260915130500 → 20260915131000` — all **26 files**, in plain sorted order, **0 failures**
(harness PHASE 9). Signup on that chain yields 1 profile / 1 workspace / 1 owner membership /
1 FREE subscription, and exactly one `auth.users` trigger survives.

This is the concrete payoff of neutralising rather than merely superseding `130000`: a runner that
applies every file in order — which is what `supabase db reset` does — **now succeeds**. It did not
before, and no corrective migration placed after `130000` could ever have fixed that.

Measured consequence on the test suite: `npm run test:admin` went from **exit 1** (one suite
reporting `FAIL migration applied: 20260915130000_nexus_core_contract.sql`, three others
`process.exit(1)` at the same file) to **exit 0** with six suites green — 58/0, 117/0, 114/0,
105/0, 100/0, 139/0.

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

1. ~~**Retire `20260915130000_nexus_core_contract.sql`.**~~ **DONE.** Neutralised to a guarded
   no-op in a forward commit, and `supabase/tests/core-contract.test.mjs` converted from a
   self-referential fixture test into a retirement canary (21 assertions). `npm run test:admin`
   and every whole-directory harness are unblocked. The file was kept rather than deleted so the
   remote version key stays stable — see §4.1.
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

---

## Annex A — Inventory of the lineage of record

Everything below was read directly out of the migration files; nothing is inferred.

### A. Tables created by `001_nexus_base_schema.sql`

`profiles` · `workspaces` · `workspace_members` · `goals` · `projects` · `tasks` · `activities` ·
`notifications` — **8 tables**, all `if not exists`.

Added later by `006`–`027`: `workspace_subscriptions` (007), `task_dependencies` (015),
`intelligence_memory` (023), `intelligence_signals` (024), `intelligence_missions` (025),
`platform_admins` (026), `admin_audit_log` (026).

### B. Enums / domains / composite types

**Zero.** `create type` and `create domain` counts in `001_nexus_base_schema.sql`: **0** — and 0
across the whole lineage. Every constrained value is `text` + `CHECK`:

| Column | CHECK values | Source |
|---|---|---|
| `workspace_members.role` | `owner, admin, member, viewer` | 001:37 |
| `workspace_members.status` | `active, invited, suspended` | 001:38 |
| `tasks.status` | `todo, in_progress, in_review, blocked, done, cancelled` | 001:78 |
| `intelligence_signals.status` | `new, seen, dismissed, acted, resolved` | 024 |
| `intelligence_missions.status` | `active, blocked, completed, failed, cancelled` | 025 |
| `platform_admins.role` | `owner, operator, viewer` | 026 |
| `platform_admins.status` | `active, revoked` | 026 |
| `admin_audit_log.outcome` | `success, denied, failed` | 026 |
| `workspace_subscriptions.plan` | `FREE, PRO, TEAM` | 007 |

### C. Functions / helpers created by `001`

`is_active_workspace_member(uuid, uuid)` · `can_manage_workspace(uuid, uuid)` ·
`bootstrap_profile()` · `bootstrap_workspace_owner()` · `set_updated_at()` — **5**.

Added later: `is_workspace_owner(uuid, uuid)` (017, re-asserted 018),
`create_default_workspace()` (006), `create_default_subscription()` (007),
`enforce_project_limit` / `enforce_task_limit` / `enforce_member_limit` (007, 009, 021),
`enforce_workspace_limit` + `get_workspace_plan` + `get_owner_plan` (011),
`assert_workspace_member` / `assert_authorship` (012),
`validate_task_dependency` + `record_workspace_activity` (015),
`ensure_personal_workspace` (016, 018), `get_or_create_personal_workspace()` (016, 018, 021),
`bootstrap_personal_workspace(uuid)` (018, 021), `admin_assert_access()` + directory functions
(026, 027).

**Absent from the entire lineage:** `is_workspace_member` · `has_workspace_role` · `handle_new_user`
— **0 occurrences each** in executable SQL, anywhere.

### D. Auth triggers

Chain on `auth.users`, in order:

| Migration | Trigger | Effect |
|---|---|---|
| 001:156–158 | `on_auth_user_created_profile` | → `bootstrap_profile()` |
| 006:46 | `on_auth_user_created_workspace` | → `create_default_workspace()` |
| 020:78–79 | `on_auth_user_created_profile` | replaced, access-first variant |
| 20260915131000:209–214 | drops **all three** names, creates `on_auth_user_created` | single canonical bootstrap |

`016` creates **no** trigger on `auth.users` (verified). After the full chain exactly **one**
auth trigger remains.

### E. Foreign keys

**15 FKs to `auth.users(id)` · 0 FKs to `public.profiles`.**

`profiles.id` *is* the FK to `auth.users(id)` — a shared primary key, the standard Supabase 1:1, so
"FK profiles" and "FK auth.users" are not two competing options here. Distribution:
001 (9: `profiles.id`, `workspaces.owner_id`, `workspace_members.user_id`, `goals.created_by`,
`projects.owner_id`, `tasks.assignee_id`, `tasks.created_by`, `activities.actor_id`,
`notifications.user_id`), 015 (1: `task_dependencies.created_by`), 023/024/025 (1 each: `user_id`),
026 (2: `platform_admins.user_id`, `admin_audit_log.actor_id`).

Deletion semantics are deliberate and consistent: `on delete cascade` where the row belongs to the
user, `on delete set null` where it is a historical actor reference.

### F. `activities` structure

```sql
create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id     uuid references auth.users(id) on delete set null,
  entity_type  text,
  entity_id    uuid,
  action       text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
```

Written by `record_workspace_activity()` (015). **Never altered by `006`–`027`** — no
`alter table public.activities` anywhere. There is no `activities.user_id`.

### G. Dependency map, `006`–`027`

Occurrences of the bare identifier in executable SQL (comments and string literals stripped):

| Symbol | 001 | 006–027 files | Policies |
|---|---|---|---|
| `is_active_workspace_member` | 24 (21 pol.) | 015:3 (3) · 016:1 · 023:5 (5) · 024:5 (5) · 025:5 (5) | **39** |
| `can_manage_workspace` | 7 (4 pol.) | 016:1 | **4** |
| `is_workspace_owner` | — | 017:4 (1) · 018:3 | **1** |
| `bootstrap_profile` | 2 | 019:1 · 020:2 | — |
| `create_default_workspace` | — | 006:2 · 008:2 · 011:1 · 016:4 · 018:1 | — |
| `workspace_subscriptions` | — | 007:9 · 011:1 · 018:1 · 021:1 · 026:9 · 027:4 | — |
| `actor_id` | 1 | 015:1 · 026:2 · 027:5 | — |
| `intelligence_*` | — | 023:12 · 024:14 · 025:14 · 026:6 · 027:2 | — |
| `platform_admins` | — | 026:18 · 027:2 | — |
| `admin_audit_log` | — | 026:19 | — |
| `is_workspace_member` | **0** | **0** | **0** |
| `has_workspace_role` | **0** | **0** | **0** |
| `workspace_member_role` | **0** | **0** | **0** |
| `handle_new_user` | **0** | **0** | **0** |

`user_id` is pervasive (001:17 plus nearly every file in `006`–`027`) and means "owner or
recipient", never "actor" — `activities` and `admin_audit_log` use `actor_id` for that, both
nullable with `on delete set null` so history outlives the user.

**`subscriptions` as a bare table: none.** 27 textual occurrences in `006`–`027`, of which 25 are
`workspace_subscriptions` and the rest are prose; a `(from|into|table|join|update) subscriptions`
scan returns nothing.

---

## Annex B — Git status of `001_core` … `005_worker`

Required determination: tracked / untracked / ignored / absent from master / local-workspace-only.

**Verdict: absent, everywhere. Not merely uncommitted.**

| Check | Command | Result |
|---|---|---|
| On disk in the repo (ignored dirs included) | `find . -name '00[1-5]_nexus_core.sql' …` | **nothing** |
| Anywhere in the workspace | `find /home/user -name '00[1-5]_nexus_*.sql'` | only `001_nexus_base_schema.sql` (pattern false-positive) |
| Untracked or ignored under `supabase/` | `git status --porcelain --ignored=matching` | **empty** |
| Excluded by an ignore rule | `git check-ignore -v` on all five paths | **not ignored** (all five would be visible if present) |
| Ever committed on any ref | `git log --all --diff-filter=A --name-only` | **never added** |
| Recoverable from a dangling object | `git fsck --dangling` | 1 commit + 1 blob: the commit is a stash-style `WIP on arena/01a0a584-nexus-app` whose tree contains **none** of the five; the blob is a PGlite JS harness, not SQL |
| Other remotes / branches | `git branch -r` | `origin/master` only |

So there is nothing to decide about *files* — there is no local copy. The "001–005 history" exists,
if at all, only in the **remote project's `supabase_migrations.schema_migrations` table**, which is
scenario B (§5) and cannot be inspected without remote access.

### Recommended destination, if they are ever retrieved (§7 decision)

**Archive outside `supabase/migrations/`; never restore them into Git as migrations.**

Concretely: `docs/supabase/remote-history-reference/` with a README marking them read-only forensic
evidence. Justification:

1. The migration runner scans only `supabase/migrations/`, so anything placed elsewhere cannot be
   applied by accident — which is exactly the failure mode that produced PR #68.
2. The filename prefix before the first `_` is Supabase's version key. Restoring `001_nexus_core.sql`
   beside `001_nexus_base_schema.sql` creates **two migrations claiming version `001`**; `db push`
   and the local runner would disagree about which one that version means.
3. They are needed for exactly one purpose — settling scenario B — and that purpose is served by
   *reading* them, never by *applying* them.
4. Deleting them is not an option either: rule 5 forbids removing a migration without proof, and
   here there is nothing to remove. Do not fabricate a deletion.

If they are never retrieved, the correct action is **none** — and §5's scenario-B decision should
then be taken on the remote's recorded version list alone.

---

## Annex C — Forward migration plan

The five domains the roadmap names are **already schema-complete in the lineage of record**.
Verified, not assumed: Freemium is 007/008/009/011 around `workspace_subscriptions`; Activity is
001 + 015 around `activities.actor_id`; Intelligence is 023/024/025 with 12 policies on
`is_active_workspace_member`; Admin is 026/027 with function-level `admin_assert_access()` instead
of RLS. **No new table, enum or helper is required for any of them**, and inventing some would
repeat PR #68's mistake.

What actually remains is retirement of the void contract, settlement of the remote, and coverage.
One logical change per PR:

### ~~PR-B — retire the void core contract~~ — DONE, folded into PR-A

| | |
|---|---|
| **What was done** | `20260915130000_nexus_core_contract.sql` neutralised in place by a forward commit: all function bodies removed, replaced by one `DO` block that pins `search_path` and makes the EXECUTE ACL explicit for whichever helpers actually exist, every statement guarded by `to_regprocedure`. `core-contract.test.mjs` converted into a retirement canary |
| **Objective** | make the whole-directory chain appliable end to end, so `db reset` and every harness scanning `supabase/migrations/` stop dying at `130000` |
| **Tables** | none — the retired file creates nothing |
| **Functions** | none created, none removed. It may pin `search_path` / set ACLs / add COMMENTs on helpers that already exist; `prosrc`, signature and return type are asserted unchanged |
| **Dependencies** | `20260915130500` remains the authoritative contract and sorts right after |
| **Risks** | **Closed.** The remote-divergence risk that made deletion unattractive does not apply: the version key `20260915130000` is preserved, so a remote that already recorded it stays consistent. Residual risk is cosmetic — a misleading filename, mitigated by its header and by the canary |
| **Result** | 26/26 files apply in one pass, 0 failures. `npm run test:admin` exit 1 → **exit 0** |

### PR-C — `settle scenario B`

| | |
|---|---|
| **Exact change** | no migration. A decision recorded in §5 plus, if the remote turns out to carry lineage A, a reconciliation *to the remote* planned as its own effort |
| **Objective** | establish whether the repository or the remote is authoritative, so `db push` becomes possible at all |
| **Tables / functions** | none |
| **Dependencies** | requires someone with remote read access (`supabase migration list` is a read-only remote call — still forbidden in this phase) |
| **Risks** | If lineage A really exists remotely, its `can_manage_workspace()` compares enum to enum and is coherent *there* while being incompatible *here*; picking the wrong source of truth would then break whichever side is discarded. `130500` is existence-guarded and therefore safe on both |
| **Order** | **1st or 3rd** — it does not block PR-B technically, but it should precede PR-B's `db push` |

### PR-D — `close the anon oracle on the membership helpers`

| | |
|---|---|
| **Exact change** | add `auth.uid()`-only variants (`is_active_workspace_member()` / `can_manage_workspace()` with no `p_user_id`) and sweep policies to them; then revoke EXECUTE from `anon` |
| **Objective** | stop any caller using `is_active_workspace_member(uuid, uuid)` as a boolean oracle about a third party |
| **Tables** | none |
| **Functions** | the three canonical helpers + 39 stored policy expressions |
| **Dependencies** | PR-A merged. Independent of PR-B |
| **Risks** | **Highest-risk item in this plan.** A policy expression evaluated as `anon` that cannot EXECUTE the helper turns "zero rows" into a hard error. Must be done with the §7-PHASE-6 `pg_get_expr` re-plan check plus an explicit `anon`-role smoke test per table. Pre-existing debt — `130500` preserves today's behaviour deliberately rather than changing it silently |
| **Order** | **4th**, and only if the team accepts the sweep |

### PR-E — `add supabase/config.toml`

| | |
|---|---|
| **Exact change** | a committed `supabase/config.toml` (and `supabase/.gitignore`) pinning project id, ports and the migration path |
| **Objective** | make `supabase start` / `db reset` reproducible for every contributor |
| **Tables / functions** | none |
| **Dependencies** | none |
| **Risks** | Low, but it is a **new decision** (ports, project id) rather than a correction, so it is its own PR. Note this is the structural cause of the whole incident: with no committed config, nobody could run the chain locally, and a self-referential test became the only signal |
| **Order** | **any time**; earlier is better |

### Domain work — Auth/Workspace, Freemium, Activity, Intelligence, Admin

No schema migration is required to *start* any of them. What each needs is coverage proving the
existing schema still holds after PR #69's bootstrap rewrite:

| Domain | Schema state | Needed before building on it |
|---|---|---|
| Auth + Workspace bootstrap | complete (131000) | nothing — PHASE 5 already proves 1 profile / 1 workspace / 1 owner membership / 1 FREE subscription, single trigger |
| Freemium | complete (007/008/009/011) | a test that plan limits still enforce through the **new** bootstrap path, since `131000` now inserts the FREE row itself while `007`'s `trg_default_subscription` still exists. `131000` coordinates via `to_regprocedure('public.create_default_subscription()')`, and PHASE 5 observes exactly one subscription — but that invariant deserves its own assertion |
| Activity | complete (001 + 015) | nothing. `actor_id` canonical, table never altered by `006`–`027` |
| Intelligence | complete (023/024/025) | nothing schema-wise |
| Admin | complete (026/027) | nothing schema-wise; note it uses function-level `admin_assert_access()` and has **no RLS policies**, so the `pg_get_expr` sweep does not cover it |

**Naming convention for everything after this point:** timestamp scheme
`YYYYMMDDHHMMSS_snake_case.sql`. The repo currently mixes `001`–`027` with timestamps; both sort
correctly as text, but new files should not extend the short scheme.
