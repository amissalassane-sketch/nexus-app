# NEXUS Capability Matrix

This file is the starting point for the Reality Audit capability inventory. For each capability, fill the columns with evidence and set the Status to one of: REAL, PARTIAL, MOCK, BROKEN, STUB, UNVERIFIED.

Columns: Capability | UI | API | DB | Persistence | Security | Test | Status | Evidence (paths / notes)

---

## Authentication
- Signup |  |  |  |  |  |  | UNVERIFIED |
- Login |  |  |  |  |  |  | UNVERIFIED |
- Logout |  |  |  |  |  |  | UNVERIFIED |
- Session persistence |  |  |  |  |  |  | UNVERIFIED |
- Password reset |  |  |  |  |  |  | UNVERIFIED |
- Email verification |  |  |  |  |  |  | UNVERIFIED |
- OAuth |  |  |  |  |  |  | UNVERIFIED |

## Onboarding
- Workspace creation | UI:signup pages | API:auth/signup RPCs | DB:workspaces table, migrations | Persistence:workspaces + subscriptions | Security:RLS tested | Test: supabase/tests/onboarding-rls.test.mjs, supabase/tests/migration-logic.test.mjs | REAL | Evidence: supabase/tests/onboarding-rls.test.mjs (signup creates workspace), supabase/migrations/001_nexus_base_schema.sql
- User profile | UI:profile pages | API:profiles RPCs | DB:profiles table, migrations | Persistence:profiles | Security:RLS tested | Test: supabase/tests/onboarding-rls.test.mjs, supabase/tests/migration-logic.test.mjs | REAL | Evidence: supabase/tests/onboarding-rls.test.mjs (profile upsert/read-back), supabase/migrations/
- Preferences | UI:profile/preferences | API:profiles | DB:profiles (onboarding flags) | Persistence:profiles | Security: RLS | Test: supabase/tests/onboarding-rls.test.mjs | PARTIAL | Evidence: onboarding-rls covers onboarding_completed
- First project | UI:onboarding flows | API:projects RPC | DB:projects | Persistence:projects | Security: RLS | Test: supabase/tests/migration-logic.test.mjs | REAL | Evidence: migration-logic.test.mjs (project creation limits and provisioning)
- First task | UI:onboarding flows | API:tasks | DB:tasks | Persistence:tasks | Security: RLS | Test: supabase/tests/migration-logic.test.mjs, supabase/tests/intelligence-agent.test.mjs | PARTIAL | Evidence: migration-logic.test.mjs (task limits), intelligence tests exercise task flows in fake DB
- Completion state | UI:onboarding | API:profiles | DB:profiles.onboarding_completed | Persistence:profiles | Security: RLS | Test: supabase/tests/onboarding-rls.test.mjs | REAL | Evidence: onboarding-rls sets and verifies onboarding_completed

## Workspace
- Workspace creation | UI:signup/onboarding | API:get_or_create_personal_workspace RPC | DB:workspaces table, migrations | Persistence:workspaces | Security:RLS + plan limits | Test: supabase/tests/onboarding-rls.test.mjs, supabase/tests/migration-logic.test.mjs | REAL | Evidence: onboarding-rls.test.mjs (bootstrap), migration-logic.test.mjs (workspace provisioning), supabase/migrations/001_nexus_base_schema.sql (policies: base_workspaces_create_owner, base_workspaces_read_members), supabase/migrations/012_enforce_workspace_membership_on_write.sql (assert_workspace_member trigger)
- Workspace switching | UI:workspace switcher | API:workspace context routes | DB:workspaces, workspace_members | Persistence:workspace membership | Security:RLS | Test: supabase/tests/onboarding-rls.test.mjs, supabase/tests/workspace-bootstrap.test.mjs | PARTIAL | Evidence: workspace bootstrap + membership tests
- Workspace persistence | UI & API | API:workspaces endpoints | DB:workspaces | Persistence:workspaces | Security:RLS | Test: supabase/tests/onboarding-rls.test.mjs | REAL | Evidence: onboarding-rls verifies persistence across reloads
- Workspace isolation | UI scopes, API filters | API:read/write guarded by auth.uid()/RLS | DB:policies in migrations | Persistence:scoped rows | Security: RLS strict | Test: supabase/tests/onboarding-rls.test.mjs, supabase/tests/intelligence-agent.test.mjs, supabase/tests/intelligence-agent-v2.test.mjs | REAL | Evidence: tests assert cross-workspace reads/writes are denied; RLS policies in supabase/migrations/001_nexus_base_schema.sql (base_projects_read, base_tasks_read, base_goals_read) and triggers in supabase/migrations/012_enforce_workspace_membership_on_write.sql

