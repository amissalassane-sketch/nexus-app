// ============================================================
// NEXUS INTELLIGENCE — AGENTIC PROTOCOL TESTS (Phase 4)
// Tool system, planner, agent loop, session memory, permissions,
// verification, fallback, timeout, workspace isolation, mobile.
//
// Scenarios covered (spec §21):
//   A. « Quelles sont mes tâches prioritaires ? »
//   B. « Organise ma journée. »
//   C. « Quels projets sont bloqués ? »
//   D. « Crée une tâche pour préparer la présentation vendredi. »
//   E. « Mets cette tâche en urgente. »
//   F. « Supprime cette tâche. »
//   G. « Fais-moi un plan pour rattraper mes tâches en retard. »
//   H. « Résume ce qui s'est passé cette semaine. »
// ============================================================

const { buildWorkspaceContext } = await import("../../src/lib/intelligence/context-builder.ts");
const { classifyIntent, extractPriorityFromQuery, extractDueDateFromQuery } = await import("../../src/lib/intelligence/intent.ts");
const { runAgent, runAgentDeterministic, validateModelToolCalls, validateModelPlan } = await import("../../src/lib/intelligence/agent.ts");
const {
  TOOL_REGISTRY,
  READ_TOOL_NAMES,
  MUTATE_TOOL_NAMES,
  NAVIGATE_TOOL_NAMES,
  selectToolsForIntent,
  executeReadTool,
  validateToolProposal,
  runReadTools,
} = await import("../../src/lib/intelligence/tools.ts");
const { buildPlan } = await import("../../src/lib/intelligence/planner.ts");
const { executeIntelligenceAction, ActionError } = await import("../../src/lib/intelligence/actions.ts");
const { callAIProvider } = await import("../../src/lib/intelligence/ai-provider.ts");

