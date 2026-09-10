# NEXUS — Email OTP Authentication: Implementation Report

## 1. Files inspected

| File | Purpose |
|---|---|
| `src/proxy.ts` | Next.js 16 proxy (middleware) entry → `updateSession` |
| `src/lib/supabase/config.ts` | Public env validation (URL + publishable/anon key) |
| `src/lib/supabase/client.ts` | Browser Supabase client (`createBrowserClient`, safe variant) |
| `src/lib/supabase/server.ts` | Server Supabase client (`createServerClient` + cookies) |
| `src/lib/supabase/middleware.ts` | Session refresh + route protection rules |
| `src/lib/auth.ts` | `getAuthenticatedUser`, `requireUser`, `getProfileSummary` |
| `src/lib/auth-flow.ts` | Post-auth destination resolver, workspace bootstrap, cookie-carrying redirects |
| `src/lib/auth-errors.ts` | Supabase → user-facing error mapping, credential validation |
| `src/components/ui/sign-in-flow-1.tsx` | **The OTP sign-in screen** (email → code → success) |
| `src/components/auth/auth-layout.tsx` | Shared auth visual shell (dot-matrix background) |
| `src/components/auth/check-email.tsx`, `confirm-error.tsx` | Signup confirmation / confirmation-error UI |
| `src/components/auth/login-form.tsx` | **Dead** email+password login variant (removed) |
| `src/app/login/page.tsx`, `signup`, `forgot-password`, `reset-password`, `check-email` | Auth pages |
| `src/app/api/auth/*` | signin / signup / signout / forgot-password / resend-confirmation / update-password |
| `src/app/auth/callback/route.ts`, `confirm/route.ts`, `confirm-error/page.tsx` | OAuth + email-link exchange endpoints |
| `src/app/onboarding/page.tsx`, `src/components/onboarding/*`, `src/lib/onboarding/*` | Onboarding (dashboard-first, in-product) |
| `src/app/(app)/layout.tsx`, `app/page.tsx` | Authenticated shell, workspace bootstrap |
| `supabase/email-templates/*` | Supabase Dashboard email bodies |
| `supabase/tests/auth-flow.test.mjs`, `supabase-stub.mjs`, `preview-stub.mjs` | Auth e2e + Supabase test double |
| `.env.example` | Required environment variables |

## 2. Files modified

- `src/components/ui/sign-in-flow-1.tsx` — hardened the OTP flow (details below).
- `supabase/email-templates/magic-link.html` — **new** NEXUS-branded OTP email using `{{ .Token }}`.
- `supabase/email-templates/README.md` — documented the required Dashboard configuration.
- `src/components/auth/login-form.tsx` — **removed** (dead code: an unused email+password variant, self-annotated as such and unreferenced anywhere).

## 3. Authentication architecture discovered

- **Stack:** Next.js 16 (App Router) + `@supabase/ssr` + `@supabase/supabase-js`.
- **Clients:** one browser client (`src/lib/supabase/client.ts`) and one server client (`src/lib/supabase/server.ts`) — both created from `src/lib/supabase/config.ts`. **No duplicated clients.** No service-role key anywhere.
- **Session:** stored in **cookies** (SSR cookie auth), refreshed on every request by `src/lib/supabase/middleware.ts` via `proxy.ts`. No `localStorage` session, no second auth state.
- **Entry points:** `/login` (OTP email + Google), `/signup` (password), `/forgot-password`, `/reset-password`, `/auth/callback` (OAuth), `/auth/confirm` (email link token_hash exchange), `/auth/confirm-error`.
- **Canonical post-auth destination:** **`/app`** (→ `/dashboard`) for *every* account. The old mandatory `/onboarding` wizard is gone; `/onboarding` now just redirects to `/app`. Onboarding is in-product (welcome screen, guided tour, checklist) and reads local + remote (`profiles.onboarding_progress`) state — **there is no second user/profile/workspace system**.

## 4. How OTP sending works

On the `/login` screen (`sign-in-flow-1.tsx`), after email validation (empty + format):

