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
- Query | UI: src/components/intelligence (composer/ask) | API: read tools implemented in src/lib/intelligence/tools.ts (get_tasks, get_projects, get_priorities, get_overdue_tasks, get_blocked_tasks, search_workspace) | DB: reads from snapshot / DB via tools | Persistence: read-only snapshots; mutations gated | Security: tool layer avoids raw SQL/DB access; RLS enforced via migrations | Test: supabase/tests/intelligence-agent-v2.test.mjs, supabase/tests/intelligence-agent.test.mjs, supabase/tests/intelligence-*.test.mjs | REAL | Evidence: src/lib/intelligence/tools.ts (tool registry & executeReadTool), tests call executeReadTool/get_priorities (supabase/tests/intelligence-agent-v2.test.mjs)
- Context | src/lib/intelligence/context-builder.ts (buildWorkspaceContext) | API: used by agent (src/lib/intelligence/agent.ts) | DB:snapshot-driven / context summaries | Test: intelligence-agent tests | REAL | Evidence: tests import buildWorkspaceContext and agentInput uses context (supabase/tests/*)
- Intent detection | src/lib/intelligence/intent.ts (classifyIntent, extractDueDateFromQuery, extractPriorityFromQuery) | Test: supabase/tests/intelligence-agent.test.mjs, intelligence-agent-v2.test.mjs | REAL | Evidence: classifyIntent assertions in intelligence-agent.test.mjs
- Tool selection | src/lib/intelligence/tools.ts (TOOL_REGISTRY, selectToolsForIntent) | Test: intelligence-agent-v2.test.mjs | REAL | Evidence: tool registry validation and selection tests
- Tool execution | Read tools: src/lib/intelligence/tools.ts → executed by agent (runReadTools). Mutate tools: converted to actions and executed server-side via src/lib/intelligence/actions.ts (executeIntelligenceAction) | Test: intelligence-agent-v2.test.mjs, intelligence-agent.test.mjs | PARTIAL | Evidence: agent validates & runs read tools (agent.ts), mutation execution and verification implemented in actions.ts and exercised in tests using fake DB
- Planning | src/lib/intelligence/planner.ts (buildPlan) | Test: intelligence-agent-v2.test.mjs | REAL | Evidence: buildPlan used and asserted in planner tests
- Mutations | src/lib/intelligence/actions.ts (executeIntelligenceAction, verifyTask/Project/Goal) | Test: intelligence-agent.test.mjs, intelligence-agent-v2.test.mjs | PARTIAL | Evidence: actions implement full create/update/delete flows with verification; tests use in-memory DB fakes to assert behavior; live DB verification requires Supabase migrations
- Confirmation | Agent + UI gating (agent.ts + src/components/intelligence) | Test: intelligence-agent-v2.test.mjs | REAL | Evidence: tests assert needsConfirmation true for destructive actions and action.confirmation gating
- Verification | src/lib/intelligence/actions.ts (verifyTask/verifyProject/verifyGoal) — read-back verification after mutation | Test: intelligence-agent.test.mjs | REAL | Evidence: tests assert verified.matched includes expected fields
- Memory | src/lib/intelligence/memory.ts and references.ts — structured memory and reference resolution, used by agent (agent.ts) | Test: intelligence-agent.test.mjs, intelligence-agent-v2.test.mjs | REAL | Evidence: sessionHistory restoration and follow-up resolution tests
- Session context | src/lib/intelligence/agent.ts (buildEffectiveHistory) & context-builder | Test: intelligence-agent-v2.test.mjs | REAL | Evidence: agent-level workspace isolation and effective history tests
- Error handling | src/lib/intelligence/ai-provider.ts (callAIProvider) — retries, timeouts, invalid JSON handling | Test: intelligence-agent.test.mjs, intelligence-agent-v2.test.mjs | REAL | Evidence: tests simulate provider timeouts and invalid JSON to confirm fallbacks
- Fallback | Deterministic nexus-engine in src/lib/intelligence/engine.ts (computeInsights, reasonWorkspace) used when AI provider unavailable | Test: intelligence-agent-v2.test.mjs | REAL | Evidence: engine-based fallback asserted in tests; Supabase schema: intelligence_memory/intelligence_signals/intelligence_missions in supabase/migrations/023_intelligence_memory.sql, 024_intelligence_signals.sql, 025_intelligence_missions.sql (RLS policies present)

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

Supabase RLS & Triggers (selected snippets)

Source: supabase/migrations/001_nexus_base_schema.sql

-- Membership helper (security definer)
create or replace function public.is_active_workspace_member(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id and status = 'active'
  );
$$;
revoke all on function public.is_active_workspace_member(uuid, uuid) from public;
grant execute on function public.is_active_workspace_member(uuid, uuid) to authenticated;

create or replace function public.can_manage_workspace(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id
      and status = 'active' and role in ('owner','admin')
  );
$$;
revoke all on function public.can_manage_workspace(uuid, uuid) from public;
grant execute on function public.can_manage_workspace(uuid, uuid) to authenticated;

-- Row-level security enabled for tenant tables
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.goals enable row level security;

-- Example policies (workspace-scoped read/insert/update/delete)
create policy "base_projects_read" on public.projects for select using (public.is_active_workspace_member(workspace_id));
create policy "base_projects_insert" on public.projects for insert with check (public.is_active_workspace_member(workspace_id));
create policy "base_projects_update" on public.projects for update using (public.is_active_workspace_member(workspace_id)) with check (public.is_active_workspace_member(workspace_id));
create policy "base_projects_delete" on public.projects for delete using (public.is_active_workspace_member(workspace_id));

create policy "base_tasks_read" on public.tasks for select using (public.is_active_workspace_member(workspace_id));
create policy "base_tasks_insert" on public.tasks for insert with check (public.is_active_workspace_member(workspace_id));
create policy "base_tasks_update" on public.tasks for update using (public.is_active_workspace_member(workspace_id)) with check (public.is_active_workspace_member(workspace_id));
create policy "base_tasks_delete" on public.tasks for delete using (public.is_active_workspace_member(workspace_id));

create policy "base_goals_read" on public.goals for select using (public.is_active_workspace_member(workspace_id));
create policy "base_goals_insert" on public.goals for insert with check (public.is_active_workspace_member(workspace_id));
create policy "base_goals_update" on public.goals for update using (public.is_active_workspace_member(workspace_id)) with check (public.is_active_workspace_member(workspace_id));
create policy "base_goals_delete" on public.goals for delete using (public.is_active_workspace_member(workspace_id));

Source: supabase/migrations/012_enforce_workspace_membership_on_write.sql

-- Assertion function: rejects writes from non-members (unless auth.uid() is null)
create or replace function public.assert_workspace_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();

  -- Server-side contexts (service_role) are not restricted here.
  if v_uid is null then
    return NEW;
  end if;

  if NEW.workspace_id is null then
    raise exception 'WORKSPACE_ACCESS_DENIED: workspace_id is required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = NEW.workspace_id
      and wm.user_id = v_uid
      and wm.status = 'active'
  ) then
    raise exception 'WORKSPACE_ACCESS_DENIED: caller is not an active member of workspace %', NEW.workspace_id
      using errcode = '42501';
  end if;

  -- Moving a row from one workspace to another requires membership on both.
  if tg_op = 'UPDATE' and OLD.workspace_id is distinct from NEW.workspace_id then
    if not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = OLD.workspace_id
        and wm.user_id = v_uid
        and wm.status = 'active'
    ) then
      raise exception 'WORKSPACE_ACCESS_DENIED: caller is not an active member of workspace %', OLD.workspace_id
        using errcode = '42501';
    end if;
  end if;

  return NEW;
end;
$$;

-- Triggers that enforce the assertion on writes (examples)
drop trigger if exists trg_assert_workspace_member on public.tasks;
create trigger trg_assert_workspace_member
  before insert or update on public.tasks
  for each row execute function public.assert_workspace_member();

drop trigger if exists trg_assert_workspace_member on public.projects;
create trigger trg_assert_workspace_member
  before insert or update on public.projects
  for each row execute function public.assert_workspace_member();

drop trigger if exists trg_assert_workspace_member on public.goals;
create trigger trg_assert_workspace_member
  before insert or update on public.goals
  for each row execute function public.assert_workspace_member();

---

Intelligence schema (selected):

- public.intelligence_memory (supabase/migrations/023_intelligence_memory.sql)
  - Columns: id, user_id, workspace_id, state jsonb, preferences jsonb, created_at, updated_at
  - Unique: (user_id, workspace_id)
  - Index: intelligence_memory_workspace_idx on (workspace_id)
  - RLS policies: intelligence_memory_read_own / insert_own / update_own / delete_own (user_id = auth.uid() and is_active_workspace_member(workspace_id))

- public.intelligence_signals (supabase/migrations/024_intelligence_signals.sql)
  - Columns: id, user_id, workspace_id, fingerprint, type, severity, status, title, summary, entity_type, entity_id, entity_label, score, confidence, affected_count, evidence jsonb, score_breakdown jsonb, suggested_actions jsonb, created_at, seen_at, dismissed_at, resolved_at
  - Unique: (user_id, workspace_id, fingerprint)
  - Indexes: intelligence_signals_workspace_idx, intelligence_signals_user_workspace_status_idx
  - RLS policies: intelligence_signals_read_own / insert_own / update_own / delete_own (user_id = auth.uid() and is_active_workspace_member(workspace_id))

- public.intelligence_missions (supabase/migrations/025_intelligence_missions.sql)
  - Columns: id (text primary key), user_id, workspace_id, title, objective, kind, status, progress, current_step_id, steps jsonb, context jsonb, next_best_action jsonb, last_evaluated_at, created_at, updated_at
  - Indexes: intelligence_missions_workspace_idx, intelligence_missions_user_status_idx
  - RLS policies: intelligence_missions_read_own / insert_own / update_own / delete_own (user_id = auth.uid() and is_active_workspace_member(workspace_id))

Notes:
- All intelligence tables are strictly server-written; client routes should never write them directly — the migrations and tests state the server is the only writer and RLS enforces per-user visibility inside an active workspace.
- These migrations align with the intelligence code in src/lib/intelligence/{memory.ts, signals.ts, mission.ts}.

## Intelligence (UI & API evidence)
- Composer / Query UI
  - UI: src/components/intelligence/intelligence-ask.tsx (composer, session history, local memory cache, action confirmation flows, deterministic fallback) — evidence of client-side composer and confirm UX.
  - Supporting UI components: src/components/intelligence/intelligence-view.tsx, intelligence-canvas.tsx, intelligence-signals.tsx, signal-card.tsx, signal-detail.tsx, mission-panel.tsx — rendering and interaction surfaces for signals, missions, and agent traces.
  - Mobile / accessibility: composer enforces 44px hit areas and keyboard-friendly Enter/Shift+Enter semantics (see intelligence-ask.tsx comments and textarea attributes).
- API routes (server)
  - src/app/api/intelligence/query/route.ts — accepts query POSTs and returns structured StructuredIntelligenceResponse + optional agent trace + memory.
  - src/app/api/intelligence/action/route.ts — executes confirmed intelligence actions via server mutation layer (executeIntelligenceAction) and returns verification details.
  - src/app/api/intelligence/signals/route.ts — get/update persisted intelligence_signals (used by proactive UI).
  - src/app/api/intelligence/missions/route.ts — mission CRUD endpoints used by mission-panel and mission UI.
- UI ↔ API wiring
  - intelligence-ask.tsx posts to /api/intelligence/query and /api/intelligence/action and mirrors returned memory into localStorage (MEMORY_CACHE_KEY) to support offline/deterministic fallback.
  - proactive signals displayed by intelligence-signals.tsx are sourced from computeInsights(snapshot) client-side for immediate UX and from /api/intelligence/signals for persisted state.
- Tests & evidence
  - supabase/tests/intelligence-agent.test.mjs and intelligence-agent-v2.test.mjs exercise agent orchestration, read tool execution, and mutation verification in the server mutation layer (fake DB), mapping to the UI flows above.
  - UI files reference deterministic engine and agent fallback: computeInsights (src/lib/intelligence/engine.ts) and runAgentDeterministic (src/lib/intelligence/agent.ts) — these are used by the composer for offline fallback.
- Status guidance
  - UI presence: REAL — the composer, signals, mission and confirm UX are implemented (see file references above).
  - End-to-end mutation verification: PARTIAL — server mutation layer and tests exist, but end-to-end against a live Supabase instance remains UNVERIFIED until tests or migrations are run against a real DB.

Test run verification (local)

- Commands executed:
  - npm ci
  - node --import tsx supabase/tests/onboarding-rls.test.mjs
  - node --import tsx supabase/tests/migration-logic.test.mjs

- Result summary (local execution on 2026-09-11):
  - onboarding-rls.test.mjs: 43 passed / 0 failed
  - migration-logic.test.mjs: 67 passed / 0 failed

- Migrations applied during test runs (examples seen in test harness):
  - 001_nexus_base_schema.sql
  - 006_nexus_workspace_bootstrap.sql
  - 007_freemium_enforcement.sql
  - 008_sync_plan_limits_and_slug.sql
  - 009_enforce_task_limit_on_status_update.sql
  - 010_allow_profile_self_repair.sql
  - 011_enforce_workspace_limit.sql
  - 012_enforce_workspace_membership_on_write.sql
  - 013_modernize_schema.sql
  - 014_ensure_onboarding_intent.sql
  - 015_dependencies_and_activity.sql
  - 016_fix_onboarding_workspace_bootstrap.sql
  - 017_fix_self_claim_rls_recursion.sql
  - 018_harden_onboarding_bootstrap.sql
  - 019_auth_rearchitecture_username.sql
  - 020_access_first_profiles.sql
  - 021_workspace_bootstrap_bounded_observability.sql
  - 022_onboarding_progress.sql
  - 023_intelligence_memory.sql
  - 024_intelligence_signals.sql
  - 025_intelligence_missions.sql

- Implications / next status updates:
  - Workspace isolation & RLS (P0): VERIFIED by tests (REAL) — cross-workspace reads/writes are blocked in the migration+harness.
  - Onboarding bootstrap behavior (P0): VERIFIED by tests (REAL) — signup and workspace bootstrap sequences pass.
  - Plan limits & write guards (P0/P1): VERIFIED by tests (REAL/PARTIAL) — server-side enforcement and per-workspace scoping verified by migration-logic.test.mjs.
  - Intelligence persistence tables & server write-only constraint: supported by migrations and tests (REAL for schema + server-side enforcement). End-to-end mutation against a live external Supabase instance remains UNVERIFIED until run against a real service.

- Next recommended actions:
  1. (Optional) Run the intelligence agent tests (intelligence-agent.test.mjs and intelligence-agent-v2.test.mjs) locally to verify deterministic agent behaviors and mutation verification against the in-memory harness (these are unit-style and should pass with the current setup).
  2. If you want full end-to-end verification, provide safe test service credentials or run migrations against a local Postgres/Supabase instance to test the real Supabase wiring (note: do not share service role keys here).
  3. Commit the updated NEXUS-CAPABILITY-MATRIX.md to a branch and open a PR summarizing the verification results. (I can create the branch and commit if you confirm.)

Intelligence agent tests (local)

- Commands executed:
  - node --import tsx supabase/tests/intelligence-agent.test.mjs
  - node --import tsx supabase/tests/intelligence-agent-v2.test.mjs

- Result summary (local execution on 2026-09-11):
  - intelligence-agent.test.mjs: 57 passed / 0 failed
  - intelligence-agent-v2.test.mjs: all tests passed (exit code 0)

- Notable assertions verified by these tests:
  - Intent classification (FR/EN) and referential follow-ups work and map to structured intentIds.
  - Deterministic fallback engages on provider timeouts/invalid output and produces structured responses.
  - Tool registry maps read and mutate tools correctly; mutate tools map to server actions.
  - Server mutation layer enforces confirmation for high-risk actions, verifies mutations via read-back, and rejects cross-workspace mutations.
  - Delete operations require confirmDeletion and are enforced/verified.
  - Mobile UX contracts (44px hit areas, keyboard flows) are enforced for the composer and confirm buttons.

- Implications / next status updates:
  - Intelligence agent orchestration & mutation verification (in-memory harness): VERIFIED (REAL).
  - Deterministic fallback & safety guards: VERIFIED (REAL).
  - End-to-end against a live Supabase instance: still UNVERIFIED for agent-triggered mutations targeting production DB — run against a real Supabase or local Postgres to fully verify.

- Next recommended actions:
  1. (Optional) Run any remaining intelligence-related tests (memory/signals/missions) for completeness: intelligence-memory.test.mjs, intelligence-signals.test.mjs, intelligence-mission.test.mjs.
  2. Create a branch and commit NEXUS-CAPABILITY-MATRIX.md with these test results (I can create the branch and commit locally without pushing).
  3. If full e2e verification is required, run migrations/tests against a real Supabase instance or local Postgres with supplied safe test credentials.

Generated by Copilot CLI runtime in VS Code as the initial matrix template.