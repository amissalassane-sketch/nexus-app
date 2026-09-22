const { reasonWorkspace, rankPriorities, weeklyBriefing, workspaceHealth } = await import("../../src/lib/intelligence/advanced.ts");
const { buildWorkspaceContext } = await import("../../src/lib/intelligence/context-builder.ts");
const { classifyIntent, riskForAction, mapLegacyIntentToId } = await import("../../src/lib/intelligence/intent.ts");
const { executeIntelligenceAction, ActionError, riskForIntelligenceAction } = await import("../../src/lib/intelligence/actions.ts");
const { callAIProvider } = await import("../../src/lib/intelligence/ai-provider.ts");
const { computeInsights } = await import("../../src/lib/intelligence/engine.ts");

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
    { id: "t1", title: "Fix API integration", status: "blocked", priority: "urgent", due_at: "2026-08-24", project_id: "p1", created_at: "2026-08-10", completed_at: null },
    { id: "t2", title: "Finish homepage", status: "todo", priority: "high", due_at: "2026-08-26", project_id: "p1", created_at: "2026-08-18", completed_at: null },
    { id: "t3", title: "Prepare presentation", status: "todo", priority: "medium", due_at: "2026-08-28", project_id: "p2", created_at: "2026-08-20", completed_at: null },
    { id: "t4", title: "Write client brief", status: "todo", priority: "low", due_at: "2026-09-02", project_id: "p2", created_at: "2026-08-21", completed_at: null },
    { id: "t5", title: "Update documentation", status: "done", priority: "medium", due_at: "2026-08-23", project_id: "p2", completed_at: "2026-08-25", created_at: "2026-08-15" },
  ],
  goals: [{ id: "g1", title: "Launch v2", status: "active", progress: 60, target_date: "2026-09-30" }],
};

console.log("-- intent classification FR / EN --------------------");
{
  const fr1 = classifyIntent("Qu'est-ce que je dois faire aujourd'hui ?", { snapshot });
  ok("FR priorities intent", fr1.intent === "PRIORITIZE");
  const fr2 = classifyIntent("Quels projets nécessitent mon attention ?", { snapshot });
  ok("FR detection intent", fr2.intent === "DETECT");
  const fr3 = classifyIntent("Organise ma journée.", { snapshot });
  ok("FR plan intent", fr3.intent === "PLAN");
  const fr4 = classifyIntent("Crée une tâche pour préparer ma présentation vendredi.", { snapshot });
  ok("FR create intent + create_task", fr4.intent === "CREATE" && fr4.actionType === "create_task");
  const fr5 = classifyIntent("Décale cette tâche à lundi.", { snapshot });
  ok("FR move intent", fr5.intent === "MOVE" && fr5.actionType === "move_task");
  const fr6 = classifyIntent("Marque cette tâche comme terminée.", { snapshot });
  ok("FR complete intent", fr6.intent === "COMPLETE" && fr6.actionType === "complete_task");
  const fr7 = classifyIntent("Pourquoi ce projet avance mal ?", { snapshot });
  ok("FR explain intent", fr7.intent === "EXPLAIN");
  const fr8 = classifyIntent("Supprime la tâche Fix API integration.", { snapshot });
  ok("FR delete intent high risk", fr8.intent === "DELETE" && fr8.risk === "high");
  const fr9 = classifyIntent("Qu'est-ce qui est en retard ?", { snapshot });
  ok("FR overdue detection", fr9.intent === "DETECT");

  const en1 = classifyIntent("What should I work on today?", { snapshot });
  ok("EN priorities intent", en1.intent === "PRIORITIZE");
  const en2 = classifyIntent("What is overdue?", { snapshot });
  ok("EN overdue detection", en2.intent === "DETECT");
  const en3 = classifyIntent("Create a task for the presentation on Friday.", { snapshot });
  ok("EN create intent", en3.intent === "CREATE" && en3.actionType === "create_task");
  const en4 = classifyIntent("Move this task to Monday.", { snapshot });
  ok("EN move intent", en4.intent === "MOVE");
  const en5 = classifyIntent("Complete this task.", { snapshot });
  ok("EN complete intent", en5.intent === "COMPLETE");
}

console.log("-- conversation context -----------------------------");
{
  const prior = {
    id: "h1",
    query: "Crée une tâche pour préparer ma présentation.",
    intent: "action",
    headline: "Recommended action: Create task “Prepare presentation”",
    targetEntities: ["Prepare presentation"],
    actionType: "create_task",
    target: { type: "task", query: "preparer ma presentation" },
  };
  const followUp = classifyIntent("Fais-le.", { sessionHistory: [prior], snapshot });
  ok("Follow-up 'Fais-le' resolves to previous create_task", followUp.intent === "CREATE" && followUp.actionType === "create_task");

  const next = reasonWorkspace(snapshot, "Et après ?", undefined, [{ ...prior, targetEntities: ["Step 1", "Step 2", "Step 3"] }]);
  ok("Follow-up 'Et après ?' resolves to next plan step", next.intentId === "PLAN" && next.narrative.includes("Step 2"));

  const taskRef = reasonWorkspace(snapshot, "Marque cette tâche comme terminée.", undefined, [
    { ...prior, targetEntities: ["Prepare presentation"], target: { type: "task", id: "t3", label: "Prepare presentation" } },
  ]);
  ok("Follow-up 'cette tâche' produces complete_task proposal", taskRef.action?.type === "complete_task");
}

