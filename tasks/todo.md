# Tasks: Proactive Automation (`proactive-automation`)

- [x] Task 1: Type contracts in `src/lib/intelligence/types.ts`
  - Add `AutomationProposalKind`, `AutomationDiffItem`, `ProactiveAutomationProposal`, and `AutomationDetectionOptions`.
  - Acceptance Criteria: Exported cleanly, `npm run type-check` passes.

- [x] Task 2: Core automation engine in `src/lib/intelligence/proactive-automation.ts`
  - Implement detection algorithms:
    - `detectOverdueRescheduling`: groups overdue tasks and spreads replanning across upcoming days.
    - `detectStaleTaskArchival`: identifies tasks inactive for > 30 days.
    - `detectWorkloadConflicts`: detects deadline congestion and suggests balanced distribution.
  - Implement proposal assembly `detectAutomationProposals` with `confirmationRequired: true` on all generated actions.
  - Implement injectable request handler `handleAutomationRequest`.
  - Acceptance Criteria: Strictly deterministic, clamps sizes, zero unconfirmed actions.

- [x] Task 3: Comprehensive test suite in `supabase/tests/intelligence-proactive-automation.test.mjs`
  - Test overdue replanning, stale task detection, workload balancing, tenant isolation, and confirmation-gate invariants.
  - Acceptance Criteria: 100% pass with `node --import tsx --test`.

- [x] Task 4: Server API endpoint in `src/app/api/intelligence/automation/route.ts`
  - Implement GET and POST handlers with session auth, membership verification, and CSRF protection.
  - Acceptance Criteria: Returns 401 on unauthorized, 400 on missing workspace, 200 with typed proposals.

- [x] Task 5: Integration & Verification Gate
  - Add test script to `package.json` under `test:intelligence`.
  - Run full gate: `npm run lint`, `npm run type-check`, `npm test`, `npm run build`.
  - Acceptance Criteria: 0 errors, 0 warnings across all checks.
