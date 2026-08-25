# NEXUS — Workspace Bootstrap Fix Report

**Symptom:** after a fresh account signs up → confirms its email → signs in,
the app was stuck **indefinitely** on the full-screen
"Preparing your workspace…" state and never reached `/app`.

**Verdict:** root cause reproduced on a real Postgres + real RLS stack, fixed
end-to-end (database + application + UX + observability), and verified by a
real fresh-account run that **reaches `/app` and the dashboard in ~1.5s** —
see §8. This fix is claimed on the strength of that test.

---

## 1. Exact root cause

Three independent defects compounded into the indefinite hang:

1. **Unbounded advisory-lock wait in the bootstrap RPC (database).**
   Migration `018_harden_onboarding_bootstrap.sql` defines
   `bootstrap_personal_workspace(uuid)` (the function behind the
   `get_or_create_personal_workspace()` RPC and the signup trigger) and it
   serialised per-user bootstraps with a **plain, unbounded**
   `pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0))`. Whenever
   another transaction held that per-user lock — a slow signup commit, a
   wedged pooled connection, any long-lived open transaction — the RPC
   blocked for as long as the holder lived. A Postgres advisory-lock wait
   has **no built-in timeout**, and real PostgREST sets no
   `statement_timeout`, so the RPC — and therefore the server-component
   render of `/app` and `/dashboard`, which awaits it — hung with no bound.
   This is the production mechanism; it was reproduced exactly (see §7).

2. **The application swallowed every bootstrap error (frontend/server).**
   `ensurePersonalWorkspaceServer()` in `src/lib/auth-flow.ts` ended in a
   bare `catch { return null }` with zero logging. A failing RPC was
   indistinguishable from a slow one; nobody — the app, the logs, the user —
   could tell what Postgres was actually doing.

3. **The layout rendered a full-screen blocker with no timeout (UI).**
   `src/app/(app)/layout.tsx` rendered the full-screen
   `WorkspacePreparing` component whenever the RLS membership read came back
   empty, with a **manual Refresh button as the only control** and **no
   timeouts anywhere** in the render path. Refresh simply re-ran the same
   failing RPC, so any *persistent* failure condition (lock held by a wedged
   transaction, a `PGRST202` stale PostgREST schema cache after deploying
   016/018, a plan-limit trip on corrupted state) pinned the user on that
   screen forever.

A secondary latent defect made the failure *silent* instead of *structured*:
in 018, `get_or_create_personal_workspace()` verified the owner membership
with an `if not found then raise` placed **after** `RETURN QUERY` —
unreachable code. A missing membership therefore surfaced as a silent empty
result set (→ the blocking screen) instead of a structured error.

**Additional finding from the migration audit (spec §11):**
`bootstrap_personal_workspace(uuid)` took an arbitrary `uuid` parameter with
**no owner validation** and was protected only by
`revoke … from public`. On Supabase, platform *default privileges* grant
execute on every public function to `anon`/`authenticated` at creation time,
and `revoke from public` does **not** remove those explicit ACL entries — so
the internal implementation was callable by client roles with a foreign
uuid. Closed in 021 (see §4 and §6).

## 2. Why the previous implementation could hang (mechanism + evidence)

The hang requires all three defects: (1) makes the RPC block without bound,
(2) makes the block invisible, (3) renders a screen whose only exit is a
button that re-triggers (1).

Measured evidence (real PostgreSQL, real RLS, real triggers; the test rig is
a GoTrue/PostgREST-compatible stand-in over the same migration chain):

