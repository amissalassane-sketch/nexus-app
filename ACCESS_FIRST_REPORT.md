# NEXUS — Access-First Architecture Report

**ACCESS FIRST / VALUE SECOND / PROFILE LATER** — the mandatory multi-step
onboarding is gone. Every authenticated account (email/password,
email-verified, or Google) lands directly on the product (`/app` →
`/dashboard`) with a guaranteed personal workspace, and profile completion
is an optional, non-blocking experience inside the product.

## 1. Root causes found

1. **The product was gated on profile state.** `(app)/layout.tsx` checked
   `profiles.onboarding_completed` and redirected incomplete accounts to a
   4-step wizard at `/onboarding`. Reaching the dashboard was therefore
   impossible without completing a profile — the exact opposite of the
   intended model.
2. **Post-auth destinations were resolved from account state.**
   `getPostAuthDestination()` routed new users to `/onboarding` until
   `onboarding_completed === true`. Signup, email verification, Google
   OAuth and login all funnelled new accounts into the wizard, and a
   single stale/missing profile row could strand a user outside the
   product.
3. **The signup trigger invented identity data.** Migration 019's
   `bootstrap_profile()` derived a display name from the email address and
   auto-generated a username when Google metadata was absent. That violated
   "never invent fake user information" and made the UI show names the
   user never provided.
4. **The wizard owned profile completion.** `/onboarding` +
   `POST /api/onboarding/step-1` were the only path to set a name and
   username, so completion was a pre-product obligation instead of an
   in-product convenience.
5. **The dashboard had no first-visit state.** A brand-new workspace
   rendered the generic data grid with zeros — an empty, confusing screen
   instead of a guided welcome.
6. **Middleware did database work.** The session proxy called
   profile/workspace RPCs on the hot path of every request, coupling
   request latency to bootstrap state (and giving a DB hiccup a chance to
   break auth forms).
7. **`/login`, `/check-email` and `/auth/confirm-error` were client pages
   that read `?error=` / `?email=` / `?reason=` via `useSearchParams` in a
   Suspense boundary.** In this Next.js 16 build that prerenders to a
   static shell (the inert `export const dynamic = "force-dynamic"` is a
   no-op on client pages here), so the initial HTML lacked the form, the
   OAuth button and the exact error copy.

## 2. Architecture changes

- **Destination resolver collapsed.** `src/lib/auth-flow.ts` now returns
  exactly one product destination: `"/app"` (recovery flows keep
  `"/reset-password"`). No account-state lookup decides product entry.
  The old `generateDefaultUsername` / onboarding-based destination logic
  is deleted.
- **Bootstrap instead of gate.** `(app)/layout.tsx` runs, per request:
  `requireUser` → `ensureProfileServer` (inserts a minimal `{ id }` row if
  none exists — nothing invented) → `ensurePersonalWorkspaceServer`
  (idempotent, advisory-locked RPC) → `getProfileSummary` →
  `getActiveMembership`. If the workspace has not materialised yet the
  user sees **only** a branded "Preparing your workspace…" state
  (`WorkspacePreparing`, with a refresh action); never a form, never a
  redirect.
- **Profile is UI state, not authorization.** New
  `src/lib/profile-state.ts` computes completeness:
  `profile_complete = full name AND username present` (3 core items: name,
  username, photo — percent + missing list for guidance). It feeds the
  topbar ("Complete profile" menu item), the in-dashboard prompt, the
  modal and the settings indicator. No RLS policy, route guard or API
  checks it.
- **Profile completion moved inside the product.** New
  `POST /api/profile` (validated server-side, read-back verified) plus a
  subtle dismissible prompt card on the dashboard, a lightweight
  completion modal, and the full profile tab in `/settings`.
- **Dashboard welcome state.** An empty personal workspace
  (0 projects/tasks/goals) renders a first-value section: "Your workspace
  is ready / Welcome to NEXUS." with the first meaningful actions
  (create first project, create a task, explore Intelligence) instead of
  the empty grid.
- **Auth pages are server-read dynamic.** `/login`, `/check-email`,
  `/auth/confirm-error` are now server pages that `await searchParams`
  and pass the value as a prop to the client component (client falls back
  to live search params on client-side navigation). The initial HTML
  always carries the form, the OAuth button, autocomplete semantics and
  the exact error copy.
- **Legacy URL kept harmless.** `/onboarding` now simply
  `redirect("/app")`; `/api/onboarding/step-1` is deleted (clean 404).

## 3. Files changed

**New**

