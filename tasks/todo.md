# Tasks: Autonomous Missions Orchestrator (`autonomous-missions`)

- [ ] Task 1: Type contracts in `src/lib/intelligence/types.ts`
  - Define `MissionCheckpoint`, `UnblockingPath`, `OrchestratedMissionProgress`, and `SynthesizeMissionOptions`.
  - Acceptance Criteria: Exported cleanly, `npm run type-check` passes.

- [ ] Task 2: Core orchestrator in `src/lib/intelligence/autonomous-orchestrator.ts`
  - Implement `evaluateStepCompletion`: evaluates deterministic completion rules against real snapshot.
  - Implement `advanceAutonomousMission`: traverses step dependencies, updates statuses, moves `currentStepId`, records checkpoint.
  - Implement `computeUnblockingPaths`: diagnoses why blocked steps are blocked and generates recovery actions.
  - Implement `synthesizeMissionFromProposal`: converts any `ProactiveAutomationProposal` into a structured, trackable mission.
  - Implement injectable API handler `handleOrchestrateMissionRequest`.
  - Acceptance Criteria: Idempotent traversal, zero infinite loops, bounded step count.

- [ ] Task 3: Comprehensive test suite in `supabase/tests/intelligence-autonomous-missions.test.mjs`
  - Test step progression, dependency satisfaction, blocker resolution paths, proposal-to-mission synthesis, and tenancy isolation.
  - Acceptance Criteria: 100% pass with `node --import tsx --test`.

- [ ] Task 4: Server API endpoint in `src/app/api/intelligence/missions/orchestrate/route.ts`
  - Implement POST handler with session auth, workspace assertion, and CSRF protection.
  - Acceptance Criteria: Returns 401 on unauthorized, 400 on missing workspace/missionId, 200 with progressed mission payload.

- [ ] Task 5: Integration & Verification Gate
  - Add test script to `package.json` under `test:intelligence`.
  - Run full gate: `npm run lint`, `npm run type-check`, `npm test`, `npm run build`.
  - Acceptance Criteria: 0 errors, 0 warnings across all checks.
