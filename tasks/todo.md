# Tasks: Daily Briefing Engine (`daily-briefing`)

- [x] Task 1: Type contracts in `src/lib/intelligence/types.ts`
  - Define `BriefingFocusItem`, `DailyBriefingMetrics`, `DailyBriefing`, and `GenerateBriefingOptions`.
  - Acceptance Criteria: Exported without breaking existing imports, `npm run type-check` passes.

- [x] Task 2: Core briefing generator in `src/lib/intelligence/daily-briefing.ts`
  - Implement `computeBriefingMetrics`, `selectTopFocusItems`, `generateAttentionAlerts`, and `generateDailyBriefing`.
  - Implement in-memory daily cache keyed by `${workspaceId}:${civilDate}`.
  - Acceptance Criteria: Functions run synchronously or with optional LLM timeout, return strictly clamped structures.

- [x] Task 3: Comprehensive test suite in `supabase/tests/intelligence-daily-briefing.test.mjs`
  - Test zero-state, priority scoring, boundary clamping, timezone/date parsing, and tenant isolation.
  - Acceptance Criteria: Test suite runs with `node --import tsx --test` and achieves 100% pass rate.

- [x] Task 4: Server API endpoint in `src/app/api/intelligence/briefing/route.ts`
  - Implement GET and POST handlers with session auth, membership verification, and origin protection.
  - Acceptance Criteria: Returns 401 on unauthenticated, 403 on invalid membership, 200 with `DailyBriefing` JSON on valid session.

- [x] Task 5: Integration & Verification Gate
  - Add test suite to `package.json` under `test:intelligence` (or dedicated script).
  - Execute full gate: `npm run lint`, `npm run type-check`, `npm test`, `npm run build`.
  - Acceptance Criteria: All 4 gates pass with 0 errors and 0 warnings.
