# NEXUS email templates (Supabase hosted email)

Supabase's hosted auth emails are configured in the **Supabase Dashboard**,
not in this repository. These files are the exact HTML bodies you paste into
the dashboard so NEXUS never shows Supabase's default wording or branding.

## Auth model (email + password, with code verification)

```
Sign in  → /login  → email + password → POST /api/auth/signin  → /app
Sign up  → /signup → email + password → POST /api/auth/signup
                        → account needs confirmation
                        → /verify-email?type=signup (6-digit code)
                        → supabase.auth.verifyOtp({ type: "signup" }) → /app
Forgot   → /forgot-password → email → POST /api/auth/forgot-password
                        → /verify-email?type=recovery (6-digit code)
                        → supabase.auth.verifyOtp({ type: "recovery" })
                        → /reset-password → POST /api/auth/update-password → /app
```

Google is the only social sign-in option (no Apple). `/verify-email` is a
single shared screen used by both the signup and the recovery flow — the
`type` query param selects which `verifyOtp` call it makes and where it goes
next.

Every code is generated, sent and checked by Supabase — NEXUS never
generates, stores or compares an OTP itself.

## Required templates

For the 6-digit code to appear in an email, the template MUST use
`{{ .Token }}` (not only the link). All three templates below include a
`{{ .Token }}` code block plus a `{{ .ConfirmationURL }}` / token-hash link
as a fallback, so a person can either type the code or click the link:

1. **Magic link** → paste `magic-link.html`. Subject: `Your login code`.
   (Kept for any account still using email-OTP sign-in; not reachable from
   the current `/login` UI, which uses email + password.)
2. **Confirm signup** → paste `confirm-signup.html`. Subject: `Confirm your email`.
3. **Reset password** → paste `recovery.html`. Subject: `Reset your password`.

Save after each paste.

## OTP length / expiration / rate limits

- The code is **6 digits** — Supabase's GoTrue default. The NEXUS
  verification screen has six boxes; do not change the token length in the
  dashboard.
- OTP expiration and the per-email / per-IP send limits are Supabase's
  built-in rate limiting. NEXUS does not implement its own OTP storage,
  generation or comparison — it only calls the official Supabase APIs.

## URL Configuration (must be applied manually)

Supabase → **Authentication → URL Configuration**:

- **Site URL**: your real NEXUS deployment URL (never `localhost` in prod),
  e.g. `https://app.nexus.com`.
- **Redirect URLs** (explicit, no wildcards):
  - `https://app.nexus.com/auth/confirm`
  - `https://app.nexus.com/auth/callback`
  - `https://app.nexus.com/auth/callback?type=recovery&next=/reset-password`
  - `https://app.nexus.com/auth/confirm?type=recovery&next=/reset-password`

Add any local/preview origins you need for non-production testing.

## Email delivery (SMTP)

By default Supabase delivers auth email from its shared `noreply@mail.app.supabase.io`
sender with a per-project rate limit (not for production volume). For
production, configure a custom SMTP provider under **Authentication → SMTP
Settings** so NEXUS authentication email comes from a trusted NEXUS domain.

SMTP credentials live only in the Supabase Dashboard — never in this
repository or in any frontend environment variable.

## Application environment variables

- `NEXT_PUBLIC_SITE_URL`: the same production URL used in Supabase Site URL.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or anon): project creds.

## Notes

- The app code does **not** fake verification, does **not** generate or store
  OTPs itself, and does **not** use the service role key. Verification goes
  through `supabase.auth.verifyOtp` (browser, for the typed code) or
  `/auth/confirm` (server, for the fallback link click).
- The email link / code expires automatically; the app shows a branded NEXUS
  error state instead of a raw Supabase error.