## Tasks
- Create | UI:task composer & onboarding | API:tasks insert RPCs | DB:tasks table, migrations | Persistence:tasks | Security:RLS & plan limits | Test: supabase/tests/intelligence-agent.test.mjs, supabase/tests/migration-logic.test.mjs | PARTIAL | Evidence: intelligence-agent.test.mjs (server mutation layer with fake DB), migration-logic.test.mjs (task limits), supabase/migrations/001_nexus_base_schema.sql (base_tasks_insert/read/update/delete policies), supabase/migrations/012_enforce_workspace_membership_on_write.sql (triggers enforcing workspace membership on writes)
- Read | UI:task list / details | API:get_task/get_tasks | DB:tasks | Persistence:tasks | Security:RLS | Test: supabase/tests/intelligence-agent-v2.test.mjs, supabase/tests/intelligence-agent.test.mjs | REAL | Evidence: intelligence-agent-v2.test.mjs (executeReadTool get_tasks/get_task)
- Update | UI:edit task | API:update task RPC | DB:tasks | Persistence:tasks | Security:RLS | Test: supabase/tests/intelligence-agent.test.mjs, supabase/tests/intelligence-agent-v2.test.mjs | PARTIAL | Evidence: tests exercise update_task in fake DB and verify read-back
- Delete | UI:delete flows | API:delete task RPC | DB:tasks | Persistence:deleted rows | Security:RLS, high-risk confirm | Test: supabase/tests/intelligence-agent.test.mjs, intelligence-agent-v2.test.mjs | PARTIAL | Evidence: delete_task tested with confirmDeletion checks
- Complete | UI:complete action | API:update status | DB:tasks.completed_at | Persistence:tasks | Security:RLS | Test: supabase/tests/intelligence-agent.test.mjs | PARTIAL | Evidence: complete_task verified in server mutation layer
- Move | UI:change due date / move between lists | API:update due_at | DB:tasks | Persistence:tasks | Security:RLS | Test: supabase/tests/intelligence-agent.test.mjs | PARTIAL | Evidence: move_task tested (due date change)
- Priority | UI:priority control | API:update priority | DB:tasks.priority | Persistence:tasks | Test: intelligence tests | PARTIAL | Evidence: priority extraction & update tested in intelligence suites
- Due date | UI:date picker | API:update due_at | DB:tasks.due_at | Persistence:tasks | Test: intelligence tests | PARTIAL | Evidence: due date extraction / move tested
- Search | UI:search workspace | API:search_workspace read tool | DB:search helpers | Persistence: - | Test: intelligence-agent-v2.test.mjs | REAL | Evidence: search_workspace executed and returns real matches in tests
- Filtering | UI filters | API read queries | DB queries | Test: intelligence tests | PARTIAL | Evidence: read tools implement filtering
- Sorting | UI sorting | API read queries | Test: intelligence tests | PARTIAL | Evidence: read tools return ordered priorities

