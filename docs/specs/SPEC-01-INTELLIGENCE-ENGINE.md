# SPEC-01: Intelligence & Signals Engine Specification

> **Capability**: `CAP-03` | **Standard**: [`spec-driven-development`](../../.agents/skills/spec-driven-development/SKILL.md)

---

## 1. Executive Summary & Objectives

The NEXUS Intelligence Engine provides proactive workspace insights and autonomous multi-step execution. Unlike generative AI chatbots that directly execute raw SQL or arbitrary side-effects, NEXUS enforces a **Hermetic Action Execution Barrier**:
1. LLMs are treated as untrusted prompt-space planners.
2. Every tool invocation maps to an immutable, strictly validated action definition.
3. Every write is verified by server-side workspace authorization, RLS constraints, and post-mutation readback verification.

---

## 2. Core Components

```
User / Trigger
     │
     ▼
┌────────────────────────────────────────────────────────┐
│  Signals Engine (Deterministic Heuristics + Analysis)  │
└──────────────────────────┬─────────────────────────────┘
                           │ Discovered Signals
                           ▼
┌────────────────────────────────────────────────────────┐
│  Proactive Missions & Agent Loop                       │
│  - Evaluates current WorkspaceSnapshot                 │
│  - Selects actions from EXECUTABLE_ACTIONS allowlist   │
└──────────────────────────┬─────────────────────────────┘
                           │ Proposed Action
                           ▼
┌────────────────────────────────────────────────────────┐
│  Server Security Barrier (/api/intelligence/action)    │
│  1. Session & Workspace Membership verification        │
│  2. Payload schema validation via Zod / strict types   │
│  3. Risk classification (Low / Medium / High)          │
│  4. User confirmation requirement for destructive ops  │
│  5. Supabase RLS Mutation                              │
│  6. Post-mutation readback verification                │
└────────────────────────────────────────────────────────┘
```

---

## 3. Allowed Actions Matrix

| Action | Risk Category | Confirmation Required | Readback Check |
|:---|:---|:---|:---|
| `create_task` | LOW | No | Select by ID from workspace tasks |
| `update_task` | LOW | No | Select updated fields from workspace tasks |
| `complete_task` | LOW | No | Assert `status === 'done'` |
| `move_task` | LOW | No | Assert project/column ID updated |
| `delete_task` | HIGH | YES | Assert task row no longer exists |
| `create_project` | MEDIUM | No | Select by ID from workspace projects |
| `update_project` | MEDIUM | No | Select updated fields |
| `delete_project` | HIGH | YES | Assert project row no longer exists |
| `create_goal` | MEDIUM | No | Select by ID from workspace goals |
| `update_goal` | MEDIUM | No | Select updated fields |
| `delete_goal` | HIGH | YES | Assert goal row no longer exists |

---

## 4. Signal Store & Memory Model

- **Short-Term Memory**: Scoped per interactive turn, stores recent user intents and tool outputs.
- **Long-Term Memory**: Scoped strictly to the active `workspace_id`. Tracks historical action successes/failures to prevent repeating rejected proposals.
- **Signal Deduplication**: Signals with identical entity fingerprints within a 24-hour window are de-duplicated to prevent notification fatigue.

---

## 5. Acceptance Criteria

- [x] Zero execution of arbitrary code or unvalidated JSON schemas.
- [x] Every mutation requires explicit workspace membership (`status === 'active'`).
- [x] High-risk destructive mutations require client-side confirmation token.
- [x] 100% test coverage across hermetic test suites (`supabase/tests/intelligence-*.test.mjs`).
