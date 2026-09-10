# NEXUS email templates (Supabase hosted email)

Supabase's hosted auth emails are configured in the **Supabase Dashboard**,
not in this repository. These files are the exact HTML bodies you paste into
the dashboard so NEXUS never shows Supabase's default wording or branding.

## Email OTP (magic-link / 6-digit code) — REQUIRED for /login

The NEXUS sign-in screen is an **email OTP flow**:

```
email → supabase.auth.signInWithOtp({ shouldCreateUser: true })
      → Supabase sends a REAL 6-digit code
      → user types the code
      → supabase.auth.verifyOtp({ email, token, type: "email" })
      → session → /app
```

For the 6-digit code to appear in the email, the **Magic link** template MUST
use `{{ .Token }}` (not only `{{ .ConfirmationURL }}`):

1. Open Supabase Dashboard → **Authentication → Email Templates**.
2. **Magic link** → paste `magic-link.html` into the **Message Body**.
3. **Magic link** subject (keep): `Your login code`.
4. Save.

`magic-link.html` shows the `{{ .Token }}` code prominently and also keeps a
`{{ .ConfirmationURL }}` fallback link. Both paths are handled by NEXUS:

- typed code   → `verifyOtp` in the browser → session → `/app`
- clicked link → `/auth/confirm` exchanges `token_hash` server-side → `/app`

## OTP length / expiration / rate limits

- The code is **6 digits** — Supabase's GoTrue default. The NEXUS screen has
  six boxes; do not change the token length in the dashboard.
- OTP expiration and the per-email / per-IP send limits are Supabase's
  built-in rate limiting. NEXUS does not implement its own OTP storage,
  generation or comparison — it only calls the official Supabase APIs.

## Where to paste the other templates

1. **Confirm signup** → paste `confirm-signup.html` into the **Message Body**.
2. `Confirm signup` subject (keep): `Confirm your email`
3. **Reset password** → paste `recovery.html` into the **Message Body**.
4. `Reset password` subject (keep): `Reset your password`
5. Save.

The confirm/recovery templates use the recommended token-hash flow:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
```

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
  through `supabase.auth.verifyOtp` (browser for the typed code, server at
  `/auth/confirm` for the email link).
- The email link / code expires automatically; the app shows a branded NEXUS
  error state instead of a raw Supabase error.
