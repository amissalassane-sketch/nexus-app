# NEXUS — Email/Password Authentication Rework Report

## 1. Root causes found

1. **No `/auth/confirm` route existed.** Supabase's recommended token-hash
   confirmation flow (`{{ .SiteURL }}/auth/confirm?token_hash=...&type=email`)
   had no corresponding Next.js route, so a confirmation click either hit a
   missing path or a GoTrue fallback that surfaced the black JSON
   `{"error":"requested path is invalid"}`.
2. **Email confirmation links were tied to the PKCE code-exchange path.**
   `/auth/callback` relied on `exchangeCodeForSession` for email links. If the
   link was opened without the originating PKCE `code_verifier` (very common —
   another browser/device, or a resend), the exchange failed.
3. **The callback deliberately dropped the session and sent users to `/`**
   after a successful confirmation. That made the product look confirmed while
   leaving the user on a marketing page, creating a confusing "verify then sign
   in again" loop.
4. **Supabase-hosted email content was never customized**, so users received
   default "powered by Supabase" wording and branding.
5. **Login/signup forms did not let browsers distinguish contexts correctly.**
   Login used `autocomplete="email"` (ambiguous) instead of the semantic
   `username`/`current-password` pair, and inputs lacked `name` attributes.
6. **Unverified-email login was a dead end** — it returned only a message, with
   no way to resend verification from the login screen.
7. **Auth destinations were inconsistent** (`/dashboard` vs `/app` vs
   `/onboarding`) and not driven by the canonical product entry point.

## 2. Files changed

- `src/lib/auth-flow.ts` (new) — shared destination/cookie/reason helpers.
- `src/app/auth/confirm/route.ts` (new) — server-side `verifyOtp` endpoint.
- `src/app/auth/confirm-error/page.tsx` (new) — branded error + resend state.
- `src/lib/auth-errors.ts` — human-readable error mapping (never raw GoTrue).
- `src/app/api/auth/signin/route.ts` — `EMAIL_NOT_CONFIRMED` code + `/app`.
- `src/app/api/auth/signup/route.ts` — email links to `/auth/confirm`.
- `src/app/api/auth/resend-confirmation/route.ts` — to `/auth/confirm`.
- `src/app/api/auth/forgot-password/route.ts` — recovery to `/auth/confirm`.
- `src/app/api/auth/update-password/route.ts` — `/app` post-reset destination.
- `src/app/auth/callback/route.ts` — new flow; Google OAuth unchanged.
- `src/lib/supabase/middleware.ts` — token_hash → `/auth/confirm`, code → callback.
- `src/app/login/page.tsx` — autocomplete semantics + unverified resend.
- `src/app/signup/page.tsx` — autocomplete semantics + password requirement.
- `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx` — semantics.
- `src/app/check-email/page.tsx` — branded copy + resend wording.
- `supabase/email-templates/*` (new) — NEXUS-branded HTML templates.
- `.env.example`, `README.md` — URL/flow documentation.
- `supabase/tests/auth-flow.test.mjs`, `supabase/tests/supabase-stub.mjs` — tests.

## 3. Routes created / modified

- **Created** `GET /auth/confirm` — token_hash verification, session creation,
  redirect to `/onboarding` or `/app` (recovery → `/reset-password`).
- **Created** `GET /auth/confirm-error` — branded expired/invalid/used/missing
  state with "Return to sign in", "Create account", and resend form.
- **Modified** `GET /auth/callback` — retains OAuth `?source=oauth` + recovery;
  email code/token_hash now verifies, keeps the session, and routes by state.
- **Modified** all `/api/auth/*` routes as listed above.

## 4. Supabase Dashboard configuration (must be applied manually)

This is **not applied by code** and is required before a real production
deployment is considered fully working:

1. **Authentication → Email Templates → Confirm signup**: paste
   `supabase/email-templates/confirm-signup.html` as the message body.
   Subject (keep): `Confirm your email`.
2. **Authentication → Email Templates → Reset password**: paste
   `supabase/email-templates/recovery.html` as the message body.
   Subject (keep): `Reset your password`.
