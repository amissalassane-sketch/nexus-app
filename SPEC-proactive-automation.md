# Spec: proactive-automation

Module ID: **`proactive-automation`**  
Initiative: **Intelligence Engine 2.0**  
Status: **Approved for Implementation**  
Author: Antigravity & User  
Date: 2026-10-02  

---

## 1. Objective
Empower NEXUS to detect recurring operational friction across the workspace and generate **actionable batch proposals** (*Propositions d'Automatisation Proactive*).

The module produces structured proposals for:
1. **Batch Overdue Rescheduling (`reschedule_overdue`)**: Identifies accumulated overdue tasks and calculates a progressive, realistic replanning proposal to unblock momentum.
2. **Stale & Orphan Task Archival (`archive_stale`)**: Identifies tasks inactive for > 30 days or tasks disconnected from active workflows and proposes batch archival.
3. **Workload Balancing & Conflict Spreading (`rebalance_workload`)**: Detects days overloaded with deadlines (> 4 tasks or > 2 urgent tasks on the same civil date) and proposes a distributed schedule.
4. **Project Priority Harmonization (`harmonize_priorities`)**: Detects mismatches between project criticality and task priorities (e.g., critical project with untracked low-priority tasks).

### Critical Safety Invariants (Human-in-the-Loop)
- **Zero silent mutations**: The engine never updates database rows autonomously.
- **Preview & Confirmation Gate**: Every proposal contains an explicit diff (`current` vs `proposed`) and generates `IntelligenceAction` descriptors with `confirmationRequired: true`.
- **Atomic or Discrete Execution**: The user can approve individual items in a proposal or the entire batch at once.
- **Read-back Verification**: When executed, actions verify the entity still exists and matches expected pre-conditions before writing.

---

## 2. Tech Stack
- **Language**: TypeScript 5.8+ (Strict mode, zero `any`)
- **Framework**: Next.js 16.3.8 (Turbopack, React 19)
- **Database / Isolation**: Supabase Postgres with RLS and Workspace isolation
- **Test Runner**: Node.js built-in test runner (`node --import tsx --test`)

---

## 3. Commands
- **Lint**: `npm run lint`
- **Type Check**: `npm run type-check`
- **Unit & Contract Tests**: `node --import tsx --test supabase/tests/intelligence-proactive-automation.test.mjs`
- **Full Test Matrix**: `npm test`
- **Production Build**: `npm run build`

---

## 4. Project Structure
```
src/
├── lib/intelligence/
│   ├── types.ts                          → Automation proposal types & interfaces
│   ├── proactive-automation.ts           → Detection rules, schedule redistribution & proposal builder
│   └── actions.ts                        → Action execution integration
├── app/api/intelligence/
│   └── automation/
│       └── route.ts                      → GET (list proposals) / POST (execute confirmed proposal)
supabase/
└── tests/
    └── intelligence-proactive-automation.test.mjs → Hermetic contract tests
```

---

## 5. Type Contract & API Design

```typescript
export type AutomationProposalKind =
  | "reschedule_overdue"
  | "archive_stale"
  | "rebalance_workload"
  | "harmonize_priorities";

export interface AutomationDiffItem {
  entityId: string;
  entityType: "task" | "project";
  title: string;
  field: "due_at" | "status" | "priority";
  currentValue: string | null;
  proposedValue: string;
  reason: string;
}

export interface ProactiveAutomationProposal {
  id: string;
  workspaceId: string;
  kind: AutomationProposalKind;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  diffItems: AutomationDiffItem[];
  actions: IntelligenceAction[];
  estimatedTimeSavedMinutes: number;
  generatedAt: string;
}

export interface AutomationDetectionOptions {
  workspaceId: string;
  civilDate?: string;
  language?: "fr" | "en";
  staleDaysThreshold?: number; // default: 30
  maxOverloadPerDay?: number; // default: 4
}
```

---

## 6. Testing Strategy
- **Hermetic test suite**: `supabase/tests/intelligence-proactive-automation.test.mjs`.
- **Test coverage**:
  - Overdue batch detection and forward date distribution (does not set dates in the past).
  - Stale task detection with configurable thresholds.
  - Workload balance redistribution across subsequent working days.
  - Multi-tenant workspace isolation.
  - Verification that every proposed action carries `confirmationRequired: true`.
  - API endpoint authentication, validation, and error reporting.

---

## 7. Success Criteria
- [ ] `detectAutomationProposals(snapshot, options)` generates structured proposals matching the contract.
- [ ] 100% of generated proposals require confirmation before mutation.
- [ ] `supabase/tests/intelligence-proactive-automation.test.mjs` achieves 100% pass rate.
- [ ] `GET /api/intelligence/automation` returns proposals for the active workspace.
- [ ] Verification gate (`lint`, `type-check`, `npm test`, `build`) passes cleanly with 0 errors/warnings.
