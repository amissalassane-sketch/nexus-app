# NEXUS Platform — Architecture Capability Map

> **Standard Compliance**: Implemented according to [`spec-driven-development`](../../.agents/skills/spec-driven-development/SKILL.md) Phase 0 Decomposition.

---

## 1. Initiative Overview

NEXUS is an AI-augmented workspace orchestrating tasks, projects, notes, calendar, files, and multi-agent intelligence with hermetic multi-tenant data isolation and commercial subscription management.

---

## 2. Platform Capability Decomposition

```
┌────────────────────────────────────────────────────────┐
│                   NEXUS Core Engine                    │
├──────────────────────────┬─────────────────────────────┤
│   CAP-AUTH               │   CAP-ADMIN                 │
│   Identity, RBAC, RLS    │   Control Plane & Audit     │
├──────────────────────────┼─────────────────────────────┤
│   CAP-CAPTURE            │   CAP-INTELLIGENCE          │
│   Deterministic Natural  │   Signals, Missions, Memory │
│   Language Parser        │   Secure Action Engine      │
├──────────────────────────┼─────────────────────────────┤
│   CAP-BILLING            │   CAP-INTEGRATIONS          │
│   Freemium Quotas &      │   OAuth Handshake, AES-256  │
│   State Machine          │   Lineage Event Stream      │
└──────────────────────────┴─────────────────────────────┘
```

---

## 3. Capability Modules & Build Graph

| Module ID | Module Name | Responsibility | Primary Contracts & Files | Dependencies | Status |
|:---|:---|:---|:---|:---|:---|
| **CAP-01** | `auth-and-tenancy` | User signin/signup, session cookies, workspace bootstrap, row-level security (RLS) enforcement. | `src/lib/auth.ts`, `src/lib/workspace.ts`, `src/lib/supabase/` | None (Foundation) | ✅ Active & Verified |
| **CAP-02** | `capture-engine` | Instant one-sentence task creation via deterministic NLP in FR & EN without LLM hallucinations. | `src/lib/capture.ts`, `src/app/api/capture/` | CAP-01 | ✅ Active & Verified |
| **CAP-03** | `intelligence-core` | Multi-agent reasoning, proactive signals, mission execution loops, hermetic tool-calling barrier. | `src/lib/intelligence/` (actions, engine, memory, mission, signals) | CAP-01, CAP-02 | ✅ Active & Verified |
| **CAP-04** | `billing-and-limits` | Commercial pricing catalog, quota gates (tasks, files, members), subscription state machine. | `src/lib/billing/`, `src/lib/plan-limits.ts` | CAP-01 | ✅ Active & Verified |
| **CAP-05** | `admin-governance` | Control plane, workspace directory, system health telemetry, audit trails, member access review. | `src/app/admin/`, `src/lib/admin/` | CAP-01, CAP-04 | ✅ Active & Verified |
| **CAP-06** | `integrations-lineage` | Sealed OAuth token management (AES-256-GCM), event lineage bridge, external sync adapters. | `src/lib/integrations/`, `src/app/api/integrations/` | CAP-01 | ✅ Active & Verified |

---

## 4. Verification & Testing Order

1. **Foundation Gate**: `CAP-01` hermetic RLS tests (`supabase/tests/global-privacy-rls.test.mjs`).
2. **Deterministic Processing Gate**: `CAP-02` NLP tests (`supabase/tests/capture-parser.test.mjs`).
3. **Intelligence Security Gate**: `CAP-03` tool-call and memory isolation tests (`supabase/tests/intelligence-*.test.mjs`).
4. **Commercial Boundary Gate**: `CAP-04` freemium quota & subscription contract tests (`supabase/tests/freemium-contract.test.mjs`, `subscription-contract.test.mjs`).
5. **Governance Gate**: `CAP-05` admin access & directory tests (`supabase/tests/admin-*.test.mjs`).
6. **Lineage Gate**: `CAP-06` hermetic bridge lineage tests (`supabase/tests/bridge-lineage-hermetic.test.mjs`).
