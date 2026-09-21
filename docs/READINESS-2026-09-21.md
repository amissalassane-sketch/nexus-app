# NEXUS — readiness audit, 2026-09-21

## Decision

**NOT PRODUCTION READY.** Local compilation and the default test command pass; this is not production certification. Remote database state, real email authentication, browser QA and current production behavior remain unverified. There are also known engineering gaps below, not merely a human QA sign-off.

## Baseline / scope

- Clean checkout at `5d05a35` (merge PR #80), branch `arena/01a0c51c-nexus-app`.
- Origin: `amissalassane-sketch/nexus-app`. No changes to master, migrations or deployment security.
- Installed Next **16.3.5**, React **19.2.8**; eslint-config-next remains 16.3.1. The supplied version description was not the locked dependency state.
- `next.config.ts` already disables standalone when `VERCEL` is set. Left unchanged. Proxy and dynamic API/admin routes compile with Turbopack.
- No repository Vercel config/link or GitHub Actions workflow found. The cloud project's environment variables and settings cannot be inferred from their absence.
- Initial inspection was read-only. No secrets printed or added. No database mutation/deployment performed.

## Corrections made

1. JSON object validation shared by auth, profile, billing and intelligence POST handlers. Reject null, arrays, primitives and malformed JSON rather than dereferencing them. Action type also checked at runtime.
2. Proxy redirects preserve Supabase refresh/deletion cookies via the existing redirect helper. Behavioral regression uses an expired session against the local Supabase stub.
3. Relative redirect validation rejects control characters that WHATWG URL parsing can normalize into an external authority.
4. Admin configuration checked before constructing the request-bound Supabase client. `/admin/login` now renders an explicit unavailable state instead of HTTP 500 when configuration is absent.
5. Extend existing opaque #000000 background rules to every product route and the admin shell. Remove the product spatial-field mount; keep cards and public marketing design intact.
6. Update transitive development dependency js-yaml 4.3.1 → 4.3.2 (GHSA-2883-xcg3-v3hh). No broad dependency upgrade.
7. Add regression tests and include the existing hermetic full-lineage test in `npm test`.

Two existing structural assertions were updated: one expected the former redirect call instead of the cookie-preserving helper; the other explicitly required gray admin backgrounds. The redirect now also has behavioral coverage; gray backgrounds conflict with the requested #000000 requirement. No tests were deleted or disabled.

## Validation evidence

| Check | Result |
| --- | --- |
| `npm ci` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS — 0 errors, 21 existing warnings |
| `npm test` | PASS — 2,238 passing assertions/tests, 0 failures, summed from individual suite summaries |
| `npm run build` initial baseline | PASS |
| `VERCEL=1 npm run build` final code | PASS — Next 16.3.5 / Turbopack |
| `git diff --check` | PASS |
| `npm audit` and production-only audit | PASS — 0 reported vulnerabilities |
| Additional admin-auth-contract suite | PASS — 24 assertions |

Local production-mode HTTP smoke checks (no Supabase configuration): homepage, signup, login, forgot-password, reset-password and verify-email returned 200; private product/admin pages redirected to login. After the admin correction, `/admin/login` returned 200 with an explicit unavailable state. `/api/health` returned 200, `ok: true`, `supabaseConfigured: false`, `cache-control: no-store`. This is **liveness**, not a working-database probe.

### Additional suites outside the default command: NOT GREEN

These were actually attempted, not assumed to pass:

- `auth-workspace-bootstrap`, `core-contract`, `lineage-reconciliation`, `workspace-bootstrap`, `onboarding-rls`: PGlite setup cannot load the historical pgcrypto/vector/storage prerequisites. Cascading errors prevent these suites from establishing their intended assertions.
- `migration-logic`: 72 passed / 10 failed. Its minimal fixture is followed by historical migrations it was not prepared to run, and Supabase roles/storage/extensions are missing.
- `auth-flow`: first attempt lacked the required app server; rerun with the documented local Supabase stub and Next dev server reached real routes. Seven assertions failed before a socket interruption stopped the run. Expectations include obsolete `/check-email` and passwordless forms, signup fixture behavior and older welcome/profile copy. This is **not** a completed auth E2E pass.

None of these suites was removed, suppressed or relabeled as successful. The passing bridge-lineage test emulates unavailable extensions and storage in PGlite; it does not validate pgvector behavior, a real Supabase installation or applied remote migration history.

## Supabase / RPC / workspace

All numbered files 001–029 and the seven timestamped 202609 migrations are present. The passing hermetic lineage test applies the chain with documented emulation. Admin SQL suites exercise grants, role denial and real SQL reads locally; freemium/subscription suites exercise trigger enforcement, limits and lifecycle states locally.

Static inventory found SQL definitions for all 15 RPC names called by TypeScript (including the dynamic admin wrapper):

| RPC | Named arguments / return |
| --- | --- |
| `get_or_create_personal_workspace` | no args → table(workspace_id uuid, role text, status text) |
| `get_workspace_usage` | p_workspace_id uuid → json |
| `platform_admin_context` | no args → jsonb |
| `admin_overview` | no args → jsonb |
| `admin_recent_activity` | p_limit int → jsonb |
| `admin_users_list` | p_search, p_status, p_sort, p_direction text; p_page, p_page_size int → jsonb |
| `admin_user_detail` | p_user_id uuid → jsonb |
| `admin_workspaces_list` | p_search, p_view, p_sort, p_direction text; p_page, p_page_size int → jsonb |
| `admin_workspace_detail` | p_workspace_id uuid → jsonb |
| `admin_subscriptions_list` | p_search, p_plan, p_status, p_sort, p_direction text; p_page, p_page_size int → jsonb |
| `admin_activity_list` | p_search, p_action text; p_page, p_page_size int → jsonb |
| `admin_audit_log_list` | p_search, p_outcome text; p_page, p_page_size int → jsonb |
| `admin_security_overview` | no args → jsonb |
| `admin_audit_record` | p_action, p_outcome, p_target_type, p_target_id text; p_metadata jsonb; p_ip_address, p_user_agent text → uuid |
| `admin_audit_record_denied` | p_reason, p_path, p_ip_address, p_user_agent text → uuid |

PostgREST uses named arguments, not positional TypeScript argument order. Static presence is not proof of deployed signatures or grants. Admin identity is obtained server-side from `platform_admin_context`; admin RPCs enforce database authorization. The local tests do not replace the live two-account isolation audit.

The app's actual bootstrap is access-first: authentication → idempotent workspace bootstrap → `/app`; profile completion is optional. There is no mandatory onboarding/profile gate to restore merely because a historical test expects one.

`supabase migration list --linked` is blocked: no linked project ref. No credentials or remote database connection available. Applied 029/timestamp migrations, real schema drift, policies, triggers and live account bootstrap therefore remain **BLOCKED**.

## API / intelligence / security observations

- Auth routes delegate credentials and email tokens to Supabase; password update requires a verified session. Callback/confirm routes exist and share cookie helpers.
- Profile mutations use the server's authenticated user, not a submitted user ID.
- Billing upgrade checks session and owner/admin membership but returns **501 PAYMENT_PROVIDER_NOT_CONFIGURED**. This is an engineering gap, not something environment variables alone complete.
- Intelligence routes derive workspace membership server-side; actions/memory/missions/signals use workspace-scoped operations. Unit suites cover those contracts. Real cross-workspace RLS isolation remains unverified.
- LLM providers have timeout/retry/fallback logic, and provider keys use non-public environment variable names. No source matches for the scanned private-key/provider-secret patterns. This is a limited source scan, not a full historical secret audit.
- No persistent application-level rate/usage gate was found before intelligence provider calls. Repeated authenticated queries can incur provider costs if keys are enabled. No claim is made about uninspectable Vercel WAF/provider budget settings.
- Several intelligence snapshot reads substitute empty arrays on database errors. This can make unavailable data look empty. Missions `recompute` also currently passes through the earlier mission-ID requirement.
- `/api/health` does not test a Supabase connection. Raw backend error messages remain in some error/log paths (e.g. billing membership failures); a comprehensive redaction and adversarial input review is not complete.
- `NEXT_PUBLIC_SITE_URL` must be explicit in production: request-origin fallback trusts request headers when it is absent.

## Admin subscriptions / billing discrepancy

The page reads Supabase RPC data, not static mock data, with unavailable/empty/list states. The SQL comments and tests deliberately retain an active paid plan badge even when its period has lapsed, while limits use period-aware `get_workspace_plan()` and fall back to FREE. Workspace directory uses the same badge predicate. Thus the screens agree with each other but the badge is not always the enforced entitlement. This remains an unresolved mismatch with the requested rule that the displayed plan never contradict SQL enforcement. No commercial logic was silently redefined during this audit.

FREE boundaries, over-limit writes, paid active, expired, cancelled and past_due behavior are covered in the passing local SQL contracts. No payment transaction or real subscription lifecycle was tested.

## UX / browser coverage

Product/admin structural background rules and existing mobile/design suites pass. No desktop/tablet/mobile browser journey was completed against live authenticated data. Overflow, dialogs, dropdowns, focus, loading/error states and visual regressions therefore are not certified by source assertions alone.

## Vercel / production

GitHub reports a successful **Production** deployment of baseline `5d05a35`, created 2026-09-21 16:40:19Z, deployment ID `6573298790`. This is historical success, not confirmation of this branch's changes in production.

- Supplied project alias: `https://nexus-intelligence-amissalassane-6379s-projects.vercel.app`
- Generated deployment URL reported by GitHub: `https://nexus-intelligence-fo7c4vjgy-amissalassane-6379s-projects.vercel.app`
- Both direct HTTPS probes failed with TLS `SSL_ERROR_SYSCALL` from this environment before an HTTP response.
- Vercel CLI 59.23.2 `whoami`: **a new login is required**. No login bypass attempted.

**PRODUCTION QA BLOCKED — TLS/network access; Deployment Protection status UNKNOWN.** No Vercel Authentication screen was observed, so blaming Deployment Protection would be unsupported. No production signup, admin access, health or mobile flow is marked tested.

## Human-only actions

1. Provide authorized service access through the platform's secure integration/environment facilities (never credentials in chat): link the correct Supabase project and authorize Vercel so remote state can be inspected.
2. In Vercel Project → Settings → Domains, identify the canonical public production domain. Check Deployment Protection → Vercel Authentication and its scope; if QA is challenged, authorize a tester or use the authorized production domain. Do not weaken protection automatically.
3. Confirm production Supabase URL/key, site URL, email redirect allowlist, email confirmation/SMTP configuration and authorized admin account. Then allow controlled test accounts to exercise signup, confirmation, reset, existing-user bootstrap and cross-workspace denial against the real service.
4. Review the PR and deployment checks before merging. No automatic merge or production migration was performed.

Engineering follow-up (not disguised as human-only blockers): repair the historical test fixtures/expectations, reconcile admin effective-plan display, bound paid AI usage, handle intelligence read failures, and implement the existing paid-upgrade path before certifying paid operation. Real browser QA and remote migration/RLS verification remain release gates.