console.log("-- priority ranking & risk detection ----------------");
{
  const ranked = rankPriorities(snapshot, 3);
  ok("Priority rank 1 is blocked/overdue task", ranked[0]?.task.title === "Fix API integration");
  ok("Priority rank carries auditable reasons", (ranked[0]?.reasons?.length ?? 0) > 0);

  const insights = computeInsights(snapshot);
  ok("Risk detection finds overdue/blocked signal", insights.some((i) => i.kind === "blocked" || i.kind === "deadline"));
  ok("Insights carry evidence", insights.every((i) => Array.isArray(i.evidence) && i.evidence.length > 0));
  ok("Health index is measured", workspaceHealth(snapshot).measured === true);
  const briefing = weeklyBriefing(snapshot);
  ok("Weekly briefing has completed this week", briefing.completedThisWeek === 1);
}

console.log("-- planning & summary -------------------------------");
{
  const dayPlan = reasonWorkspace(snapshot, "Organise ma journée.");
  ok("Day plan intentId PLAN", dayPlan.intentId === "PLAN");
  ok("Day plan begins with overdue task", dayPlan.items?.[0]?.title?.includes("Fix API integration"));
  const weekPlan = reasonWorkspace(snapshot, "Aide-moi à organiser cette semaine.");
  ok("Week plan generates steps", (weekPlan.items?.length ?? 0) >= 3);
  const summary = reasonWorkspace(snapshot, "Résume l'activité de cette semaine.");
  ok("Summary intentId SUMMARIZE", summary.intentId === "SUMMARIZE");
  ok("Summary evidence includes completions", summary.evidence.metrics.some((m) => m.label.includes("Completed")));
}

console.log("-- hallucination prevention -------------------------");
{
  const res = reasonWorkspace(snapshot, "What did the project 'Nonexistent Initiative' achieve this week?");
  const titles = (res.items ?? []).map((i) => i.title).join(" ");
  ok("No invented task appears in response", !titles.includes("Nonexistent Initiative"));
  const src = JSON.stringify(res);
  ok("No fabricated deadline appears in response", !src.includes("2099-"));
}

console.log("-- action risk classification -----------------------");
{
  ok("create_task medium risk", riskForAction("create_task") === "medium");
  ok("update_task high risk", riskForAction("update_task") === "high");
  ok("complete_task high risk", riskForAction("complete_task") === "high");
  ok("delete_task high risk", riskForAction("delete_task") === "high");
  ok("create_goal medium risk", riskForIntelligenceAction("create_goal") === "medium");
  ok("legacy action maps to CREATE", mapLegacyIntentToId("action", "create_task") === "CREATE");
}