## Projects
- Create | UI:project create | API:projects RPCs | DB:projects table, migrations | Persistence:projects | Security:RLS & plan limits | Test: supabase/tests/migration-logic.test.mjs, supabase/tests/onboarding-rls.test.mjs | PARTIAL | Evidence: migration-logic.test.mjs (project limits), onboarding-rls covers denied cross-workspace inserts, supabase/migrations/001_nexus_base_schema.sql (base_projects_insert/read/update policies), supabase/migrations/012_enforce_workspace_membership_on_write.sql (write triggers)
- Read | UI:project list/detail | API:get_project/get_projects | DB:projects | Persistence:projects | Security:RLS | Test: intelligence-agent-v2.test.mjs (get_projects) | REAL | Evidence: executeReadTool get_projects in intelligence-agent-v2.test.mjs
- Update | UI:edit project | API:update_project | DB:projects | Persistence:projects | Security:RLS | Test: migration & intelligence tests | PARTIAL | Evidence: mutation tests exercise project updates in fake DB; migration tests assert plan scoping
- Delete | UI:delete project | API:delete_project | DB:projects | Persistence:projects | Security:RLS, high-risk confirmation | Test: intelligence-agent-v2.test.mjs | PARTIAL | Evidence: delete_project risk flagged in tool registry tests
- Status | Status tracking | API/status fields | DB:projects.status | Test: migration-logic & intelligence tests | PARTIAL | Evidence: projects used in snapshots and plan logic
- Progress | Progress tracking | DB:projects.progress | Test: intelligence-agent.test.mjs | PARTIAL | Evidence: progress used in snapshot for reasoning
- Tasks relation | Relation between projects and tasks | DB:project_id foreign key | Test: intelligence tests | PARTIAL | Evidence: snapshots include project/task relations in tests

## Goals
- Create | UI:goals create | API:goals RPCs | DB:goals table | Persistence:goals | Security:RLS & plan limits | Test: supabase/tests/migration-logic.test.mjs, supabase/tests/intelligence-agent-v2.test.mjs | PARTIAL | Evidence: migration-logic enforces goal limits; intelligence tests exercise create/update/delete_goal in fake DB; supabase/migrations/001_nexus_base_schema.sql (base_goals_insert/read/update policies), supabase/migrations/012_enforce_workspace_membership_on_write.sql (write triggers)
- Read | UI:goals list | API:get_goals | DB:goals | Persistence:goals | Security:RLS | Test: intelligence-agent-v2.test.mjs | REAL | Evidence: executeReadTool references goals in snapshots
- Update | UI:edit goal | API:update_goal | DB:goals | Test: intelligence-agent-v2.test.mjs | PARTIAL | Evidence: update_goal verified in tests (fake DB)
- Delete | UI:delete goal | API:delete_goal | DB:goals | Security:confirmDeletion | Test: intelligence-agent-v2.test.mjs | PARTIAL | Evidence: delete_goal tested with confirmDeletion in tests
- Progress | Progress tracking & relations | DB:goals.progress | Test: intelligence-agent.test.mjs | PARTIAL | Evidence: snapshot goals contain progress used by computeInsights
- Relations | Goal-task/project relations | DB:relations | Test: intelligence tests | PARTIAL | Evidence: goals used in snapshots and plan computation

## Kanban
- Drag & drop |  |  |  |  |  |  | UNVERIFIED |
- Persistence |  |  |  |  |  |  | UNVERIFIED |
- Status synchronization |  |  |  |  |  |  | UNVERIFIED |
- Ordering |  |  |  |  |  |  | UNVERIFIED |
- Reload persistence |  |  |  |  |  |  | UNVERIFIED |

## Intelligence

> Re-audited from real code, API routes, Supabase migrations and test runs (not from prior documentation). Status vocabulary for this section is strictly: **COMPLETE / PARTIAL / MISSING / UNVERIFIED** (this replaces the REAL/PARTIAL/MOCK/BROKEN/STUB/UNVERIFIED vocabulary used elsewhere in this file, which was not re-verified in this pass). UI-only presence is never COMPLETE. All 7 targeted Intelligence test suites were executed on 2026-09-11 and passed (546 assertions, 0 failures) — see Tests below; these are unit tests against in-memory Supabase fakes, not against a live Supabase instance, so DB persistence itself is verified via migration inspection (RLS policies), not via a live-DB test run.

