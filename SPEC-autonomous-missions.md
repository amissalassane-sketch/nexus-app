# Spec: autonomous-missions

Module ID: **`autonomous-missions`**  
Initiative: **Intelligence Engine 2.0**  
Status: **Approved for Implementation**  
Author: Antigravity & User  
Date: 2026-10-02  

---

## 1. Objective
Elevate NEXUS's mission architecture into a **resilient multi-step autonomous orchestrator** (*Orchestrateur de Missions Autonomes*).
The orchestrator guides users through multi-step objectives (e.g. project launch, deadline preparation, backlog absorption, workspace decluttering) by:
1. **Automated Step Lifecycle & Dependency Traversal**: Deterministically evaluating each step against the live workspace snapshot and advancing the active step when conditions are satisfied.
2. **Explicit Blocker Resolution Paths (`UnblockingPath`)**: Identifying why a step is blocked and computing the exact resolution action needed to unblock it.
3. **Proposal-to-Mission Synthesis**: Seamlessly converting high-friction situations detected by `daily-briefing` or `proactive-automation` (such as resolving 5 overdue tasks) into a structured, trackable mission.
4. **Verifiable Checkpoint History**: Recording audit checkpoints during mission advancement without silent mutations.

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
- **Unit & Contract Tests**: `node --import tsx --test supabase/tests/intelligence-autonomous-missions.test.mjs`
- **Full Test Matrix**: `npm test`
- **Production Build**: `npm run build`

---

## 4. Project Structure
```
src/
├── lib/intelligence/
│   ├── types.ts                              → Mission checkpoints & unblocking types
│   ├── autonomous-orchestrator.ts            → Step traversal, blocker resolution & checkpoint engine
│   └── mission.ts                            → Core mission data model & rules
├── app/api/intelligence/
│   └── missions/
│       └── orchestrate/
│           └── route.ts                      → POST (advance mission / synthesize from proposal)
supabase/
└── tests/
    └── intelligence-autonomous-missions.test.mjs → Hermetic contract tests
```

---

## 5. Type Contract & API Design

```typescript
export interface MissionCheckpoint {
  id: string;
  stepId: string;
  previousStatus: MissionStepStatus;
  newStatus: MissionStepStatus;
  reason: string;
  timestamp: string;
}

export interface UnblockingPath {
  stepId: string;
  blockedByStepId?: string;
  reason: string;
  suggestedAction: IntelligenceAction;
}

export interface OrchestratedMissionProgress {
  mission: IntelligenceMission;
  hasAdvanced: boolean;
  unblockingPaths: UnblockingPath[];
  checkpoint?: MissionCheckpoint;
  isComplete: boolean;
}

export interface SynthesizeMissionFromProposalOptions {
  workspaceId: string;
  userId: string;
  proposal: ProactiveAutomationProposal;
  language?: "fr" | "en";
}
```

---

## 6. Safety Invariants & Rules
- **Server Authority**: The completion rule of every step is verified deterministically against real snapshot entities.
- **Bounded Transitions**: Step advancement is idempotent; repeatedly advancing with unchanged data causes 0 state drift.
- **Human Gate on Mutations**: Recommended actions on steps always respect the confirmation gate.
- **Strict Multi-Tenant Boundary**: All operations are restricted to `(workspaceId, userId)`.

---

## 7. Testing Strategy
- **Hermetic test suite**: `supabase/tests/intelligence-autonomous-missions.test.mjs`.
- **Test coverage**:
  - Deterministic step progression (ready -> in_progress -> completed upon condition satisfaction).
  - Dependency resolution (step 2 is blocked until step 1 satisfies its completion rule).
  - Unblocking path generation for blocked steps.
  - Synthesis of an actionable mission from a `proactive-automation` proposal.
  - Idempotent recomputation without infinite loops.
  - Multi-tenant boundary verification.

---

## 8. Success Criteria
- [ ] `advanceAutonomousMission(mission, snapshot)` resolves step progression accurately.
- [ ] `synthesizeMissionFromProposal(...)` builds a valid 3-step mission from any automation proposal.
- [ ] `supabase/tests/intelligence-autonomous-missions.test.mjs` passes with 100% assertions.
- [ ] Verification gate (`lint`, `type-check`, `npm test`, `build`) passes cleanly with 0 errors/warnings.
