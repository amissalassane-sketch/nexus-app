# Security status and reporting

Audit: 2026-09-22. **Not a production-readiness or compliance certificate.**

## Reporting
A private, monitored security contact is not configured in this repository. The operator must publish one before launch. Do not post credentials, tokens, customer content or exploit data in public issues. No incident-response SLA is claimed.

## Implemented boundaries
- Supabase session verification, active workspace membership, PostgreSQL RLS and privileged subscription writes; local SQL tests do not establish hosted policy deployment.
- OAuth state sealed/expiring/bound to user, workspace, provider and callback. PKCE where implemented. Stored tokens encrypted with contextual AAD. Key rotation/migration requires reconnecting legacy incompatible tokens.
- Calendar read adapter has bounded pagination, timeout, dedup and successful-sync-only freshness. Other adapters are not implied by OAuth registration.
- AI read tools operate on scoped snapshots; mutations require explicit confirmation, current membership/target validation and read-back. Delete requires an extra confirmation flag. Preview nonces/version binding remain missing.
- Privacy GET uses private/no-store, exports only own memory in active workspace. DELETE checks origin, bounded JSON, explicit confirmation and preview workspace binding. Regional PUT validates bounded typed values and cannot change workspace legal country.
- New regional table has owner RLS. Inactive memory purge RPC is service_role-only with fixed search_path and a 1000-row cap.
- Stripe transport is server-only. Signature verification uses official SDK over raw bytes, mode separation and age tolerance. **No payment endpoint or durable processor activated.** No frontend success grants rights.
- Baseline nosniff, referrer and permissions headers; production frame protection preserved. Development embedding allowed for Arena previews.

## Release blockers
1. Member write access to integration credential/status/run and request-log rows undermines audit trust. Move privileged state changes to a narrowly authenticated service/SQL boundary; regression-test normal OAuth before revoking access.
2. Uniform origin checks, request-size limits and distributed rate/budget enforcement do not cover all existing APIs. New privacy controls are not evidence of global protection. Authentication origin fallback also needs deployed proxy/allowlist review.
3. CSP rollout, CSRF/session expiry, Supabase cookie flags, storage ownership, signed URL TTL, upload MIME magic-byte/virus/zip-bomb checks and log redaction require complete review.
4. Durable financial receipt/ledger/correlation/replay and entitlements transaction are absent. Never wire adapter to an exposed route before this is implemented.
5. AI prompt injection, compromised provider permissions, cancellation/revocation and cross-source provenance need end-to-end adversarial tests.
6. Full account deletion/export, legal hold/backups and retention jobs outside working memory are absent. Closing UI tabs is not atomic suppression of in-flight memory writes.
7. Production secrets, RLS, migrations, workers and monitoring were not inspected behind the protected deployment.

## Secret handling
Only operator-managed environment/secret stores. Never NEXT_PUBLIC_ for AI, payment, service_role or token-encryption keys. Never log raw credentials, webhook secrets, full prompts/documents or payment details. `.env.example` contains names, not values. Stripe constructor config is not a deployment environment activation mechanism. Minimize and rotate secrets; audit key access separately.

## Required staging evidence
Auth/expired session; owner/admin/member/viewer matrix; two users in same and different workspaces; revoked/suspended membership; object storage; OAuth replay/denial/refresh/revoke; signature/body mutation/replay; provider idempotency; crash/retry; AI injection and confirmation bypass; deletion while requests run; restoration after backup; manual keyboard/screen-reader and both themes. See docs/GLOBAL_AUDIT_FINAL_2026-09-22.md for measured scope.