| Stack | Lock held 30s | Per `/dashboard` load | What the user saw |
|---|---|---|---|
| BEFORE app + 001–020 DB (production state) | unbounded wait | **15 050 ms** (bounded only by the test rig's 15s `statement_timeout`; **indefinite on real PostgREST**) | only the "Preparing your workspace…" screen, every time |
| BEFORE app + 021 DB | 8s DB bound | **8 055 ms** | *still* only the blocking screen (old layout gates on membership) |
| AFTER app + 021 DB (this fix) | 8s DB bound | **8 810–8 840 ms** (8s bounded RPC + 750ms settle) | **full product renders** with a controlled failure banner; no stuck screen |
| AFTER app + 021 DB, lock released | — | **56 ms** | clean product, banner gone |

After the lock is released, the very next render completes normally —
proving the failure mode was *waiting on the lock*, not corrupted state.

## 3. Exact files changed

| File | Change |
|---|---|
| `supabase/migrations/021_workspace_bootstrap_bounded_observability.sql` | **NEW** — bounded lock wait, structured errors, DB-side markers, owner-re-claim repair, owner validation, explicit revokes, `NOTIFY pgrst` (details in §4) |
| `src/lib/bootstrap-diagnostics.ts` | **NEW** — `logBootstrapEvent()` (structured `[nexus:bootstrap]` JSON on stderr; bounded messages; no credentials), `classifyBootstrapError()` → structured kinds, `summarizeError()` |
| `src/lib/auth-flow.ts` | **MODIFIED** — `ensurePersonalWorkspaceServer()` now returns `{membership, error}` (structured kind) instead of swallowing; 10s bounded RPC via exported `withTimeout()`; supabase-js thenable normalised to a Promise; `ensureProfileServer()` bounded at 5s and still non-fatal; `getPostAuthDestination()` logs `AUTH_SESSION_CREATED` / `AUTH_POST_AUTH_BOOTSTRAP_NOT_READY` and **always** returns `/app` |
| `src/app/(app)/layout.tsx` | **REWRITTEN** — `requireUser()` is the only hard gate; profile repair is best-effort; bootstrap + RLS membership read both bounded; **one** server-side settle retry (750ms; re-runs the RPC only when it hadn't already failed, otherwise only re-reads the membership); shell data (counts/name/plan) bounded at 8s and degrades to empty states; **always** renders `AppShell`; when not ready it renders `WorkspaceStatusBanner` inside the shell; emits `DASHBOARD_RENDER_STARTED` / `DASHBOARD_RENDER_DEGRADED` |
| `src/components/workspace-status-banner.tsx` | **NEW** — in-product, non-blocking status banner (copy in §5), one automatic `router.refresh()` after 2.5s in `preparing`, Retry / Continue in `failed`, `role="status" aria-live="polite"` |
| `src/components/workspace-preparing.tsx` | **DELETED** — the full-screen blocking component; no references remain |
| `src/app/api/profile/route.ts` | **MODIFIED** — consumes the structured `{membership, error}` bootstrap result and reports the kind (never raw DB text) |
| `supabase/tests/onboarding-rls.test.mjs` | **MODIFIED** — denial matcher also accepts the `23505` unique-constraint rejection (owner re-claim/duplicate writes are now stopped by the unique `(workspace_id, user_id)` constraint firing before RLS — a legitimate server-side denial) |
| `supabase/tests/workspace-bootstrap.test.mjs` | **NEW** — 33 deterministic PGlite tests for the 021 contracts (bounded-lock source contract, observability markers, grant contract, owner validation, owner re-claim at the member cap, structured-error contract, RPC grants) |

No route, policy, table, or trigger definition other than the functions above
was touched. No fake projects/tasks/goals/profiles were created anywhere in
the code path — the dashboard renders **real empty states**.

## 4. Exact DB / migration changes

One new migration, `021_workspace_bootstrap_bounded_observability.sql`
(additive, `create or replace` only — no RLS policies, table definitions, or
grant expansions changed):

1. **`bootstrap_personal_workspace(uuid)` — bounded lock + observability +
   owner validation.**
   - The unbounded `pg_advisory_xact_lock()` is replaced by a
     `pg_try_advisory_xact_lock()` + `pg_sleep(0.1)` retry loop with a hard
     **8 000 ms** bound. The wait loop holds no row locks, so it cannot
     participate in a deadlock. On expiry it raises
     `'WORKSPACE_BOOTSTRAP_TIMEOUT: bootstrap lock still held after 8000ms'`
     with `errcode = '55P03'` (lock_not_available). 8s < the application's
     10s RPC bound, so the database always reports first.
   - **Owner validation (audit finding):** when a JWT identity is present
     (`auth.uid()` non-NULL — i.e. client context), the function now raises
     `WORKSPACE_ACCESS_DENIED … 42501` unless `p_user_id = auth.uid()`.
     Internal contexts (the signup trigger, service connections without
     claims) have `auth.uid()` NULL and remain trusted.
   - `RAISE WARNING` markers are emitted at every stage:
     `WORKSPACE_BOOTSTRAP_STARTED`, `WORKSPACE_FOUND` / `WORKSPACE_CREATED`,
     `MEMBERSHIP_FOUND` / `MEMBERSHIP_CREATED` / `MEMBERSHIP_REPAIRED`,
     `SUBSCRIPTION_FOUND` / `SUBSCRIPTION_CREATED`,
     `WORKSPACE_BOOTSTRAP_COMPLETED` — so the bootstrap state is observable
     in the Postgres server log itself.
   - The final ownership verification raises
     `WORKSPACE_ACCESS_DENIED … 42501` if an owner/active membership cannot
     be established (no success on a partially repaired state).
2. **`get_or_create_personal_workspace()` — structured error instead of a
   silent empty set.** The membership check moved **before** `RETURN QUERY`;
   a missing membership now raises
   `'WORKSPACE_MEMBERSHIP_FAILED: …'` with `errcode = 'P0001'`.
3. **`enforce_member_limit()` — owner re-claim is repair, not a new
   member.** When the row being inserted re-establishes ownership
   (`NEW.role = 'owner'` **and** `workspaces.owner_id = NEW.user_id`), the
   member cap no longer applies. This unstrands the orphaned owner of a
   member-capped workspace (pre-021: `PLAN_LIMIT_EXCEEDED` forever). The skip
   is narrower than the existing `base_members_self_claim_owner` RLS policy
   (same ownership + role conditions), so no privilege expansion.
4. **Grants.** `revoke … from public` on both internal functions **plus new
   explicit revokes of execute on `bootstrap_personal_workspace(uuid)` from
   `anon` and `authenticated`** (guarded `DO` blocks) — because Supabase
   default privileges leave explicit ACL entries that `revoke from public`
   does not remove. `ensure_personal_workspace(uuid)` and
   `get_or_create_personal_workspace()` remain executable by
   `authenticated` (re-granted, guarded).
5. **`NOTIFY pgrst, 'reload schema'`** so a live deployment's PostgREST does
   not keep serving `PGRST202` (stale cache) for the replaced functions —
   itself a past cause of the stuck screen after 016/018 deploys.

`SECURITY DEFINER` + `set search_path = public, pg_temp` are retained on all
functions. The migration applies cleanly on a fresh 001→020 chain (verified
on real Postgres and PGlite).

## 5. Exact UX changes

- **LOGIN → /app → DASHBOARD, always.** There is no "Preparing your
  workspace" page anymore. `workspace-preparing.tsx` (the full-screen
  blocker with its lone Refresh button) is deleted. The user sees NEXUS the
  moment auth completes, even while the workspace is still bootstrapping.
- **Workspace init is transparent.** The layout runs the idempotent, bounded
  bootstrap server-side on each product render. Happy path: the user never
  sees anything — `/app` renders the product in ~1.5s end-to-end.
- **If the workspace is not ready, the product renders around a controlled
  in-product banner** (inside the shell, above the dashboard — not a
  separate page, not a form, not a redirect):
  - *preparing*: **"Your workspace is being prepared."** / "You can already
    explore NEXUS while we finish setting things up. This usually takes less
    than a second." + **[Retry]**. One automatic server re-render after 2.5s
    usually makes it disappear on its own.
  - *failed*: **"We couldn't finish preparing your workspace."** / "NEXUS is
    ready to use. You can continue now and retry the workspace setup when
    convenient (reason: `<structured kind, humanised>`)." + **[Retry]** +
    **[Continue to NEXUS]** (dismisses the banner; the product keeps
    working with real empty states).
- **Only workspace-bound actions stay inert** until the membership is
  resolved: the project/task/goal managers resolve the membership client-side
  and disable creation when there is no workspace id. Everything else
  (navigation, settings, notifications, profile completion) works.
- **No fake data.** Empty workspaces show real empty states (0 projects,
  0 tasks, 0 goals — actual counts from the DB), never invented content.
- **Every async bootstrap operation is bounded** — nothing can hold a render
  open indefinitely:

| Operation | Bound | Failure surface |
|---|---|---|
| DB advisory-lock wait (021) | 8 000 ms | `55P03` → `WORKSPACE_BOOTSTRAP_TIMEOUT` |
| Bootstrap RPC (app) | 10 000 ms | `WORKSPACE_BOOTSTRAP_TIMEOUT` |
| RLS membership read | 5 000 ms | banner state (retryable) |
| Profile orphan repair / read | 5 000 ms | fallback identity (non-fatal) |
| Shell data (counts/name/plan) | 8 000 ms | empty states (non-fatal) |
| Server settle retry | one, after 750 ms | — |
| Client auto-retry | one, after 2 500 ms | — |

- **Raw Supabase/Postgres errors are never shown to users.** The user sees
  the structured kind at most (e.g. "reason: workspace bootstrap timeout");
  full technical detail (SQLSTATE, bounded Postgres message, hints) is
  logged server-side only.

## 6. Security implications

- **RLS was not weakened.** No policy was added, modified, or disabled; no
  table is publicly writable; no arbitrary membership insertion is possible.
  The duplicate self-claim path is now stopped by the existing unique
  `(workspace_id, user_id)` constraint (firing before RLS evaluation) and/or
  RLS — verified denied in the RLS suite.
- **No client-provided workspace id is trusted.** The layout derives the
  workspace context exclusively from the RLS-verified membership
  (`getActiveMembership`); a workspace id the RLS layer cannot see simply
  produces an empty, honest dashboard plus the banner state.
- **Internal RPC surface closed (audit fix).** `bootstrap_personal_workspace`
  is now unreachable by `anon`/`authenticated` (explicit revokes that beat
  Supabase default privileges) *and* validates `auth.uid()` ownership when a
  client identity is present. Verified on real Postgres: cross-user call →
  `42501 WORKSPACE_ACCESS_DENIED`; self-call → ok; `service_role` (GoTrue
  signup path) → ok.
- **Client RPC contract unchanged.** `get_or_create_personal_workspace()`
  remains the only bootstrap RPC for clients; it takes no arguments and
  operates strictly on `auth.uid()`.
- **Owner re-claim skip is parity, not expansion.** It fires only when
  `role = 'owner'` AND `workspaces.owner_id = user_id` — the same conditions
  the pre-existing self-claim RLS policy requires. Non-owner owner-claims at
  the cap are still denied (verified).
- **Error handling is fail-closed for access, fail-open for the product.**
  A bootstrap failure never grants anything (no workspace id is surfaced);
  it only keeps the product usable around a status banner.
- **Logs contain no credentials** — at most account UUIDs, SQLSTATE codes,
  table names, and bounded Postgres message text.

## 7. Test results

Environment: real PostgreSQL 16 (embedded) running the full 001→021 chain
with Supabase platform state mirrored (roles, `auth.uid()` claims GUC,
default privileges, RLS), a GoTrue/PostgREST-compatible stand-in driving the
real app, and PGlite suites for deterministic DB contracts.

| Suite | Result |
|---|---|
| **Production build** (`npm run build`, TypeScript + Next 16 Turbopack) | **PASS** |
| **ESLint** (`npm run lint`) | **PASS — 0 problems** |
| **PGlite `workspace-bootstrap.test.mjs`** (NEW — 021 contracts: bounded-lock source contract, no unbounded `pg_advisory_xact_lock`, 55P03 path, 8 observability markers, grant contract, cross-user denial even when execute is granted, self-call, owner re-claim at PRO cap with 5 non-owner members + no owner row, cap still enforced for regular members, non-owner claim denied, RPC convergence, structured-error ordering, RPC grants) | **33 / 33 PASS** |
| **PGlite `onboarding-rls.test.mjs`** (full RLS + onboarding matrix incl. cross-workspace attacks, orphan repair, historical bootstrap sequence, invited-user isolation, minimal-profile access) | **43 / 43 PASS** |
| **PGlite `migration-logic.test.mjs`** (plan limits, trigger behaviour across the chain) | **63 / 63 PASS** |
| **Real-PG concurrency/idempotency** (`db-concurrency.mjs`): 8 simultaneous bootstraps racing an open signup transaction (all resolve to the same workspace, 1 ws / 1 membership / 1 subscription, ~250 ms after commit); refresh re-run idempotent; missing-membership repair; suspended-membership re-activation without duplicate; existing account untouched; invited user keeps own workspace | **16 / 16 PASS** |
| **Real-PG security checks**: authenticated direct call denied (42501, ACL); cross-user call denied by owner validation even with execute granted; self-call ok; `service_role` internal path ok; victim state untouched; anon call denied | **6 / 6 PASS** |
| **App E2E** (`supabase/tests/auth-flow.test.mjs` — real app + repo stub: signup/confirm/login/OAuth new+incomplete+complete+error+cancel+replay+refresh+re-login, first-value dashboard, profile completion, session persistence, expired-token refresh, route protection, API contract, resend, logout) | **109 / 109 PASS** |
| **Bounded-failure app test** (lock held 30s, 3 sequential `/dashboard` loads + final load): every failing load 200 in ~8.8s with product rendered + failure banner (no stuck screen); final load after release 56ms clean | **PASS** |
| **Diagnostic event stream** (app log + Postgres log): `AUTH_SESSION_CREATED` → `WORKSPACE_BOOTSTRAP_STARTED` → `WORKSPACE_BOOTSTRAP_COMPLETED/FAILED(kind=WORKSPACE_BOOTSTRAP_TIMEOUT, code=55P03)` → `DASHBOARD_RENDER_DEGRADED` → `DASHBOARD_RENDER_STARTED(workspaceReady)` observed end-to-end; DB-side `RAISE WARNING` markers (`WORKSPACE_*`, `MEMBERSHIP_*`, `SUBSCRIPTION_*`) present in the Postgres log | **PASS** |
| **Reproduction of the original bug** (BEFORE worktree + 001–020 DB, lock held 30s): 3 loads × 15 050 ms each, every render = only the "Preparing your workspace…" screen — exact reported symptom reproduced | **CONFIRMED** |

Coverage of the spec's 14-case matrix: (1) fresh email account — §8; (2)
new Google account — E2E OAuth suite (stub-backed; a live browser OAuth
round-trip is not possible in this sandbox, and the post-auth code path is
identical: `getPostAuthDestination` → `/app`); (3) existing account — real-PG
"existing untouched" + E2E login; (4) missing membership — real-PG repair
case + PGlite historical sequence; (5) missing workspace — PGlite orphan
repair; (6) refresh during bootstrap — real-PG CASE E + bounded-failure
loads; (7) multiple simultaneous calls — real-PG 8-racer case; (8) bootstrap
timeout → controlled error — bounded-failure test (banner + Retry/Continue);
(9) creation failure → controlled error — 55P03 path + structured kinds;
(10) RLS violation denied — onboarding-rls suite; (11) cross-workspace
denied — onboarding-rls suite; (12) profile incomplete / username missing /
full name missing → `/app` accessible — PGlite minimal-profile cases + E2E
incomplete-profile OAuth case.

## 8. Fresh-account manual verification (the mandatory test)

Executed against the final build, the final migration chain (001–021), real
Postgres, real RLS — fresh email account, full journey, no pre-seeded state:

```
=== DEFINITIVE: fresh account journey -> http://127.0.0.1:3000 (fresh-definitive-1787682151@test.dev) ===
1. signup -> 200 {"ok":true,"requiresConfirmation":true,...}
2. pre-confirm signin -> 401 {"errorCode":"EMAIL_NOT_CONFIRMED"}
3. confirm link: token_hash=4ebd8057...
4. confirm -> 307 location: http://127.0.0.1:3000/app
5. /app -> 200
   visible: NEXUS — Operational Intelligence ... Overview Intelligence Work
   Projects Tasks Goals ... Plan FREE 0/2 projects ...
   >>> reached the product shell
6. /dashboard -> 200
   visible: Overview — NEXUS ... (dashboard rendered, real empty states)
   >>> dashboard rendered
7. /dashboard (refresh) -> 200 >>> rendered
=== done ===   (total journey time ~1.5s; EXIT=0)
```

**The fresh account reached `/app` and the dashboard — no "Preparing your
workspace" screen at any point.** The workspace bootstrap happened
transparently inside the render (`WORKSPACE_BOOTSTRAP_COMPLETED` in the
server log, `DASHBOARD_RENDER_STARTED workspaceReady:true`).

### Acceptance criteria (spec §13)

- [x] Fresh account reaches `/app` (proven, §8)
- [x] No operation can hold a page open indefinitely (every bound in §5;
      worst measured failing load: 8.8s, product rendered)
- [x] `ensurePersonalWorkspace(user.id)` is idempotent (cases A–F covered:
      no workspace / existing workspace+membership / missing membership
      repair / simultaneous requests / refresh mid-bootstrap / failure →
      structured error)
- [x] No blocking onboarding screen; LOGIN → /app → DASHBOARD always
- [x] Controlled in-product failure state with Retry + Continue to NEXUS;
      only workspace-bound actions disabled
- [x] No fake data (real empty states only)
- [x] Non-critical init (profile enrichment) never delays /app (bounded,
      non-fatal)
- [x] No swallowed errors (structured kinds + server-side detail; raw DB
      text never rendered)
- [x] Migration chain audited (016/017/018 reviewed; 021 additive and
      verified)
- [x] RLS not weakened; no client workspace id trusted
- [x] TypeScript, ESLint, production build, auth E2E, workspace bootstrap
      tests, onboarding tests, RLS tests, migration tests, concurrency/
      idempotency tests — all green (§7)

### Reproduction / verification rig (for re-running)

- `supabase/tests/workspace-bootstrap.test.mjs`,
  `supabase/tests/onboarding-rls.test.mjs`,
  `supabase/tests/migration-logic.test.mjs` — `node <file>` from the repo
  root (PGlite; no external services).
- `supabase/tests/auth-flow.test.mjs` — app E2E against the repo stub
  (app on :3000, stub auto-started on :54321).
- The real-Postgres concurrency/bounded-failure/fresh-journey drivers used
  during this engagement live outside the repo (`/tmp/repro/*.mjs`) with an
  embedded PostgreSQL on :55432 and a GoTrue/PostgREST stand-in on :54321;
  they are throw-away harnesses, not part of the codebase.
