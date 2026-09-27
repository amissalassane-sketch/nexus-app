# SPEC-02: Billing, Subscription & Freemium Quota Specification

> **Capability**: `CAP-04` | **Standard**: [`spec-driven-development`](../../.agents/skills/spec-driven-development/SKILL.md)

---

## 1. Executive Summary & Objectives

NEXUS enforces a multi-tier commercial SaaS model with hard boundary quotas for FREE accounts, automated upgrades to PRO and ENTERPRISE, and hermetic price determination.

---

## 2. Quota Matrix & Plan Boundaries

All limits are declared as single sources of truth in [`src/lib/plan-limits.ts`](file:///src/lib/plan-limits.ts) and mirrored in PostgreSQL database triggers:

| Metric / Dimension | FREE Tier | PRO Tier | ENTERPRISE Tier | Enforcement Mechanism |
|:---|:---|:---|:---|:---|
| **Max Active Tasks** | 50 | 500 | Unlimited (`Infinity`) | DB Before-Insert Trigger + API Pre-check |
| **Max Active Projects** | 3 | 25 | Unlimited (`Infinity`) | DB Before-Insert Trigger + UI Gate |
| **Max Storage Files** | 20 (max 10MB/file) | 200 (max 50MB/file) | 1,000 (max 250MB/file) | Storage RLS + Metadata Table Trigger |
| **Max Members per Workspace** | 2 | 10 | Unlimited (`Infinity`) | Workspace Membership Check |
| **AI Actions / Month** | 100 | 2,000 | Unlimited (`Infinity`) | Action Rate Limiter |
| **Third-Party Integrations** | 1 connection | 5 connections | Unlimited | Connection Registry |

---

## 3. Subscription Lifecycle State Machine

The subscription state machine is modeled deterministically in [`src/lib/billing/state-machine.ts`](file:///src/lib/billing/state-machine.ts):

```
                   ┌─────────────┐
                   │    FREE     │
                   └──────┬──────┘
                          │ checkout.session.completed
                          ▼
                   ┌─────────────┐
        ┌─────────►│   ACTIVE    │◄──────────┐
        │          └──────┬──────┘           │
        │ invoice         │ customer         │ invoice.paid
        │ payment         │ subscription     │
        │ succeeded       │ updated          │
        │                 ▼                  │
        │          ┌─────────────┐           │
        │          │ PAST_DUE /  │───────────┘
        │          │ INCOMPLETE  │
        │          └──────┬──────┘
        │                 │ 14-day grace period expired
        │                 ▼
        └──────────┌─────────────┐
                   │  CANCELED   │
                   └─────────────┘
```

### State Definitions:
- `FREE`: Default tier when workspace has no explicit `workspace_subscriptions` entry.
- `ACTIVE`: Paid tier in good standing; full quota entitlements enabled.
- `PAST_DUE`: Payment failed; 14-day grace period maintains PRO access with banner alerts.
- `CANCELED`: Downgraded back to `FREE`. Existing data is preserved read-only if above FREE limits.

---

## 4. Multi-Currency Commercial Catalog

- Prices are defined in integer minor units (cents for USD/EUR, whole units for XOF/JPY).
- Floating-point representations (`0.2`, `NaN`, `Infinity`) are strictly prohibited in runtime money calculations.
- Tax status is explicit: `'inclusive'` or `'exclusive'`, never inferred.