```ts
supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: true,               // new OR existing account, one path
    emailRedirectTo: `${origin}/auth/confirm`, // clicked link → correct endpoint
  },
});
```

- The OTP screen is shown **only after** Supabase returns no error (a send failure keeps the user on the email step with a mapped message).
- `shouldCreateUser: true` means new users are created and existing users simply receive a code — the UI never branches on "new vs existing".
- Resend calls the same `signInWithOtp` again (a real request, not a fake timer).

## 5. How OTP verification works

On the 6th digit (auto-submit) or via **Continue**:

```ts
supabase.auth.verifyOtp({ email, token, type: "email" });
```

- Supabase verifies the code; NEXUS never generates, stores, or compares OTPs.
- Error mapping (`classifyOtpError`) → "This code has expired…", "Too many attempts…", "That code is incorrect…". Never raw GoTrue text.
- If `verifyOtp` succeeds but returns no session, the UI shows an elegant failure instead of entering a redirect loop.

## 6. How session persistence works

- The browser client (`@supabase/ssr`) writes the session to cookies on `verifyOtp` success.
- `router.replace("/app")` + `router.refresh()` triggers a server render that reads the cookies; `proxy.ts` refreshes the session server-side on every request.
- Persistence across refresh/navigation is covered by the e2e "session persistence", "route protection", and "logout" sections (passing).

## 7. How onboarding integration works

- After verification the user always lands on `/app`, the canonical destination.
- The `(app)` layout (`requireUser` → profile repair → idempotent workspace bootstrap) renders the product with in-product onboarding (welcome screen, guided tour, checklist) driven by `OnboardingProvider`.
- Onboarding data stored locally before/around account creation is associated with the user via `profiles.onboarding_progress` (local → remote merge). **No onboarding system was replaced or broken.**

## 8. Supabase Dashboard configuration required (manual)

1. **Authentication → Email Templates → Magic link** → paste `supabase/email-templates/magic-link.html` into the **Message Body**; subject `Your login code`. This template uses **`{{ .Token }}`** (required for the 6-digit code to appear) and keeps `{{ .ConfirmationURL }}` as a fallback link.
2. Confirm the OTP length is **6 digits** (GoTrue default — the NEXUS screen has six boxes).
3. **Authentication → URL Configuration**: set Site URL, and list `…/auth/confirm` and `…/auth/callback` as redirect URLs.
4. **Authentication → SMTP Settings** for production (trusted NEXUS domain sender).
5. Keep `Confirm signup` / `Reset password` templates as already documented.

## 9. Environment variables required (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # or ANON_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000                 # production URL in prod
```

No secret/service-role key is required or exposed.

## 10. Remaining blockers

- **No `.env.local` exists in this sandbox** → no real Supabase project is connected, so a real email cannot be sent or received here.
- Supabase Dashboard changes (Magic link template with `{{ .Token }}`, URL config, SMTP) must be applied manually.
- The e2e stub (`supabase-stub.mjs`) does not implement `POST /auth/v1/otp`, so the *browser* OTP round-trip cannot be automated against the stub — it is validated by typecheck/lint/build and code review instead.

**Code implementation is complete, but real email delivery still requires Supabase email configuration.**

## 11. Exact test results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx eslint` (changed files) | ✅ 0 errors |
| `npm run build` | ✅ Compiled successfully (49/49 pages) |
| `npm test` (unit + mobile + landing) | ✅ unit + mobile pass; landing `92 passed, 1 failed` — the 1 failure ("no framer-motion import in landing components") is **pre-existing** on master |
| `node supabase/tests/auth-flow.test.mjs` (stub e2e) | ✅ session persistence, route protection, OAuth, confirm, login, logout, resend sections pass; the few FAILs (`profile prompt`, `welcome state`, autocomplete/Google-button test drift) are **pre-existing** — confirmed by re-running on a clean tree (master) which shows the same failures |

### What was NOT verifiable here (needs a configured Supabase project)

Real email arrival, incorrect/expired-code behavior against live GoTrue, and real new/existing-user branching — these require a live Supabase project (env vars + email config), which is absent from this sandbox.