- Query (read tools) | UI: src/components/intelligence/intelligence-ask.tsx posts to POST /api/intelligence/query | API: src/app/api/intelligence/query/route.ts (re-validates session + active membership, scopes every read to workspace_id) | Logic: src/lib/intelligence/tools.ts (`TOOL_REGISTRY`, `selectToolsForIntent`, executeReadTool-style read tools: get_tasks/get_projects/get_priorities/get_overdue_tasks/get_blocked_tasks/search_workspace) | DB: reads tasks/projects/goals/activities/task_dependencies scoped by `.eq("workspace_id", workspaceId)` | Security: route rejects unauthenticated (401) and workspace-less (400) requests | Test: supabase/tests/intelligence-agent.test.mjs, intelligence-agent-v2.test.mjs (PASS, incl. "Foreign task invisible from another workspace", "RLS enabled on tasks/projects") | **COMPLETE** | Evidence: src/app/api/intelligence/query/route.ts:1-140, src/lib/intelligence/tools.ts:90 (`TOOL_REGISTRY`), 401 (`selectToolsForIntent`)
- Context building | src/lib/intelligence/context-builder.ts (`buildWorkspaceContext`) consumed by src/lib/intelligence/agent.ts | No dedicated UI, no DB writes — pure derivation from the scoped snapshot | Test: intelligence-agent.test.mjs / intelligence-experience.test.mjs (PASS, e.g. "Context traces blocker dependency to prerequisite task") | **COMPLETE** (as a backend building block; not a standalone user-facing capability) | Evidence: src/lib/intelligence/context-builder.ts:1-262
- Intent detection | src/lib/intelligence/intent.ts (`classifyIntent`, `extractDueDateFromQuery`, `extractPriorityFromQuery`) invoked in src/app/api/intelligence/query/route.ts | Test: intelligence-agent.test.mjs, intelligence-agent-v2.test.mjs, intelligence-memory.test.mjs ("resolvedTarget flows into UPDATE/MOVE/DELETE classification") — all PASS | **COMPLETE** | Evidence: src/lib/intelligence/intent.ts:1-629
- Tool selection | src/lib/intelligence/tools.ts (`TOOL_REGISTRY`, `selectToolsForIntent`) | Security invariant tests: "Tool layer never imports Supabase", "No SQL strings in the tool layer" (intelligence-agent-v2.test.mjs, PASS) | **COMPLETE** | Evidence: src/lib/intelligence/tools.ts:401 (`selectToolsForIntent`)
- Tool execution — reads | src/lib/intelligence/agent.ts runs read tools against the pre-fetched, workspace-scoped snapshot only (never touches Supabase itself) | Test: intelligence-agent-v2.test.mjs ("Read tool scoped to its snapshot") PASS | **COMPLETE** | Evidence: src/lib/intelligence/agent.ts:1-120 (header states "tool layer never imports Supabase"), confirmed by static test assertion
- Tool execution — mutations | UI: confirm buttons in intelligence-ask.tsx / mission-panel.tsx / proactive-signals-panel.tsx POST to /api/intelligence/action | API: src/app/api/intelligence/action/route.ts (`EXECUTABLE_ACTIONS` allow-list: create/update/delete task/project/goal, complete_task, move_task) | Logic: src/lib/intelligence/actions.ts (`executeIntelligenceAction`) re-resolves the target id inside the workspace, requires `confirmed:true`, requires `confirmDeletion:true` for high-risk (delete) actions, performs the Supabase mutation, then reads the row back and calls `verifyTask`/`verifyProject`/`verifyGoal` before reporting success | DB: real tables `tasks`/`projects`/`goals`, scoped by `workspace_id` on every read/write | Test: intelligence-agent.test.mjs, intelligence-agent-v2.test.mjs, intelligence-mission.test.mjs (full create→block→unblock→complete→verify scenario, PASS) | **COMPLETE** for the logic/security/verification layer (proved against in-memory Supabase fakes); **UNVERIFIED** against a live Supabase instance (no live-DB integration test exists in this repo) | Evidence: src/lib/intelligence/actions.ts:204-531, src/app/api/intelligence/action/route.ts:1-60
- Planning | src/lib/intelligence/planner.ts (`buildPlan`) | Test: intelligence-agent-v2.test.mjs | **PARTIAL** | Evidence: src/lib/intelligence/planner.ts:51 (`buildPlan`) exists and is exercised by tests, but there is no dedicated planner-focused test file (assertions are indirect via agent tests) — logic verified, coverage breadth unverified
- Confirmation UX | UI: intelligence-ask.tsx renders a risk-tiered confirm dialog (`currentResponse.action.risk === "high" | "medium"`, distinct copy for high risk) with `aria-*` attributes and ≥44px touch targets | API: action route rejects execution unless payload carries `confirmed:true` (409 otherwise), and `confirmDeletion:true` for destructive actions (409 otherwise) | Test: intelligence-agent-v2.test.mjs ("Confirmation buttons ≥44px on mobile", needsConfirmation assertions) PASS | **COMPLETE** | Evidence: src/components/intelligence/intelligence-ask.tsx:953-1036, src/lib/intelligence/actions.ts:216-226
- Verification (read-back) | src/lib/intelligence/actions.ts (`verifyTask`, `verifyProject`, `verifyGoal`) re-reads the mutated row from the DB and compares expected fields before the API reports success; a mismatch throws `ActionError` (500) instead of a false "success" | Test: intelligence-agent.test.mjs, intelligence-mission.test.mjs ("unblock executed + verified", "complete executed + verified") PASS | **COMPLETE** | Evidence: src/lib/intelligence/actions.ts:107-200 (verify functions), route usage in src/app/api/intelligence/action/route.ts
- Memory (structured, persisted) | UI: intelligence-ask.tsx sends/receives `memory` in the query payload and mirrors it to localStorage as an offline cache | API: query/action routes call `readMemory`/`saveMemory` (src/lib/intelligence/memory.ts) | DB: table `intelligence_memory` (migration 023), one row per (user_id, workspace_id), RLS: select/insert/update/delete all scoped to `user_id = auth.uid() and is_active_workspace_member(workspace_id)` | Test: intelligence-memory.test.mjs (115 assertions incl. persistence, multi-workspace isolation, scrubbing of deleted ids) PASS | **COMPLETE** | Evidence: supabase/migrations/023_intelligence_memory.sql, src/lib/intelligence/memory.ts:441-488, src/app/api/intelligence/query/route.ts (readMemory/saveMemory calls)
- Reference resolution ("the second one", "it") | src/lib/intelligence/references.ts (`resolveReference`), verified against the fresh server snapshot (stale ids resolve to "deleted") | Test: intelligence-memory.test.mjs ("deleted target dropped", ambiguity tests) PASS | **COMPLETE** | Evidence: src/lib/intelligence/references.ts:1-578
- Session context | src/lib/intelligence/agent.ts (`buildEffectiveHistory`, `memoryFromSessionHistory`) | Test: intelligence-agent-v2.test.mjs (workspace isolation, effective history) PASS | **COMPLETE** | Evidence: src/lib/intelligence/agent.ts (exported functions used directly in tests)
- Proactive signals | UI: src/components/intelligence/proactive-signals-panel.tsx, signal-card.tsx, signal-detail.tsx call GET/POST /api/intelligence/signals | API: src/app/api/intelligence/signals/route.ts is a thin wrapper delegating to src/lib/intelligence/signal-api.ts (`handleSignalsRequest`) | Logic: src/lib/intelligence/signals.ts (detection/scoring) + signal-store.ts (`readSignals`, dedupe by fingerprint, cooldown, optional LLM enrichment with deterministic fallback) | DB: table `intelligence_signals` (migration 024), RLS scoped to `user_id`+`workspace_id`, `unique(user_id, workspace_id, fingerprint)` enforces dedupe at the DB level | Test: intelligence-signals.test.mjs (77 assertions: dedupe on refresh, cooldown, LLM-failure fallback), intelligence-proactive.test.mjs (47 assertions: 401/400/404 contract, markSeen→200) — all PASS | **COMPLETE** | Evidence: supabase/migrations/024_intelligence_signals.sql, src/lib/intelligence/signal-store.ts:1-120, src/app/api/intelligence/signals/route.ts
- Missions (multi-step objectives) | UI: src/components/intelligence/mission-panel.tsx calls GET/POST /api/intelligence/missions and POST /api/intelligence/action for `confirmStep` | API: src/app/api/intelligence/missions/route.ts (create/status/continue/confirmStep/cancel/recompute actions), re-validates session+membership, scopes every mission to (user_id, workspace_id) | Logic: src/lib/intelligence/mission.ts (`detectMissionRequest`, `createMissionObject`, `runMissionLoop`, `applyVerifiedActionToStep` — a step is marked completed only after a verified read-back, never from LLM claim) | DB: table `intelligence_missions` (migration 025), RLS scoped to owner+active workspace | Test: intelligence-mission.test.mjs (64 assertions, full scenario: create→blocked→unblock proposed→executed+verified→next action→completed, plus workspace-level recompute) PASS | **COMPLETE** | Evidence: supabase/migrations/025_intelligence_missions.sql, src/lib/intelligence/mission.ts:781-954, src/app/api/intelligence/missions/route.ts
- Error handling & provider fallback | src/lib/intelligence/ai-provider.ts (`callAIProvider`): reads `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` from env, AbortController-based timeout (default 10s), one controlled retry on transient 5xx/network errors, invalid-JSON responses caught and treated as failure (never crash the request) | No LLM API key is configured in this sandbox's `.env.example` — behavior in this environment is deterministic-fallback-only | Test: intelligence-agent.test.mjs ("Provider invalid JSON returns null (fallback)"), intelligence-signals.test.mjs ("network failure → null (fallback)", "provider unavailable (5xx) → null (fallback)") — all PASS | **COMPLETE** for the fallback/error-handling contract; **UNVERIFIED** for actual third-party LLM call success (no live API key present, never exercised end-to-end with a real provider in this audit) | Evidence: src/lib/intelligence/ai-provider.ts:46-320
- Deterministic fallback engine | src/lib/intelligence/engine.ts (`computeInsights`, `reasonWorkspace`) used whenever the AI provider is unavailable/fails, and to compute the "attention" summary returned by /api/intelligence/query independent of the LLM | Test: intelligence-agent.test.mjs ("Fallback is honest nexus-engine", "Fallback exposes structured intentId/action risk") PASS | **COMPLETE** | Evidence: src/lib/intelligence/engine.ts:1-762
- UI mounting / route | Page src/app/(app)/app/intelligence/page.tsx fetches the workspace-scoped snapshot server-side and renders `IntelligenceView` (which composes intelligence-ask, mission-panel, proactive-signals-panel) | Not a mock/demo page — wired into the real authenticated app shell (`requireUser`, `getActiveMembership`) | **COMPLETE** | Evidence: src/app/(app)/app/intelligence/page.tsx:1-60