| File | Purpose |
| --- | --- |
| `supabase/migrations/020_access_first_profiles.sql` | access-first profile bootstrap + `job_title` |
| `src/lib/profile-state.ts` | completeness model, username pattern |
| `src/app/api/profile/route.ts` | `POST /api/profile` (optional completion) |
| `src/components/workspace-preparing.tsx` | "Preparing your workspace…" state |
| `src/components/profile/profile-completion-prompt.tsx` | subtle non-blocking prompt card |
| `src/components/profile/profile-completion-modal.tsx` | lightweight completion modal |
| `src/components/auth/login-form.tsx` | client login form (prop-seeded) |
| `src/components/auth/confirm-error.tsx` | client confirm-error state (prop-seeded) |
| `src/components/auth/check-email.tsx` | client check-email state (prop-seeded) |

**Modified**

- `src/lib/auth-flow.ts` — rewritten: `/app`-only destinations, minimal
  `ensureProfileServer`, no username generation.
- `src/lib/auth.ts` — `ProfileSummary` (adds `jobTitle`,
  `profileComplete`, `profileMissing`); null-normalised select.
- `src/lib/supabase/middleware.ts` — no DB work; authenticated users on
  auth forms → plain redirect to `/app`.
- `src/app/(app)/layout.tsx` — rewritten: bootstrap chain, no gate.
- `src/app/(app)/dashboard/page.tsx` — welcome state, greeting with safe
  name fallback.
- `src/app/(app)/settings/page.tsx` — `?tab=` deep links (profile /
  account / workspace / intelligence).
- `src/app/api/auth/signup/route.ts`, `src/app/api/auth/signin/route.ts`,
  `src/app/auth/confirm/route.ts`, `src/app/auth/callback/route.ts` —
  all post-auth destinations now `/app` (recovery → `/reset-password`).
- `src/app/onboarding/page.tsx` — repurposed to `redirect("/app")`.
- `src/app/login/page.tsx`, `src/app/check-email/page.tsx`,
  `src/app/auth/confirm-error/page.tsx` — server pages reading
  `searchParams` (Promise) and passing props.
- `src/components/layout/app-shell.tsx`, `topbar.tsx`,
  `workspace-sidebar.tsx` — profile-complete aware shell, always-visible
  profile control (Profile / Security / Workspace / Billing / Sign out,
  plus "Complete profile" when incomplete).
- `src/components/user-settings-panel.tsx` — profile tab with
  completeness indicator; saves now require nothing (format checks only);
  `job_title`/`avatar_url` supported with missing-column fallback.
- `README.md` — access-first documentation (route map, auth table,
  database section).

**Deleted**

- `src/app/api/onboarding/step-1/route.ts`

**Tests (all updated)**

- `supabase/tests/supabase-stub.mjs` — access-first seeds (FRESH =
  minimal profile, INCOMPLETE = name only; projects/tasks/goals/
  subscription seeded for a realistic first visit).
- `supabase/tests/auth-flow.test.mjs` — rewritten around the
  access-first journey (see §9).
- `supabase/tests/migration-logic.test.mjs` — bootstrap trigger now
  expected to create minimal profiles (no invented identity).
- `supabase/tests/onboarding-rls.test.mjs` — same expectations under RLS
  roles, incl. "profile never gates access".

## 4. Migration

`supabase/migrations/020_access_first_profiles.sql` (applies after 019):

- `ALTER TABLE profiles ADD COLUMN job_title text` (additive).
- Replaces `bootstrap_profile()`: `display_name` comes ONLY from
  `raw_user_meta_data->>'full_name'` / `->>'name'` (nullif + btrim) —
  **never** derived from the email; `username` is always NULL on
  bootstrap; `onboarding_completed` defaults false and is never read for
  routing anymore.
