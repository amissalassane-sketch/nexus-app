# SPEC-03: Security Hardening & Threat Model Specification

> **Capability**: Platform-wide | **Standard**: [`security-and-hardening`](../../.agents/skills/security-and-hardening/SKILL.md)

---

## 1. Executive Summary

NEXUS processes sensitive organizational data: intellectual property, project roadmaps, task execution, OAuth tokens, and financial subscriptions. This document defines the formal threat model, trust boundaries, STRIDE mitigation analysis, and defense-in-depth controls.

---

## 2. Trust Boundaries & Attack Surfaces

```
[ UNTRUSTED ]
   ├─ Browser Clients (Public Internet)
   ├─ External Webhooks & OAuth Callbacks (Google, Slack, GitHub)
   └─ Untrusted LLM Prompt Completions
             │
      HTTPS / TLS 1.3
      Reverse Proxy & Next.js Runtime
             │
[ EDGE BOUNDARY (Next.js Headers & Middleware) ]
   ├─ Content-Security-Policy (CSP)
   ├─ Strict-Transport-Security (HSTS)
   ├─ X-Frame-Options (Clickjacking)
   └─ Origin & SameSite Cookie Enforcement
             │
[ SERVER BOUNDARY (/api/*) ]
   ├─ Session Cookie Validation (@supabase/ssr)
   ├─ Request Schema Validation (Zod / JSON Validators)
   ├─ RBAC Gate (Owner / Admin / Member / Viewer)
   └─ Rate Limiting & Input Size Limits (Max 500 chars on capture)
             │
[ DATA & ISOLATION BOUNDARY ]
   ├─ PostgreSQL Row-Level Security (RLS) on EVERY table
   ├─ Workspace ID Tenancy Isolation (No cross-tenant leakage)
   ├─ Secret Sealing (AES-256-GCM for OAuth tokens)
   └─ Hermetic Readback Verification
```

---

## 3. STRIDE Threat Analysis Matrix

| Threat (STRIDE) | Attack Vector | NEXUS Mitigation Architecture | Verification |
|:---|:---|:---|:---|
| **S**poofing | Attacker pretends to be another workspace user or calls admin APIs. | Server-side cryptographic JWT signature verification via Supabase Auth. RBAC checked in SQL functions and API route handlers. | `supabase/tests/admin-access.test.mjs` |
| **T**ampering | Modifying tasks or subscriptions belonging to another workspace. | Strict PostgreSQL RLS policies where `workspace_id` must match `workspace_members.workspace_id`. Zero raw client SQL. | `supabase/tests/global-privacy-rls.test.mjs` |
| **R**epudiation | User denies taking a destructive action (deleting project, updating billing). | Activity audit logs written on critical events (`activity_log` table with user_id, action, timestamp, IP context). | `supabase/tests/activity-action-trigger.test.mjs` |
| **I**nformation Disclosure | Internal database errors, user PII, or access tokens leaked via API errors or search queries. | Generic error envelopes (`apiError`), masked secrets, token encryption via AES-256-GCM, workspace-scoped search queries. | `supabase/tests/integrations-hardening.test.mjs` |
| **D**enial of Service | High payload capture, recursive intelligence loops, API flooding. | 500-char max on capture, bounded mission loops (`MAX_MISSION_STEPS = 5`), timeout limits on parallel search sources. | `supabase/tests/request-json.test.mjs` |
| **E**levation of Privilege | Member role upgrading themselves or calling billing/admin APIs. | Server-side role checks (`['owner', 'admin'].includes(role)`) enforced before DB mutations. | `supabase/tests/admin-subscriptions.test.mjs` |

---

## 4. Defense-in-Depth Implementation Checklist

- [x] **HTTP Security Headers**: HSTS (`max-age=63072000; includeSubDomains; preload`), CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`.
- [x] **CSRF Defense**: Short-lived, sealed `httpOnly`, `secure`, `sameSite=lax` cookies for OAuth handshakes.
- [x] **SSRF Protection**: Strict URL allowlisting for OAuth endpoints (`accounts.google.com`, `slack.com`), and validated server origins.
- [x] **Zero Open Redirects**: `safeNextPath` strips whitespace, ensures leading `/`, and blocks protocol-relative (`//`) attempts.
- [x] **Credential Sealing**: OAuth tokens are sealed at rest using authenticated AES-256-GCM cipher with random IVs and integrity tags.
- [x] **Supply Chain & Dependencies**: 0 known vulnerabilities confirmed by `npm audit`.