## Notifications
- Creation |  |  |  |  |  |  | UNVERIFIED |
- Persistence |  |  |  |  |  |  | UNVERIFIED |
- Read/unread |  |  |  |  |  |  | UNVERIFIED |
- Dismiss |  |  |  |  |  |  | UNVERIFIED |
- Navigation |  |  |  |  |  |  | UNVERIFIED |
- Real event generation |  |  |  |  |  |  | UNVERIFIED |

## Search
- Workspace search |  |  |  |  |  |  | UNVERIFIED |
- Tasks |  |  |  |  |  |  | UNVERIFIED |
- Projects |  |  |  |  |  |  | UNVERIFIED |
- Goals |  |  |  |  |  |  | UNVERIFIED |
- Activity |  |  |  |  |  |  | UNVERIFIED |
- Relevance |  |  |  |  |  |  | UNVERIFIED |
- Empty states |  |  |  |  |  |  | UNVERIFIED |

## Files
- Upload |  |  |  |  |  |  | UNVERIFIED |
- Storage |  |  |  |  |  |  | UNVERIFIED |
- Retrieval |  |  |  |  |  |  | UNVERIFIED |
- Metadata |  |  |  |  |  |  | UNVERIFIED |
- Delete |  |  |  |  |  |  | UNVERIFIED |
- Permissions |  |  |  |  |  |  | UNVERIFIED |

