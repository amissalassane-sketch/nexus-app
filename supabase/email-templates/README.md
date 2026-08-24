# NEXUS email templates (Supabase hosted email)

Supabase's hosted auth emails are configured in the **Supabase Dashboard**,
not in this repository. These files are the exact HTML bodies you paste into
the dashboard so NEXUS never shows Supabase's default wording or branding.

## Where to paste them

1. Open Supabase Dashboard → **Authentication → Email Templates**.
2. **Confirm signup** → paste `confirm-signup.html` into the **Message Body**.
3. `Confirm signup` subject (keep): `Confirm your email`
4. **Reset password** → paste `recovery.html` into the **Message Body**.
5. `Reset password` subject (keep): `Reset your password`
6. Save.

The templates already use the recommended token-hash flow:

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

## Application environment variables

- `NEXT_PUBLIC_SITE_URL`: the same production URL used in Supabase Site URL.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or anon): project creds.

## Notes

- The app code does **not** fake verification and does **not** use the service
  role key. Verification still goes through `supabase.auth.verifyOtp` on the
  server at `/auth/confirm`.
- The email link expires automatically; the app shows a branded NEXUS error
  state instead of a raw Supabase error.