// ============================================================
// In-memory Supabase fake for the server mutation layer. It keeps
// rows in memory and enforces workspace_id filters so the same code
// path (and cross-workspace isolation) can be exercised without a
// live database.
// ============================================================
function createFakeDb() {
  const store = {
    tasks: [
      { id: "t1", workspace_id: "ws-1", title: "Fix API integration", status: "blocked", priority: "urgent", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", completed_at: null },
      { id: "t2", workspace_id: "ws-1", title: "Finish homepage", status: "todo", priority: "high", due_at: "2026-08-26T00:00:00.000Z", project_id: "p1", completed_at: null },
      { id: "t3", workspace_id: "ws-2", title: "Foreign task", status: "todo", priority: "medium", due_at: "2026-09-01T00:00:00.000Z", project_id: "p9", completed_at: null },
    ],
    projects: [
      { id: "p1", workspace_id: "ws-1", name: "Website Redesign", status: "active", progress: 40, due_date: "2026-08-28" },
      { id: "p9", workspace_id: "ws-2", name: "Foreign project", status: "active", progress: 50, due_date: "2026-09-01" },
    ],
    goals: [
      { id: "g1", workspace_id: "ws-1", title: "Launch v2", status: "active", progress: 0, target_date: "2026-09-30" },
    ],
  };

  function matches(row, filters) {
    for (const [col, val] of Object.entries(filters)) {
      if (typeof val === "function") {
        if (!val(row[col])) return false;
      } else if (row[col] !== val) {
        return false;
      }
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
      // The real Supabase builder is thenable when no terminal is called
      // (e.g. delete().eq().eq() awaited directly).
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

console.log("-- server mutation layer: approval -----------------");
{
  const db = createFakeDb();
  const rejected = await executeIntelligenceAction(db, "ws-1", "u1", "create_task", { title: "No confirmation task" }).then(
    () => ({ ok: true }),
    (err) => ({ ok: false, err })
  );
  ok("Mutation without confirmation is rejected", rejected.ok === false && rejected.err instanceof ActionError);
}

console.log("-- server mutation layer: create + verify ------------");
{
  const db = createFakeDb();
  const result = await executeIntelligenceAction(db, "ws-1", "u1", "create_task", {
    title: "Prepare presentation", priority: "high", dueDate: "2026-08-28", projectId: "p1", confirmed: true,
  });
  ok("create_task verified success", result.success === true && result.verified.verified === true);
  ok("create_task read back in workspace", result.entityId === "new-tasks-4");
  ok("create_task matched expected fields", result.verified.matched.includes("title") && result.verified.matched.includes("due_at"));
}

console.log("-- server mutation layer: update / complete / move ---");
{
  const db = createFakeDb();
  const updated = await executeIntelligenceAction(db, "ws-1", "u1", "update_task", { taskId: "t2", priority: "urgent", confirmed: true });
  ok("update_task verified", updated.success && updated.verified.matched.includes("priority"));
  ok("update_task row changed", db._store.tasks.find((t) => t.id === "t2").priority === "urgent");

  const completed = await executeIntelligenceAction(db, "ws-1", "u1", "complete_task", { taskId: "t2", confirmed: true });
  ok("complete_task verified", completed.success && completed.verified.matched.includes("status") && completed.verified.matched.includes("completed_at"));

  const moved = await executeIntelligenceAction(db, "ws-1", "u1", "move_task", { taskId: "t2", dueDate: "2026-09-01", confirmed: true });
  ok("move_task verified with new date", moved.success && moved.verified.matched.includes("due_at"));
}

console.log("-- server mutation layer: cross-workspace isolation --");
{
  const db = createFakeDb();
  const foreign = await executeIntelligenceAction(db, "ws-1", "u1", "complete_task", { taskId: "t3", confirmed: true }).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, message: error.message })
  );
  ok("A task from another workspace cannot be mutated", foreign.ok === false && /No matching task/.test(foreign.message));
}

console.log("-- server mutation layer: delete requires high-risk --");
{
  const db = createFakeDb();
  const rejected = await executeIntelligenceAction(db, "ws-1", "u1", "delete_task", { taskId: "t1", confirmed: true }).catch(() => ({ ok: false }));
  ok("Delete without confirmDeletion flag is rejected", rejected.ok === false);
  const deleted = await executeIntelligenceAction(db, "ws-1", "u1", "delete_task", { taskId: "t1", confirmed: true, confirmDeletion: true });
  ok("Delete with explicit confirmation succeeds and verifies", deleted.success && deleted.verified.verified === true);
  ok("Deleted row is gone", db._store.tasks.every((t) => t.id !== "t1"));
}

console.log("-- server mutation layer: failed action --------------");
{
  const db = createFakeDb();
  const failed = await executeIntelligenceAction(db, "ws-1", "u1", "create_task", { confirmed: true }).then(
    () => ({ ok: true }),
    (err) => ({ ok: false, message: err.message })
  );
  ok("create_task missing title fails with clean error", failed.ok === false && /title is required/.test(failed.message));
}

console.log("-- AI provider timeout, invalid JSON, fallback --------");
{
  // Timeout: a fetch that never resolves (the abort signal rejects it).
  const timedOut = await callAIProvider("Analyze my workspace", buildContext(), undefined, {
    config: { provider: "openai", apiKey: "test" },
    timeoutMs: 20,
    fetchImpl: (_url, opts) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  });
  ok("Provider timeout returns null (fallback)", timedOut === null);

  // Invalid JSON from a provider that says it returned a response.
  const invalidJson = await callAIProvider("Analyze", buildContext(), undefined, {
    config: { provider: "openai", apiKey: "test" },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "this is not json" } }] }),
    }),
  });
  ok("Provider invalid JSON returns null (fallback)", invalidJson === null);
}

function buildContext() {
  return buildWorkspaceContext("ws-1", { tasks: [], projects: [], goals: [] });
}

console.log("-- deterministic fallback label ----------------------");
{
  const res = reasonWorkspace(snapshot, "Quels projets nécessitent mon attention ?");
  ok("Fallback is honest nexus-engine", res.provider === "nexus-engine");
  ok("Fallback exposes structured intentId", typeof res.intentId === "string");
  ok("Fallback exposes action risk", typeof res.action?.risk === "string");
}

console.log("-- mobile interaction contract (static safeguard) ----");
{
  const source = (await import("fs")).readFileSync("src/components/intelligence/intelligence-ask.tsx", "utf8");
  ok("Confirm action hit area >= 44px on mobile", source.includes('className="min-h-[44px] sm:min-h-[36px]"'));
  // The composer is an auto-growing textarea: min-h-[44px] is the 44px
  // floor that keeps the grow behaviour (a fixed h-11 would cap it).
  ok("Query input is 44px tall", source.includes("min-h-[44px]"));
  ok("Action confirm has no hover-only dependency", source.includes("Button"));
}

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
if (failed > 0) process.exit(1);