- Re-asserts the `on_auth_user_created_profile` trigger (defensive: some
  environments apply 019/020 without 001's trigger creation).
- `notify pgrst, 'reload schema'`.
- **No RLS changes at all.** All existing policies, triggers and
  authorization behaviour are untouched.

## 5. Routes changed

| Route | Before | After |
| --- | --- | --- |
| `POST /api/auth/signup` | session → `/onboarding` for new users | session → **`/app`** |
| `POST /api/auth/signin` | destination by account state | **`/app`** (fallback `/app` on error) |
| `GET /auth/confirm` | `/onboarding` until complete | recovery → `/reset-password`, else **`/app`** |
| `GET /auth/callback` | `/onboarding` until complete (3 branches) | all three → **`/app`** (recovery branch → `/reset-password`) |
| `GET /onboarding` | 4-step wizard (gated the product) | `redirect("/app")` |
| `POST /api/onboarding/step-1` | wizard step API | **deleted** (404) |
| `POST /api/profile` | — | **new**: optional completion (name, username, photo, job title, bio) |
| `GET /login`, `/check-email`, `/auth/confirm-error` | static prerender shell (dynamic export inert on client pages) | dynamic server pages; full content in initial HTML |
| middleware | DB bootstrap on auth-form requests | plain redirect to `/app` |

## 6. Profile changes

- Signup stays minimal: **email + password only** (or Google). No name,
  username, workspace or goal questions.
- New profiles bootstrap with a minimal row: `id` only — NULL name,
  NULL username. Google accounts carry the provider's `full_name` into
  `display_name` exactly once; the product never re-asks it.
- `profile_complete = display_name AND username` — **guidance only**
  (prompt, menu item, settings indicator). `profile_complete = false`
  never blocks the dashboard, any route, or any API.
- Completion surfaces: dismissible dashboard prompt ("Complete your
  profile — Add your name and username …"), modal (name + username
  required, photo/job title/bio optional), and the `/settings` profile
  tab (all five fields, completeness meter). Prompt dismissal is
  in-memory for the session; it can reappear later.
- `POST /api/profile` validates server-side (name ≤120, username
  `^[a-zA-Z0-9._-]{3,32}$` — matches every format the product has ever
  written, so historical usernames stay valid; avatar = URL; job title
  ≤120; bio ≤500), ensures profile + workspace before writing, upserts
  idempotently and **reads the row back** to verify.
- Username is never an auth credential: email remains the canonical
  identifier; login, recovery and sessions use email only.

## 7. Dashboard changes

- Brand-new workspace (0 projects/tasks/goals): premium welcome state —
  "Your workspace is ready" / "Welcome to NEXUS." / explanatory copy /
  Create first project / Create a task / Explore Intelligence — instead
  of an empty grid.
- Greeting renders the first name only when a real display name exists:
  "Good evening." (never an invented name such as one derived from the
  email).
- "Preparing your workspace…" is the only state shown when bootstrap
  hasn't finished; it is not a gate and cannot appear after the first
  successful render.

## 8. Security changes

- **No RLS rule was weakened, removed, or bypassed.** Migration 020 is
  additive (one column) plus a trigger replacement that strictly reduces
  invented data.
- Bootstrap ordering preserved and now enforced in code + tests:
  workspace RPC (`get_or_create_personal_workspace`, SECURITY DEFINER,
  advisory-locked, idempotent) runs **before** any profile write, both in
  the layout chain and in `POST /api/profile`.
- Profile write is idempotent (one row per user; unique PK) — no
  duplicate workspaces or memberships are ever created.
- No raw Supabase/Postgres errors reach the UI: `POST /api/profile`
  returns structured 400/401/500 JSON with safe copy; the settings panel
  and profile read paths use `isMissingColumnError` fallbacks instead of
  leaking schema errors.
- Middleware no longer performs database work on the hot path.
- Workspace isolation unchanged: all tenant tables remain RLS +
  membership-based; the audit script (`supabase/tests/rls_audit.sql`)
  and the RLS test suite still pass unmodified in policy terms.

## 9. Tests — scenario coverage (spec §28)

`supabase/tests/auth-flow.test.mjs` (e2e against the real app + stubbed
Supabase) sections:

1. **Route protection (anonymous)** — every product route (incl.
   `/onboarding`) 307 → `/login`; public pages render; `/login` and
   `/signup` render with Google button + semantic autocomplete
   (`username`/`current-password`, `email`/`new-password`) in the
   initial HTML; `/auth/confirm-error?reason=expired` renders the
   branded expired state.
2. **Confirmation plumbing** — bare/invalid code → branded error page;
   valid code → session + `/app`; recovery code → `/reset-password`;
   invalid recovery → readable reset error; `token_hash` confirmations
   (new user, complete user) → `/app`; expired/invalid → branded state;
   `/onboarding?code=…` forwards to `/auth/callback`; landing after
   confirmation unchanged; `/api/health` public.
3. **Signup** — success + immediate session → `redirectTo: "/app"`;
   confirmation-required → `/check-email`; existing email → readable 400;
   invalid input → 400; **email + password only accepted** (no
   onboarding fields); confirmation email `redirectTo` always
   `/auth/confirm` (never `/onboarding`).
4. **First-value journey (access first)** — brand-new user with an
   incomplete profile enters `/dashboard` (200, no gate); welcome state
   copy + first meaningful actions render; **optional profile prompt
   shown, non-blocking**; **a missing full name never renders an
   invented display name** (greeting ends bare); authenticated
   `/onboarding` → 307 `/app`; old `/api/onboarding/step-1` → 404.
5. **Profile completion (optional)** — anonymous save → 401; malformed
   username → 400 with readable message; valid save → 200 **with the
   workspace RPC observed before the first profile write** (ordering
   guarantee); dashboard then greets the user by the real name and the
   prompt disappears; repeat save idempotent.
6. **Login** — wrong password / unknown email / unverified email →
   readable 401s; **incomplete-profile user logs in → `/app`**,
   dashboard fully accessible, prompt shows "Add your username";
   onboarded user → `/app`.
7. **Authenticated navigation** — public homepage stays available;
   `/login` while signed in → `/app`; dashboard shell renders; every
   product route 200.
8. **OAuth (Continue with Google)** — new user → `/app`; incomplete
   profile → `/app`; complete → `/app`; failed exchange → `/login?error`
   (branded); cancelled consent → distinct "cancelled" message; replayed
   callback with live session keeps the user in the product; callback
   writes session cookies; refresh stays signed in; authenticated user
   never left on `/login`.
9. **Session persistence** — reload keeps session; expired access token
   refreshed server-side.
10. **API contract** — billing 401/400; forgot-password 400/200;
    update-password 401 without recovery; recovery link →
    `/reset-password` + session; reset → `/app`.
11. **Resend confirmation** — 400 validation; 200; never confirms the
    address exists.
12. **Logout** — signout clears session; product routes → `/login`;
    Google sign-in after logout works a second time.

Other suites:

- `migration-logic.test.mjs` — bootstrap trigger now creates **minimal**
  profiles (owner: name only, username NULL; metadata-less user: both
  NULL; exactly one workspace); plan limits, write-time membership,
  dependency and audit behaviour unchanged.
- `onboarding-rls.test.mjs` — same assertions **under RLS with real
  roles**, including "orphan repair can insert a minimal profile" and
  "an incomplete profile still resolves a workspace (profile never
  gates access)".