## Calendar
- Events |  |  |  |  |  |  | UNVERIFIED |
- Persistence |  |  |  |  |  |  | UNVERIFIED |
- Creation |  |  |  |  |  |  | UNVERIFIED |
- Modification |  |  |  |  |  |  | UNVERIFIED |
- Deletion |  |  |  |  |  |  | UNVERIFIED |
- External integration (if implemented) |  |  |  |  |  |  | UNVERIFIED |

## Integrations
- Audit every integration actually advertised by NEXUS. Mark each integration as UNVERIFIED until evidence collected.

---

Instructions / next steps

1. For each row, add evidence paths (code files, API routes, supabase table names, migration files, tests) and set Status.
2. Start with P0/P1 capabilities (Authentication, Workspace isolation, Tasks, Intelligence).
3. Use the repository to fill the "Evidence" column with file paths and test names.
4. When a capability requires external services (Supabase project, API keys) mark as UNVERIFIED and document exactly what's needed.

Suggested quick workflow:
- Inspect `package.json` and `supabase/tests` to find existing tests that map to intelligence and mutation behaviors.
- For each mutation (create/update/delete task/project/goal) execute the UI->API->DB check and record evidence.

---

Test verification (2026-09-11)

All onboarding, workspace-bootstrap, plan-limit and Intelligence test suites were executed against the current code:

- `node --import tsx supabase/tests/onboarding-rls.test.mjs` — 43 passed / 0 failed
- `node --import tsx supabase/tests/migration-logic.test.mjs` — 67 passed / 0 failed
- `node --import tsx supabase/tests/intelligence-agent.test.mjs` — 57 passed / 0 failed
- `node --import tsx supabase/tests/intelligence-agent-v2.test.mjs` — all passed
- `node --import tsx supabase/tests/intelligence-memory.test.mjs` — 115 assertions, 0 failures
- `node --import tsx supabase/tests/intelligence-signals.test.mjs` — 77 assertions, 0 failures
- `node --import tsx supabase/tests/intelligence-mission.test.mjs` — 64 assertions, 0 failures
- `node --import tsx supabase/tests/intelligence-proactive.test.mjs` — 47 assertions, 0 failures
- `node --import tsx supabase/tests/intelligence-experience.test.mjs` — all passed

These are unit/integration tests against in-memory Supabase fakes, not against a live Supabase project. End-to-end mutation against a live external Supabase instance remains UNVERIFIED until run against a real service.

Key security evidence confirmed by inspection:
- `is_active_workspace_member` / `can_manage_workspace` (security-definer helpers) in `supabase/migrations/001_nexus_base_schema.sql`.
- `assert_workspace_member` trigger in `supabase/migrations/012_enforce_workspace_membership_on_write.sql` enforcing workspace-scoped writes on `tasks`/`projects`/`goals`.
- RLS scoped reads/inserts/updates/deletes on `projects`, `tasks`, `goals`, `workspaces`, `workspace_members`, `profiles` in `supabase/migrations/001_nexus_base_schema.sql`.
- Intelligence persistence tables with per-user + active-workspace RLS: `intelligence_memory` (023), `intelligence_signals` (024), `intelligence_missions` (025).