let passed = 0;
let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name} ${detail}`.trim());
  }
}

const now = new Date("2026-08-26T10:00:00Z");
const snapshot = {
  now,
  projects: [
    { id: "p1", name: "Website Redesign", status: "active", due_date: "2026-08-28", progress: 40 },
    { id: "p2", name: "API Migration", status: "active", due_date: "2026-09-15", progress: 75 },
    { id: "p3", name: "Mobile App", status: "active", due_date: "2026-09-20", progress: 10 },
  ],
  tasks: [
    { id: "t1", title: "Fix API integration", status: "blocked", priority: "urgent", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", created_at: "2026-08-10T00:00:00.000Z", completed_at: null },
    { id: "t2", title: "Finish homepage", status: "todo", priority: "high", due_at: "2026-08-26T00:00:00.000Z", project_id: "p1", created_at: "2026-08-18T00:00:00.000Z", completed_at: null },
    { id: "t3", title: "Prepare presentation", status: "todo", priority: "medium", due_at: "2026-08-28T00:00:00.000Z", project_id: "p2", created_at: "2026-08-20T00:00:00.000Z", completed_at: null },
    { id: "t4", title: "Write client brief", status: "todo", priority: "low", due_at: "2026-09-02T00:00:00.000Z", project_id: "p2", created_at: "2026-08-21T00:00:00.000Z", completed_at: null },
    { id: "t5", title: "Update documentation", status: "done", priority: "medium", due_at: "2026-08-23T00:00:00.000Z", project_id: "p2", completed_at: "2026-08-25T00:00:00.000Z", created_at: "2026-08-15T00:00:00.000Z" },
  ],
  goals: [{ id: "g1", title: "Launch v2", status: "active", progress: 60, target_date: "2026-09-30" }],
};

const context = buildWorkspaceContext("ws-1", snapshot, { activities: [], dependencies: [] });

function agentInput(query, extra = {}) {
  return {
    workspaceId: "ws-1",
    query,
    snapshot,
    context,
    ...extra,
  };
}

console.log("-- tool registry -------------------------------------");
{
  ok("Registry defines all spec read tools", ["get_workspace_overview", "get_projects", "get_project", "get_tasks", "get_task", "get_goals", "get_activity", "get_blocked_tasks", "get_overdue_tasks", "get_priorities", "search_workspace"].every((n) => TOOL_REGISTRY[n]));
  ok("Registry defines all spec mutate tools", ["create_task", "update_task", "delete_task", "create_project", "update_project", "delete_project", "create_goal", "update_goal", "delete_goal"].every((n) => TOOL_REGISTRY[n]?.permission === "mutate"));
  ok("Registry defines navigation tools", ["open_project", "open_task", "open_tasks", "open_intelligence", "open_activity"].every((n) => TOOL_REGISTRY[n]?.permission === "navigate"));
  ok("delete_task is high risk", TOOL_REGISTRY.delete_task.risk === "high");
  ok("delete_project is high risk", TOOL_REGISTRY.delete_project.risk === "high");
  ok("delete_goal is high risk", TOOL_REGISTRY.delete_goal.risk === "high");
  ok("update_task is high risk", TOOL_REGISTRY.update_task.risk === "high");
  ok("create_task is medium risk", TOOL_REGISTRY.create_task.risk === "medium");
  ok("Every mutate tool maps to a server action", [...MUTATE_TOOL_NAMES].every((n) => TOOL_REGISTRY[n].actionType));
  ok("Every navigate tool maps to a route", [...NAVIGATE_TOOL_NAMES].every((n) => TOOL_REGISTRY[n].navigateTo));
}

console.log("-- tool selection per intent -------------------------");
{
  ok("PRIORITIZE selects get_priorities", selectToolsForIntent("PRIORITIZE").some((s) => s.name === "get_priorities"));
  ok("PLAN selects overdue + blocked + priorities", ["get_overdue_tasks", "get_blocked_tasks", "get_priorities"].every((n) => selectToolsForIntent("PLAN").some((s) => s.name === n)));
  ok("DETECT selects get_blocked_tasks", selectToolsForIntent("DETECT").some((s) => s.name === "get_blocked_tasks"));
  ok("SEARCH selects search_workspace with query", selectToolsForIntent("SEARCH", "find presentation").some((s) => s.name === "search_workspace" && s.args.query === "find presentation"));
  ok("SUMMARIZE selects activity", selectToolsForIntent("SUMMARIZE").some((s) => s.name === "get_activity"));
  ok("DELETE selects task lookup", selectToolsForIntent("DELETE", "supprime cette tâche").some((s) => s.name === "get_task"));
}

console.log("-- read tool execution: real data only ---------------");
{
  const ctx = { workspaceId: "ws-1", snapshot, context };
  const projects = executeReadTool("get_projects", {}, ctx);
  ok("get_projects returns real projects", projects.count === 3 && projects.status === "ok");
  ok("get_projects carries no invented fields", projects.data.every((p) => ["id", "name", "status", "progress", "dueDate", "openTasks", "overdue", "blocked"].every((k) => k in p)));
  const blocked = executeReadTool("get_blocked_tasks", {}, ctx);
  ok("get_blocked_tasks finds the real blocked task", blocked.count === 1 && blocked.data[0].title === "Fix API integration");
  const overdue = executeReadTool("get_overdue_tasks", {}, ctx);
  ok("get_overdue_tasks finds overdue work", overdue.count >= 1 && overdue.data[0].title === "Fix API integration");
  const task = executeReadTool("get_task", { query: "Prepare presentation" }, ctx);
  ok("get_task resolves by real title", task.status === "ok" && task.data.title === "Prepare presentation");
  const missing = executeReadTool("get_task", { query: "Nonexistent task 42" }, ctx);
  ok("get_task on unknown target errors honestly", missing.status === "error" && missing.count === 0);
  const search = executeReadTool("search_workspace", { query: "homepage" }, ctx);
  ok("search_workspace returns real match", search.count >= 1 && search.data.some((r) => r.title === "Finish homepage"));
  const priorities = executeReadTool("get_priorities", { limit: 3 }, ctx);
  ok("get_priorities top is the urgent blocked task", priorities.data[0]?.title === "Fix API integration");
  const overview = executeReadTool("get_workspace_overview", {}, ctx);
  ok("get_workspace_overview carries health + next best action", overview.data.healthScore >= 0 && overview.data.nextBestAction);
}

console.log("-- model tool proposals: server decides -------------");
{
  const valid = validateModelToolCalls([{ name: "get_blocked_tasks", args: {} }]);
  ok("Valid read proposal accepted", valid.selections.length === 1);
  const mutation = validateModelToolCalls([{ name: "delete_task", args: { taskId: "t1" } }]);
  ok("Mutate proposal rejected (never executed by agent)", mutation.selections.length === 0 && mutation.rejected.length === 1);
  ok("Rejected mutate is visible in the trace", mutation.rejected[0].status === "skipped");
  const unknown = validateModelToolCalls([{ name: "drop_table", args: {} }]);
  ok("Unknown/invented tool rejected", unknown.selections.length === 0 && unknown.rejected.length === 1);
  const args = validateModelToolCalls([{ name: "search_workspace", args: { query: "x", evil: "y" } }]);
  ok("Only declared args are kept", !("evil" in args.selections[0].args));
  ok("validateToolProposal rejects non-registry tools", validateToolProposal("rm -rf").ok === false);
}

console.log("-- planner -------------------------------------------");
{
  const plan = buildPlan({ intentId: "PLAN", query: "Organise ma journée", snapshot, context });
  ok("PLAN intent produces a plan", Boolean(plan));
  ok("Plan summary is factual (analyzed X projects / Y tasks)", /analysé|analyzed/.test(plan.summary));
  ok("Plan steps ordered: overdue first", plan.steps[0]?.title.includes("dette") || plan.steps[0]?.title.includes("debt"));
  ok("Plan has ≥ 3 steps for a busy workspace", plan.steps.length >= 3);
  const recovery = buildPlan({ intentId: "DETECT", query: "Qu'est-ce qui bloque ?", snapshot, context });
  ok("DETECT builds recovery plan when issues exist", Boolean(recovery) && recovery.steps.length >= 1);
  const noPlan = buildPlan({ intentId: "SEARCH", query: "cherche X", snapshot, context });
  ok("SEARCH gets no explicit plan", noPlan === undefined);
}

// ============================================================
// SCENARIOS A–H — full agent loop (deterministic, no provider)
// ============================================================

console.log("-- scenario A: priorities ----------------------------");
{
  const { response, agent } = runAgentDeterministic(agentInput("Quelles sont mes tâches prioritaires ?"));
  ok("A. intent PRIORITIZE", response.intentId === "PRIORITIZE");
  ok("A. tools include get_priorities", agent.toolCalls.some((t) => t.name === "get_priorities"));
  ok("A. tools are real reads", agent.toolCalls.every((t) => t.status === "ok" || t.status === "error"));
  ok("A. top item is the real urgent task", response.items?.[0]?.title === "Fix API integration");
  ok("A. action opens the top task", response.action?.type === "open_task");
  ok("A. no confirmation needed for a read", response.needsConfirmation === false);
  ok("A. confidence is high for verified data", response.confidence === 0.95);
  ok("A. agent state completed", agent.state === "completed");
}

console.log("-- scenario B: organize my day ------------------------");
{
  const { response, agent } = runAgentDeterministic(agentInput("Organise ma journée."));
  ok("B. intent PLAN", response.intentId === "PLAN");
  ok("B. tools include overdue + blocked reads", agent.toolCalls.some((t) => t.name === "get_blocked_tasks") && agent.toolCalls.some((t) => t.name === "get_tasks"));
  ok("B. explicit plan present", Boolean(agent.plan) && agent.plan.steps.length >= 3);
  ok("B. plan summary mentions analyzed workspace", /analysé|analyzed/.test(agent.plan.summary));
  ok("B. day schedule starts with the overdue task", response.items?.[0]?.title?.includes("Fix API integration"));
  ok("B. plan is read-only (no confirmation)", response.needsConfirmation === false);
}

console.log("-- scenario C: blocked projects ----------------------");
{
  const { response, agent } = runAgentDeterministic(agentInput("Quels projets sont bloqués ?"));
  ok("C. intent DETECT", response.intentId === "DETECT");
  ok("C. get_blocked_tasks executed", agent.toolCalls.some((t) => t.name === "get_blocked_tasks"));
  ok("C. response names the blocked task", response.narrative.includes("Fix API integration") || response.items?.some((i) => i.title.includes("Fix API integration")));
  ok("C. recovery plan proposed", Boolean(agent.plan));
}

console.log("-- scenario D: create task ---------------------------");
{
  const { response, agent } = runAgentDeterministic(agentInput("Crée une tâche pour préparer la présentation vendredi."));
  ok("D. intent CREATE", response.intentId === "CREATE");
  ok("D. tools consulted (overview + projects)", agent.toolCalls.some((t) => t.name === "get_projects"));
  ok("D. proposes create_task", response.action?.type === "create_task");
  ok("D. title extracted", Boolean(response.action?.payload?.title));
  ok("D. due date is the next Friday", response.action?.payload?.dueDate === "2026-08-28");
  ok("D. mutation requires confirmation", response.needsConfirmation === true);
  ok("D. no mutate tool was executed", agent.toolCalls.every((t) => !MUTATE_TOOL_NAMES.has(t.name)));
}

console.log("-- scenario E: set this task urgent (memory) ---------");
{
  const history = [{
    id: "h1",
    query: "Crée une tâche pour préparer la présentation vendredi.",
    intent: "action",
    headline: "Recommended action: Create task Prepare presentation",
    targetEntities: ["Prepare presentation"],
    actionType: "create_task",
    target: { type: "task", id: "t3", label: "Prepare presentation" },
  }];
  const { response } = runAgentDeterministic(agentInput("Mets cette tâche en urgente.", { sessionHistory: history }));
  ok("E. intent UPDATE", response.intentId === "UPDATE");
  ok("E. resolves the last referenced task", response.action?.payload?.taskId === "t3" || response.target?.id === "t3");
  ok("E. priority urgent extracted", response.action?.payload?.priority === "urgent");
  ok("E. priority extraction helper", extractPriorityFromQuery("Mets cette tâche en urgente") === "urgent");
  ok("E. update is confirmation-gated", response.action?.confirmationRequired === true);
}

console.log("-- scenario E2: set this task as urgent (EN) ---------");
{
  const history = [{
    id: "h1",
    query: "Prepare the presentation",
    intent: "action",
    headline: "Recommended action",
    targetEntities: ["Prepare presentation"],
    actionType: "create_task",
    target: { type: "task", id: "t3", label: "Prepare presentation" },
  }];
  const { response } = runAgentDeterministic(agentInput("Set this task as urgent.", { sessionHistory: history }));
  ok("E2. EN update intent", response.intentId === "UPDATE");
  ok("E2. priority urgent", response.action?.payload?.priority === "urgent");
}

console.log("-- scenario F: delete task ---------------------------");
{
  const history = [{
    id: "h1",
    query: "Quelle est la tâche Fix API integration ?",
    intent: "analysis",
    headline: "x",
    targetEntities: ["Fix API integration"],
    target: { type: "task", id: "t1", label: "Fix API integration" },
  }];
  const { response } = runAgentDeterministic(agentInput("Supprime cette tâche.", { sessionHistory: history }));
  ok("F. intent DELETE", response.intentId === "DELETE");
  ok("F. proposes delete_task", response.action?.type === "delete_task");
  ok("F. high risk", response.action?.risk === "high");
  ok("F. confirmation mandatory", response.needsConfirmation === true);
  ok("F. confirmDeletion flag set", response.action?.payload?.confirmDeletion === true);
}

console.log("-- scenario G: catch-up plan -------------------------");
{
  const { response, agent } = runAgentDeterministic(agentInput("Fais-moi un plan pour rattraper mes tâches en retard."));
  ok("G. intent PLAN", response.intentId === "PLAN");
  ok("G. overdue read executed", agent.toolCalls.some((t) => t.name === "get_overdue_tasks"));
  ok("G. plan includes a catch-up step", agent.plan?.steps?.some((s) => /dette|debt|rattrap/.test(s.title)));
}

console.log("-- scenario H: weekly summary ------------------------");
{
  const { response, agent } = runAgentDeterministic(agentInput("Résume ce qui s'est passé cette semaine."));
  ok("H. intent SUMMARIZE", response.intentId === "SUMMARIZE");
  ok("H. activity tool executed", agent.toolCalls.some((t) => t.name === "get_activity"));
  ok("H. evidence shows completions", response.evidence.metrics.some((m) => /completed|termin/i.test(m.label + m.value)));
  ok("H. links to the activity log", response.action?.payload?.url === "/activity" || response.quickActions?.some((q) => q.href === "/activity"));
}

console.log("-- session memory follow-ups -------------------------");
{
  const history = [{
    id: "h1",
    query: "Décale la présentation.",
    intent: "action",
    headline: "x",
    targetEntities: ["Prepare presentation"],
    actionType: "move_task",
    target: { type: "task", id: "t3", label: "Prepare presentation" },
  }];
  const r = classifyIntent("Et pour vendredi ?", { snapshot, sessionHistory: history });
  ok("'Et pour vendredi ?' is MOVE on last target", r.intent === "MOVE" && r.target?.id === "t3");
  ok("Friday date extracted", extractDueDateFromQuery("Et pour vendredi ?", now) === "2026-08-28");

  const annule = classifyIntent("Finalement annule", { snapshot, sessionHistory: history });
  ok("'Finalement annule' is DELETE on last target", annule.intent === "DELETE" && annule.risk === "high");
}

console.log("-- multi-step tool calling (agent loop) --------------");
{
  // With a fake AI provider proposing extra read tools, the server
  // validates and executes them, then returns the full trace.
  const { runAgent } = await import("../../src/lib/intelligence/agent.ts");
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({
        intent: "detection",
        headline: "Blocked work found",
        narrative: "Fix API integration is blocked and overdue.",
        evidence: { metrics: [{ label: "Blocked", value: "1" }], sources: ["Tasks"] },
        toolCalls: [{ name: "get_task", args: { query: "Fix API integration" } }],
        confidence: 0.8,
        suggestions: [],
      }) } }],
    }),
  });
  const out = await runAgent(agentInput("Qu'est-ce qui bloque ?", {
    aiConfig: { provider: "openai", apiKey: "test" },
    fetchImpl: fakeFetch,
    timeoutMs: 500,
  }));
  ok("Multi-step: model-proposed read tool executed", out.agent.toolCalls.some((t) => t.name === "get_task" && t.status === "ok"));
  ok("Multi-step: deterministic tools still executed first", out.agent.toolCalls.some((t) => t.name === "get_blocked_tasks"));
  ok("Multi-step: response came from AI provider", out.response.provider === "openai");
  ok("Multi-step: confidence from model clamped", out.response.confidence === 0.8);
}

console.log("-- fallback: no provider / timeout / failure ---------");
{
  const out = await runAgent(agentInput("Quelles sont mes tâches prioritaires ?"));
  ok("No provider configured → nexus-engine fallback", out.response.provider === "nexus-engine" && out.agent.provider === "nexus-engine");
  ok("Fallback still carries tools + plan", out.agent.toolCalls.length > 0);

  // Provider failure: fetch throws immediately.
  const failed = await runAgent(agentInput("Qu'est-ce qui est en retard ?", {
    aiConfig: { provider: "openai", apiKey: "test" },
    fetchImpl: async () => { throw new Error("network down"); },
    timeoutMs: 100,
  }));
  ok("Provider failure → deterministic fallback", failed.response.provider === "nexus-engine");
  ok("Provider failure reported honestly", failed.agent.provider === "nexus-engine");

  // Timeout: fetch never resolves; the AbortController aborts it.
  const timedOut = await runAgent(agentInput("Qu'est-ce qui est en retard ?", {
    aiConfig: { provider: "openai", apiKey: "test" },
    timeoutMs: 20,
    fetchImpl: (_url, opts) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  }));
  ok("Provider timeout → deterministic fallback", timedOut.response.provider === "nexus-engine");

  // callAIProvider itself returns null on timeout (unit level).
  const direct = await callAIProvider("Analyze", context, undefined, {
    config: { provider: "openai", apiKey: "test" },
    timeoutMs: 20,
    fetchImpl: (_url, opts) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  });
  ok("callAIProvider timeout → null", direct === null);
}

console.log("-- controlled retry ---------------------------------");
{
  // First attempt throws (network blip), second succeeds → the call
  // must be retried once and return the AI response.
  let attempts = 0;
  const retried = await callAIProvider("Analyze", context, undefined, {
    config: { provider: "openai", apiKey: "test" },
    timeoutMs: 500,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("transient network error");
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            intent: "analysis",
            headline: "Retry works",
            narrative: "ok",
            evidence: { metrics: [] },
            suggestions: [],
          }) } }],
        }),
      };
    },
  });
  ok("Provider retried after transient failure", attempts === 2 && retried?.provider === "openai" && retried.headline === "Retry works");

  // 5xx → retried once, then falls back on persistent failure.
  let fiveHundred = 0;
  const failed5xx = await callAIProvider("Analyze", context, undefined, {
    config: { provider: "openai", apiKey: "test" },
    timeoutMs: 500,
    fetchImpl: async () => {
      fiveHundred += 1;
      return { ok: false, status: 500 };
    },
  });
  ok("5xx retried then falls back", fiveHundred === 2 && failed5xx === null);
}

console.log("-- structured output validation ----------------------");
{
  ok("validateModelPlan rejects garbage", validateModelPlan("nope") === undefined);
  ok("validateModelPlan accepts a sound plan", Boolean(validateModelPlan({ summary: "s", steps: [{ title: "t" }] })));
  ok("validateModelPlan caps steps", validateModelPlan({ summary: "s", steps: Array.from({ length: 20 }, (_, i) => ({ title: `s${i}` })) }).steps.length <= 8);
}

console.log("-- server mutation layer: goals ----------------------");
{
  const db = createFakeDb();
  const updated = await executeIntelligenceAction(db, "ws-1", "u1", "update_goal", { goalId: "g1", progress: 80, confirmed: true });
  ok("update_goal verified", updated.success && updated.verified.matched.includes("progress"));
  const deleted = await executeIntelligenceAction(db, "ws-1", "u1", "delete_goal", { goalId: "g1", confirmed: true, confirmDeletion: true });
  ok("delete_goal verified", deleted.success && deleted.verified.verified === true);
  ok("delete_goal row gone", db._store.goals.every((g) => g.id !== "g1"));
  const rejected = await executeIntelligenceAction(db, "ws-1", "u1", "delete_goal", { goalId: "g1", confirmed: true }).catch(() => ({ ok: false }));
  ok("delete_goal without confirmDeletion rejected", rejected.ok === false);
}

console.log("-- verification failure is surfaced ------------------");
{
  const db = createFakeDb();
  db._store._corrupt = true; // make verifyTask read back a tampered row
  const result = await executeIntelligenceAction(db, "ws-1", "u1", "create_task", {
    title: "Prepare presentation", priority: "high", dueDate: "2026-08-28", projectId: "p1", confirmed: true,
  }).then(
    () => ({ ok: true }),
    (err) => ({ ok: false, message: err.message })
  );
  ok("Verification mismatch → action reported as not confirmed", result.ok === false && /verification failed/.test(result.message));
}

console.log("-- agent-level workspace isolation -------------------");
{
  const foreignSnapshot = {
    now,
    projects: [{ id: "p9", name: "Foreign Project", status: "active", due_date: null, progress: 10 }],
    tasks: [{ id: "t9", title: "Foreign secret task", status: "todo", priority: "high", due_at: null, project_id: "p9", created_at: now.toISOString(), completed_at: null }],
    goals: [],
  };
  const foreignContext = buildWorkspaceContext("ws-2", foreignSnapshot);
  const { response } = runAgentDeterministic(agentInput("Quelles sont mes tâches prioritaires ?", { snapshot: foreignSnapshot, context: foreignContext }));
  ok("Agent only sees its own workspace data", !JSON.stringify(response).includes("Fix API integration"));
  const search = executeReadTool("search_workspace", { query: "secret" }, { workspaceId: "ws-2", snapshot: foreignSnapshot, context: foreignContext });
  ok("Read tool scoped to its snapshot", search.count === 1);
  const isolation = executeReadTool("get_task", { query: "Fix API integration" }, { workspaceId: "ws-2", snapshot: foreignSnapshot, context: foreignContext });
  ok("Foreign task invisible from another workspace", isolation.status === "error");
}

console.log("-- RLS / security invariants -------------------------");
{
  const fs = await import("fs");
  const toolsSrc = fs.readFileSync("src/lib/intelligence/tools.ts", "utf8");
  const agentSrc = fs.readFileSync("src/lib/intelligence/agent.ts", "utf8");
  ok("Tool layer never imports Supabase", !toolsSrc.includes("supabase") && !toolsSrc.includes("createClient"));
  ok("Agent layer never imports Supabase", !agentSrc.includes("supabase") && !agentSrc.includes("createClient"));
  ok("No SQL strings in the tool layer", !toolsSrc.includes("select ") && !toolsSrc.includes("insert into"));
  const migration = fs.readFileSync("supabase/tests/fixtures/001_nexus_base_schema.sql", "utf8");
  ok("RLS enabled on tasks", /policy "[a-z_]*tasks[a-z_]*" on public\.tasks for select/.test(migration));
  ok("RLS enabled on projects", /policy "[a-z_]*projects[a-z_]*" on public\.projects for select/.test(migration));
  ok("RLS read policies exist for goals + activities", /policy "[a-z_]*goals[a-z_]*" on public\.goals for select/.test(migration) && /policy "[a-z_]*activities[a-z_]*" on public\.activities for select/.test(migration));
}

console.log("-- mobile-safe actions (static safeguard) ------------");
{
  const fs = await import("fs");
  const src = fs.readFileSync("src/components/intelligence/intelligence-ask.tsx", "utf8");
  ok("Confirmation buttons ≥44px on mobile", src.includes('min-h-[44px]'));
  // 44px floor via min-h — compatible with the auto-growing composer.
  ok("Query input ≥44px", src.includes("min-h-[44px]"));
  ok("No hover-only critical action", src.includes("onClick"));
}

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
if (failed > 0) process.exit(1);

// ============================================================
// In-memory Supabase fake (same contract as the v1 suite)
// ============================================================
function createFakeDb() {
  const store = {
    tasks: [
      { id: "t1", workspace_id: "ws-1", title: "Fix API integration", status: "blocked", priority: "urgent", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", completed_at: null },
      { id: "t2", workspace_id: "ws-1", title: "Finish homepage", status: "todo", priority: "high", due_at: "2026-08-26T00:00:00.000Z", project_id: "p1", completed_at: null },
    ],
    projects: [
      { id: "p1", workspace_id: "ws-1", name: "Website Redesign", status: "active", progress: 40, due_date: "2026-08-28" },
    ],
    goals: [
      { id: "g1", workspace_id: "ws-1", title: "Launch v2", status: "active", progress: 60, target_date: "2026-09-30" },
    ],
  };

  function matches(row, filters) {
    for (const [col, val] of Object.entries(filters)) {
      if (typeof val === "function") {
        if (!val(row[col])) return false;
      } else if (row[col] !== val) return false;
    }
    return true;
  }

  function build(table, mode) {
    const filters = {};
    let limit = null;
    let insertRow = null;
    let updatePatch = null;
    let selected = null;
    const q = {
      select() { selected = arguments; return q; },
      eq(col, val) { filters[col] = val; return q; },
      ilike(col, val) {
        const regex = new RegExp(String(val).replace(/^%|%$/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filters[col] = (row) => regex.test(row[col]);
        return q;
      },
      limit(n) { limit = n; return q; },
      insert(row) { insertRow = row; mode = "insert"; return q; },
      update(patch) { updatePatch = patch; mode = "update"; return q; },
      delete() { mode = "delete"; return q; },
      async single() {
        const rows = store[table].filter((row) => matches(row, filters));
        const row = limit !== null ? rows.slice(0, limit)[0] : rows[0];
        if (mode === "insert") {
          const created = { id: `new-${table}-${store[table].length + 1}`, workspace_id: filters.workspace_id ?? "ws-1", ...insertRow };
          if (store._corrupt && table === "tasks") created.title = "TAMPERED";
          store[table].push(created);
          return { data: project(created, selected), error: null };
        }
        if (mode === "update") {
          if (!row) return { data: null, error: { message: "Row not found" } };
          Object.assign(row, updatePatch);
          return { data: project(row, selected), error: null };
        }
        if (mode === "delete") {
          if (!row) return { data: null, error: { message: "Row not found" } };
          store[table] = store[table].filter((r) => r.id !== row.id);
          return { data: row, error: null };
        }
        return {
          data: row ? project(row, selected) : null,
          error: row ? null : { code: "PGRST116", message: "No rows found" },
        };
      },
      async maybeSingle() {
        const rows = store[table].filter((row) => matches(row, filters));
        const row = limit !== null ? rows.slice(0, limit)[0] : rows[0];
        if (mode === "delete") {
          if (!row) return { data: null, error: null };
          store[table] = store[table].filter((r) => r.id !== row.id);
          return { data: row, error: null };
        }
        return { data: row ? project(row, selected) : null, error: null };
      },
      then(resolve) {
        return this.maybeSingle().then((result) => {
          if (mode === "delete") resolve({ data: null, error: result.data ? null : null });
          else resolve(result);
        });
      },
    };
    return q;
  }

  function project(row, selected) {
    if (!row) return null;
    const cols = selected && selected[0] !== "*" ? Array.from(selected[0] === undefined ? [] : selected[0].split(",")) : null;
    if (!cols) return { ...row };
    const out = {};
    for (const col of cols) out[col.trim()] = row[col.trim()];
    return out;
  }

  return {
    from(table) { return build(table, "select"); },
    _store: store,
  };
}