3. **Authentication → URL Configuration**:
   - Site URL: the production NEXUS origin (e.g. `https://app.nexus.com`).
   - Redirect URLs, explicit (no wildcards):
     - `https://app.nexus.com/auth/confirm`
     - `https://app.nexus.com/auth/callback`
     - `https://app.nexus.com/auth/confirm?type=recovery&next=/reset-password`
     - `https://app.nexus.com/auth/callback?type=recovery&next=/reset-password`
4. **Implementations env vars**: `NEXT_PUBLIC_SITE_URL` must match the Site URL
   above; never `localhost` in production.

Until these are applied, the app still behaves correctly (NEXUS error states
instead of raw errors), but the hosted email will not be NEXUS-branded and the
production confirmation link may still be rejected by Supabase's allowlist.

## 5. Email template changes

- Added `confirm-signup.html`: black `#000000` background, white primary text,
  `rgba(255,255,255,0.65)` secondary text, `rgba(255,255,255,0.1)` border, white
  CTA. No Supabase branding, no gradients, no marketing content.
- Added `recovery.html`: same NEXUS visual identity.
- Both use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...`
  so verification uses real Supabase verification, never a fake page.

## 6. Authentication flow changes

- **Signup** → `/check-email` → NEXUS email → `/auth/confirm` → session →
  `/onboarding` (incomplete) or `/app` (complete).
- **Login** → server `signInWithPassword` → captures `EMAIL_NOT_CONFIRMED` →
  shows verification message + inline resend.
- **Resend** — validated email, server call, cooldown/disable, generic copy.
- **Verification fail** → `/auth/confirm-error` with reason + resend.
- **Recovery** → NEXUS email → `/auth/confirm?type=recovery` → `/reset-password`
  → `update-password` → `/app` or `/onboarding`.
- **Google OAuth** — untouched provider logic; still `/auth/callback?source=oauth`,
  now routes to `/app`/`/onboarding` (via the same helper).
- **Canonical entry** — verified/onboarded users land on `/app` (which redirects
  to `/dashboard` through the app shell gate), never blindly on `/dashboard`.

## 7. Security considerations

- Verification is performed **server-side** via `supabase.auth.verifyOtp` on
  `/auth/confirm`; no token is verified in the browser.
- No service-role key, no suppression of email confirmation, no weakening of
  RLS, no client token storage.
- No user-supplied workspace IDs are used in auth routing.
- Supabase error messages are never surfaced raw to the UI.
- Email responses are deliberately generic (no account-existence disclosure).
- Onboarding/workspace bootstrap remains idempotent (no duplicate workspaces or
  memberships); no changes were made to those migrations.
- OAuth error/cancel handling is unchanged.

## 8. Tests executed

- TypeScript (`npx tsc --noEmit`)
- ESLint (`npm run lint`)
- Production build (`npm run build`)
- `supabase/tests/auth-flow.test.mjs` (end-to-end against the stubbed Supabase)
- `supabase/tests/migration-logic.test.mjs`
- `supabase/tests/onboarding-rls.test.mjs`
- `supabase/tests/schema-errors.test.mjs`

## 9. Test results

| Check | Result |
| --- | --- |
| `tsc --noEmit` | Pass |
| `eslint` | Pass |
| `next build` | Pass |
| Auth flow end-to-end | **94 passed / 0 failed** (signup, confirmation, invalid/expired, resend, login/unverified, recovery, OAuth, session refresh, logout, redirects, autocomplete semantics, no raw errors) |
| Migration logic | **54 passed / 0 failed** |
| Onboarding / workspace RLS | **21 passed / 0 failed** |
| Schema errors | Pass |

## 10. Production deployment considerations

1. Apply the Supabase Dashboard configuration in §4 before shipping.
2. Set `NEXT_PUBLIC_SITE_URL` to the real production origin and add it to the
   Supabase allowed Redirect URLs.
3. Keep email confirmation enabled; do not disable it to "fix" this.
4. The production built app (`next build && next start`) is the same flow the
   tests cover; the dev-server run is only used for the local stub harness.
5. No database migrations were added or changed — RLS, plans, workspace
   bootstrap, and membership triggers are untouched.