- `schema-errors.test.mjs` — missing-column classifier behaviour
  (used by the `job_title` fallback paths).
- `npm run verify:scene` — 3D hero regression suite (untouched area).

## 10. Exact results

All commands run in this session, after the final code state:

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | **exit 0, no diagnostics** |
| ESLint | `npx eslint src` | **exit 0, no warnings/errors** |
| Production build | `npm run build` | **✓ Compiled + type-checked**; route table shows `ƒ /login`, `ƒ /check-email`, `ƒ /auth/confirm-error` (dynamic, content in initial HTML — verified by `curl` on `next start`: form, `Continue with Google`, autocomplete attrs, `?error=` copy, expired-link copy and `?email=` address all present in raw HTML) |
| Auth e2e (production build + fresh stub) | `node supabase/tests/auth-flow.test.mjs` | **109 passed / 0 failed** (stub received 335 Supabase calls, incl. 78 auth calls) |
| Migration logic (PGlite) | `node supabase/tests/migration-logic.test.mjs` | **62 passed / 0 failed** |
| RLS behaviour (PGlite, real roles) | `node supabase/tests/onboarding-rls.test.mjs` | **43 passed / 0 failed** |
| Schema-error classifier | `node supabase/tests/schema-errors.test.mjs` | **all cases passed** |
| 3D hero | `npm run verify:scene` | **85 checks passed, 0 failed** |

No regressions: every previously passing auth/OAuth/session/RLS scenario
still passes, and the new access-first scenarios pass on a fresh stub.

## 11. Manual Supabase configuration

- **Apply `supabase/migrations/020_access_first_profiles.sql`** after the
  existing migrations (in order: … 018 → 019 → 020). It is additive
  (one column) plus a trigger replacement; safe to apply to a running
  project. **No RLS reconfiguration is needed.**
- Hosts that have not yet applied 020 are tolerated: profile reads, the
  settings panel and `POST /api/profile` detect the missing
  `job_title` column via the shared classifier and fall back
  gracefully (no raw errors).
- Google provider, email templates and redirect URLs are unchanged by
  this work (see the Supabase instructions in `README.md` /
  `supabase/email-templates/` README).
- `profiles.onboarding_completed` is intentionally retained (historical
  data, diagnostics) but is no longer read for routing.

## 12. Remaining limitations

- **Avatar is a URL field** (or a small data-URL); the repo has no file
  storage service, so hosted upload is out of scope.
- **Prompt dismissal is in-memory** (per SPA session, no storage side
  effects — deliberate, to avoid hydration/storage surprises). The prompt
  can reappear on a later visit, which matches "optional, never
  mandatory".
- **`onboarding_completed` / `onboarding_intent` columns are
  vestigial** — kept for compatibility and diagnostics, unused by
  routing.
- **E2E in this sandbox runs against the production build
  (`next start`)**: the Turbopack dev server in this sandbox dies
  silently under sustained e2e traffic (reproduced repeatedly; external
  reaper, not OOM/ulimits — ruled out). The suite is identical
  request-for-request and passes fully against `next start`; in normal
  environments `npm run dev` works as documented.
- **The stub is a test double**: OAuth is simulated via the PKCE
  verifier cookie the same way a browser would supply it; a real
  Google-provider smoke test still requires a live Supabase project with
  the provider enabled.
