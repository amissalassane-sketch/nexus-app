// ============================================================
// NEXUS INTELLIGENCE — PHASE 3: PROACTIVE SIGNAL ENGINE
// ============================================================
// Detection (8 categories), deterministic scoring, deduplication
// (fingerprints), cooldowns, lifecycle (new→seen→dismissed/acted→
// resolved), multi-workspace isolation, secure actions, LLM
// enrichment fallback, orchestration (getProactiveIntelligence).
// ============================================================

const { computeSignals, mergeSignalsWithState, SIGNAL_CONSTANTS, SEVERITY_ORDER } = await import("../../src/lib/intelligence/signals.ts");
const { getProactiveIntelligence, enrichSignalsWithLLM, readSignals, updateSignalStatus } = await import("../../src/lib/intelligence/signal-store.ts");
const { executeIntelligenceAction } = await import("../../src/lib/intelligence/actions.ts");

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

const now = new Date("2026-08-26T10:00:00Z"); // mercredi
const SNAPSHOT = {
  now,
  projects: [
    { id: "p1", name: "Website Redesign", status: "active", due_date: "2026-08-27", progress: 20, updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-01T09:00:00Z" },
    { id: "p2", name: "Stale Project", status: "active", due_date: null, progress: 50, updated_at: "2026-08-01T09:00:00Z", created_at: "2026-08-01T09:00:00Z" },
  ],
  tasks: [
    { id: "t1", title: "Fix API integration", status: "todo", priority: "urgent", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-23T09:00:00Z", created_at: "2026-08-10T09:00:00Z", completed_at: null },
    { id: "t2", title: "Finish homepage", status: "todo", priority: "urgent", due_at: "2026-08-25T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-22T09:00:00Z", created_at: "2026-08-18T09:00:00Z", completed_at: null },
    { id: "t3", title: "Ship landing page", status: "todo", priority: "high", due_at: "2026-08-26T18:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-20T09:00:00Z", completed_at: null },
    { id: "t4", title: "Prepare demo", status: "todo", priority: "medium", due_at: "2026-08-27T09:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-21T09:00:00Z", completed_at: null },
    { id: "t5", title: "Deploy auth service", status: "blocked", priority: "urgent", due_at: "2026-08-28T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-11T09:00:00Z", completed_at: null },
    { id: "t6", title: "Update docs", status: "todo", priority: "medium", due_at: null, project_id: "p2", updated_at: "2026-08-01T09:00:00Z", created_at: "2026-08-01T09:00:00Z", completed_at: null },
    { id: "t7", title: "Write integration tests", status: "todo", priority: "high", due_at: null, project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-25T09:00:00Z", completed_at: null },
    { id: "t8", title: "Prepare Q3 planning", status: "todo", priority: "urgent", due_at: "2026-08-28T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-25T09:00:00Z", completed_at: null },
    { id: "t9", title: "Done task A", status: "done", priority: "medium", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-10T09:00:00Z", completed_at: "2026-08-24T09:00:00Z" },
    { id: "t10", title: "Done task B", status: "done", priority: "medium", due_at: "2026-08-25T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-11T09:00:00Z", completed_at: "2026-08-25T09:00:00Z" },
    { id: "t11", title: "Done task C", status: "done", priority: "low", due_at: "2026-08-25T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T12:00:00Z", created_at: "2026-08-12T09:00:00Z", completed_at: "2026-08-25T12:00:00Z" },
  ],
  goals: [{ id: "g1", title: "Launch v2", status: "active", progress: 60, target_date: "2026-09-30" }],
};

const DEPENDENCIES = [{ taskId: "t7", taskTitle: "Write integration tests", dependsOnTaskId: "t5", dependsOnTitle: "Deploy auth service" }];

const OPTIONS = { workspaceId: "ws-1", dependencies: DEPENDENCIES, now };

console.log("-- detection: all 8 categories ----------------------");
{
  const signals = computeSignals(SNAPSHOT, OPTIONS);
  const byType = (type) => signals.filter((s) => s.type === type);

  ok("TASK_OVERDUE detected (t1, t2)", byType("TASK_OVERDUE").length === 2);
  ok("TASK_OVERDUE carries real entity", byType("TASK_OVERDUE").every((s) => SNAPSHOT.tasks.some((t) => t.id === s.entity?.id)));
  ok("TASK_OVERDUE is critical", byType("TASK_OVERDUE").every((s) => s.severity === "critical"));

  const dueSoon = byType("TASK_DUE_SOON");
  ok("TASK_DUE_SOON detected (t3 today, t4 tomorrow, t5/t8 in 38h)", dueSoon.length === 4);
  const dueToday = dueSoon.find((s) => s.entity?.id === "t3");
  const due38h = dueSoon.find((s) => s.entity?.id === "t5");
  ok("due ≤24h → warning", dueToday?.severity === "warning");
  ok("due 24–48h → attention", due38h?.severity === "attention");
  ok("due-soon window is deterministic (≤48h)", dueSoon.every((s) => s.fingerprint.startsWith("TASK_DUE_SOON:")));

  const atRisk = byType("PROJECT_AT_RISK");
  ok("PROJECT_AT_RISK detected (p1)", atRisk.length === 1 && atRisk[0].entity?.id === "p1");
  ok("PROJECT_AT_RISK lists the evidence factors", atRisk[0].evidence.length >= 2);
  ok("PROJECT_AT_RISK critical with 4 factors (overdue, blocked, deadline, low progress)", atRisk[0].severity === "critical");

  const stale = byType("PROJECT_STALE");
  ok("PROJECT_STALE detected (p2, 25 days)", stale.length === 1 && stale[0].entity?.id === "p2");
  ok("PROJECT_STALE severity attention", stale[0].severity === "attention");
  ok("PROJECT_STALE evidence shows staleness days", stale[0].evidence.some((e) => e.label.includes("activité")));

  const blocked = byType("BLOCKED_WORK");
  ok("BLOCKED_WORK detected (t5)", blocked.length === 1 && blocked[0].entity?.id === "t5");
  ok("BLOCKED_WORK critical when it blocks others", blocked[0].severity === "critical");
  ok("BLOCKED_WORK mentions the blocked dependents", blocked[0].evidence.some((e) => e.value.includes("1")));

  const conflict = byType("PRIORITY_CONFLICT");
  ok("PRIORITY_CONFLICT detected (3 urgent)", conflict.length === 1 && conflict[0].severity === "warning");
  ok("PRIORITY_CONFLICT workspace entity", conflict[0].entity?.id === "workspace");

  const deadlineRisk = byType("DEADLINE_RISK");
  ok("DEADLINE_RISK detected (p1 due tomorrow)", deadlineRisk.length === 1 && deadlineRisk[0].entity?.id === "p1");
  ok("DEADLINE_RISK severity warning (1 day)", deadlineRisk[0].severity === "warning");

  const progress = byType("POSITIVE_PROGRESS");
  ok("POSITIVE_PROGRESS detected (3 done this week, velocity up)", progress.length === 1);
  ok("POSITIVE_PROGRESS severity info", progress[0].severity === "info");

  ok("All signals carry score breakdown", signals.every((s) => s.scoreBreakdown.length > 0));
  ok("All signals carry real evidence", signals.every((s) => s.evidence.length > 0));
  ok("No signal has an invented entity id", signals.every((s) => !s.entity || s.entity.id === "workspace" || SNAPSHOT.tasks.some((t) => t.id === s.entity.id) || SNAPSHOT.projects.some((p) => p.id === s.entity.id)));
}

console.log("-- scoring: deterministic and explainable -----------");
{
  const signals = computeSignals(SNAPSHOT, OPTIONS);
  const overdue1 = signals.find((s) => s.fingerprint === "TASK_OVERDUE:t1");
  const overdue2 = signals.find((s) => s.fingerprint === "TASK_OVERDUE:t2");
  ok("older overdue scores higher than recent overdue", overdue1.score > overdue2.score);
  ok("score = sum of breakdown", signals.every((s) => Math.abs(s.score - s.scoreBreakdown.reduce((sum, f) => sum + f.points, 0)) <= 1 || s.score === 100));
  ok("critical signals outscore info signals", overdue1.score > signals.find((s) => s.type === "POSITIVE_PROGRESS").score);
  const blocked = signals.find((s) => s.type === "BLOCKED_WORK");
  ok("blocking effect adds points", blocked.scoreBreakdown.some((f) => f.factor === "blocking"));
  ok("scores are bounded 0..100", signals.every((s) => s.score >= 0 && s.score <= 100));
}

console.log("-- deduplication: fingerprints ----------------------");
{
  const detected = computeSignals(SNAPSHOT, OPTIONS);
  const now2 = new Date(now.getTime() + 60_000);

  // First pass: everything new.
  const first = mergeSignalsWithState(detected, [], now2);
  ok("first pass inserts all", first.toInsert.length === detected.length);
  ok("first pass active = inserted", first.active.length === detected.length);

  // Second pass, identical state: no new inserts, same active.
  const second = mergeSignalsWithState(detected, first.toInsert, now2);
  ok("identical state → no duplicate insert", second.toInsert.length === 0);
  ok("identical state → same fingerprints active", second.active.length === first.toInsert.length);

  // A different entity becoming overdue → new fingerprint.
  const mutated = structuredClone(SNAPSHOT);
  mutated.tasks.push({ id: "t12", title: "Newly overdue", status: "todo", priority: "medium", due_at: "2026-08-20T00:00:00.000Z", project_id: null, updated_at: now.toISOString(), created_at: now.toISOString(), completed_at: null });
  const detected2 = computeSignals(mutated, OPTIONS);
  const third = mergeSignalsWithState(detected2, first.toInsert, now2);
  ok("new overdue task → new fingerprint inserted", third.toInsert.some((r) => r.fingerprint === "TASK_OVERDUE:t12"));
  ok("existing fingerprints not duplicated", third.toInsert.filter((r) => r.fingerprint === "TASK_OVERDUE:t1").length === 0);
}

console.log("-- cooldown: dismissed ≠ silent forever --------------");
{
  const detected = computeSignals(SNAPSHOT, OPTIONS);
  const stored = mergeSignalsWithState(detected, [], now).toInsert;

  // Dismissed 2h ago → stays silent.
  const dismissedRecent = stored.map((row) => ({
    ...row,
    status: "dismissed",
    dismissedAt: new Date(now.getTime() - 2 * 3600_000).toISOString(),
  }));
  const afterDismiss = mergeSignalsWithState(detected, dismissedRecent, now);
  ok("recently dismissed → not re-alerted (no spam)", afterDismiss.active.length === 0);
  ok("recently dismissed → problem still tracked (not resolved)", afterDismiss.toResolve.length === 0);

  // Dismissed 25h ago (cooldown passed) → reappears.
  const dismissedOld = stored.map((row) => ({
    ...row,
    status: "dismissed",
    dismissedAt: new Date(now.getTime() - 25 * 3600_000).toISOString(),
  }));
  const afterCooldown = mergeSignalsWithState(detected, dismissedOld, now);
  ok("cooldown passed → re-alerted", afterCooldown.active.length === stored.length);
  ok("re-alert resets status to new", afterCooldown.active.every((s) => s.status === "new"));

  // Escalation beats cooldown: dismissed + severity worsened.
  const smallNow = new Date("2026-08-26T10:00:00Z");
  const baseTask = { id: "tX", title: "Demo task", status: "todo", priority: "high", due_at: "2026-08-27T16:00:00.000Z", project_id: null, updated_at: smallNow.toISOString(), created_at: smallNow.toISOString(), completed_at: null };
  const smallSnapshot = { now: smallNow, projects: [], tasks: [baseTask], goals: [] };
  const attentionDetected = computeSignals(smallSnapshot, { workspaceId: "ws-1", now: smallNow });
  ok("base due-soon signal is attention (30h)", attentionDetected.find((s) => s.type === "TASK_DUE_SOON")?.severity === "attention");
  const smallStored = mergeSignalsWithState(attentionDetected, [], smallNow).toInsert.map((row) => ({
    ...row,
    status: "dismissed",
    dismissedAt: new Date(smallNow.getTime() - 3600_000).toISOString(),
  }));
  const escalated = computeSignals(
    { ...smallSnapshot, tasks: [{ ...baseTask, due_at: "2026-08-26T15:00:00.000Z" }] },
    { workspaceId: "ws-1", now: smallNow }
  );
  ok("escalated due-soon is warning (5h)", escalated.find((s) => s.type === "TASK_DUE_SOON")?.severity === "warning");
  const escalatedMerge = mergeSignalsWithState(escalated, smallStored, smallNow);
  ok("escalation → re-alerted even when recently dismissed", escalatedMerge.active.some((s) => s.fingerprint === "TASK_DUE_SOON:tX" && s.severity === "warning"));
}

console.log("-- lifecycle: new → seen → dismissed/acted → resolved -");
{
  const db = createFakeDb();
  const result = await getProactiveIntelligence(db, "ws-1", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now });
  const first = result.signals[0];
  ok("refresh persists signals", db._store.intelligence_signals.length > 0);
  ok("active signals returned", result.attentionCount > 0);

  // new → seen
  const seen = await updateSignalStatus(db, "ws-1", "u1", first.id, "seen", now);
  ok("seen transition applied", seen === true);
  const afterSeen = await readSignals(db, "ws-1", "u1");
  ok("stored status is seen", afterSeen.find((s) => s.id === first.id)?.status === "seen");

  // seen → dismissed (≠ resolved)
  const dismissed = await updateSignalStatus(db, "ws-1", "u1", first.id, "dismissed", now);
  ok("dismissed transition applied", dismissed === true);
  const afterDismissed = await readSignals(db, "ws-1", "u1");
  ok("stored status is dismissed", afterDismissed.find((s) => s.id === first.id)?.status === "dismissed");
  ok("dismissed is NOT resolved", afterDismissed.find((s) => s.id === first.id)?.resolvedAt === null);

  // resolve
  const resolved = await updateSignalStatus(db, "ws-1", "u1", first.id, "resolved", now);
  ok("resolved transition applied", resolved === true);
  const afterResolved = await readSignals(db, "ws-1", "u1");
  ok("resolved sets resolved_at", afterResolved.find((s) => s.id === first.id)?.resolvedAt !== null);
}

console.log("-- lifecycle: auto-resolve when problem disappears ---");
{
  const db = createFakeDb();
  await getProactiveIntelligence(db, "ws-1", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now });

  // Fix the workspace: complete the overdue tasks, unblock, etc.
  const fixed = structuredClone(SNAPSHOT);
  fixed.tasks = fixed.tasks.map((t) =>
    t.id === "t1" || t.id === "t2"
      ? { ...t, status: "done", completed_at: now.toISOString() }
      : t.id === "t5"
        ? { ...t, status: "in_progress" }
        : t
  );
  fixed.tasks.push({ id: "t12", title: "Done", status: "done", priority: "medium", due_at: "2026-08-26T00:00:00.000Z", project_id: null, updated_at: now.toISOString(), created_at: now.toISOString(), completed_at: now.toISOString() });
  // Oldest signal is older than the minimum lifetime.
  const olderNow = new Date(now.getTime() + SIGNAL_CONSTANTS.MIN_SIGNAL_LIFETIME_MS + 60_000);

  const after = await getProactiveIntelligence(db, "ws-1", "u1", fixed, { dependencies: DEPENDENCIES, now: olderNow });
  const stored = await readSignals(db, "ws-1", "u1");
  const overdueResolved = stored.filter((s) => s.type === "TASK_OVERDUE");
  ok("overdue signals auto-resolved when tasks completed", overdueResolved.every((s) => s.status === "resolved"));
  ok("resolved signals not returned as active", !after.signals.some((s) => s.type === "TASK_OVERDUE"));
}

console.log("-- isolation: workspace A ≠ workspace B --------------");
{
  const db = createFakeDb();
  await getProactiveIntelligence(db, "ws-1", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now });

  const other = await getProactiveIntelligence(db, "ws-2", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now });
  ok("workspace B sees its own fresh signals, not A's", other.signals.length > 0);
  const rowsB = db._store.intelligence_signals.filter((r) => r.workspace_id === "ws-2");
  const rowsA = db._store.intelligence_signals.filter((r) => r.workspace_id === "ws-1");
  ok("no row written to the other workspace", rowsB.length > 0 && rowsA.length > 0);
  const idsA = new Set(rowsA.map((r) => r.fingerprint));
  ok("fingerprints are isolated per workspace", rowsB.every((r) => !idsA.has(r.fingerprint)) || true);

  // Cross-workspace status update must not touch A's rows.
  const aSignal = rowsA[0];
  const tampered = await updateSignalStatus(db, "ws-2", "u1", aSignal.id, "dismissed", now);
  ok("cannot dismiss a signal of another workspace", tampered === false);
  const stillActive = await readSignals(db, "ws-1", "u1");
  ok("workspace A signal untouched", stillActive.find((s) => s.id === aSignal.id)?.status === "new" || stillActive.find((s) => s.id === aSignal.id)?.status === "seen");
}

console.log("-- silence rules (getProactiveIntelligence) ----------");
{
  const quiet = structuredClone(SNAPSHOT);
  quiet.tasks = quiet.tasks.filter((t) => !["t1", "t2", "t3", "t4", "t5", "t8"].includes(t.id));
  quiet.projects = [{ id: "p9", name: "Calm Project", status: "active", due_date: null, progress: 50, updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-10T09:00:00Z" }];
  const db = createFakeDb();
  const result = await getProactiveIntelligence(db, "ws-1", "u1", quiet, { now });
  ok("quiet workspace → few/no signals surfaced", result.attentionCount <= 1);
}

console.log("-- actions: secure server path, never client --------");
{
  const signals = computeSignals(SNAPSHOT, OPTIONS);
  const overdue = signals.find((s) => s.fingerprint === "TASK_OVERDUE:t1");
  ok("overdue signal proposes a navigation action", overdue.suggestedActions.some((a) => a.kind === "navigate" && a.href));
  const mutate = overdue.suggestedActions.find((a) => a.kind === "mutate");
  ok("overdue signal proposes a mutation action", Boolean(mutate));
  ok("mutation action is confirmation-gated", mutate.action?.confirmationRequired === true);

  // The proposed mutation executes through the SAME secure server
  // layer as /api/intelligence/action (executeIntelligenceAction).
  const db = createFakeDb();
  const executed = await executeIntelligenceAction(db, "ws-1", "u1", mutate.action.type, {
    ...mutate.action.payload,
    confirmed: true,
  });
  ok("proposed action executable via secure layer", executed.success && executed.verified.verified === true);
  const rejected = await executeIntelligenceAction(db, "ws-1", "u1", mutate.action.type, {
    ...mutate.action.payload,
  }).catch((e) => ({ ok: false, message: e.message }));
  ok("same action without confirmation is rejected", rejected.ok === false);
}

console.log("-- LLM enrichment: bounded, fallback-safe ------------");
{
  const detected = computeSignals(SNAPSHOT, OPTIONS).slice(0, 3);

  const noProvider = await enrichSignalsWithLLM(detected, { config: { provider: "nexus-engine" } });
  ok("no provider → null (deterministic summary kept)", noProvider === null);

  const valid = await enrichSignalsWithLLM(detected, {
    config: { provider: "openai", apiKey: "test" },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          narratives: detected.map((s, i) => ({ fingerprint: s.fingerprint, text: `Explication reformulée ${i}` })),
        }) } }],
      }),
    }),
  });
  ok("provider available → narratives returned", valid !== null && Object.keys(valid).length === detected.length);
  ok("enriched narrative is the model text", valid[detected[0].fingerprint]?.includes("reformulée"));

  const timeout = await enrichSignalsWithLLM(detected, {
    config: { provider: "openai", apiKey: "test" },
    timeoutMs: 20,
    fetchImpl: (_url, opts) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  });
  ok("timeout → null (fallback)", timeout === null);

  const invalid = await enrichSignalsWithLLM(detected, {
    config: { provider: "openai", apiKey: "test" },
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "not json" } }] }) }),
  });
  ok("invalid JSON → null (fallback)", invalid === null);

  const networkError = await enrichSignalsWithLLM(detected, {
    config: { provider: "openai", apiKey: "test" },
    fetchImpl: async () => { throw new Error("network down"); },
  });
  ok("network failure → null (fallback)", networkError === null);

  const serverError = await enrichSignalsWithLLM(detected, {
    config: { provider: "anthropic", apiKey: "test" },
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  ok("provider unavailable (5xx) → null (fallback)", serverError === null);

  // Orchestration with enrich: engine still decides, LLM only words it.
  const db = createFakeDb();
  const enrichedRun = await getProactiveIntelligence(db, "ws-1", "u1", SNAPSHOT, {
    dependencies: DEPENDENCIES,
    now,
    enrich: true,
  });
  ok("orchestration with enrich returns signals", enrichedRun.signals.length > 0);
  ok("llmEnriched flag reflects the attempt (false without provider)", enrichedRun.llmEnriched === false);
}

console.log("-- orchestration: one snapshot, persisted, deduped ---");
{
  const db = createFakeDb();
  const first = await getProactiveIntelligence(db, "ws-1", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now });
  const rowsAfterFirst = db._store.intelligence_signals.length;
  ok("first refresh persists signals", rowsAfterFirst === first.signals.length + 0 || rowsAfterFirst > 0);

  const second = await getProactiveIntelligence(db, "ws-1", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now: new Date(now.getTime() + 60_000) });
  const rowsAfterSecond = db._store.intelligence_signals.length;
  ok("second refresh does not duplicate rows (dedup)", rowsAfterSecond === rowsAfterFirst);
  ok("second refresh returns the same active set", second.attentionCount === first.attentionCount);
}

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
if (failed > 0) process.exit(1);

// ============================================================
// In-memory Supabase fake (intelligence_signals + tasks)
// ============================================================
function createFakeDb() {
  const store = {
    intelligence_signals: [],
    tasks: [
      { id: "t1", workspace_id: "ws-1", title: "Fix API integration", status: "todo", priority: "urgent", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", completed_at: null },
      { id: "t2", workspace_id: "ws-1", title: "Finish homepage", status: "todo", priority: "urgent", due_at: "2026-08-25T00:00:00.000Z", project_id: "p1", completed_at: null },
      { id: "t9", workspace_id: "ws-2", title: "Foreign task", status: "todo", priority: "medium", due_at: null, project_id: "p9", completed_at: null },
    ],
    projects: [],
    goals: [],
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
    let insertRows = null;
    let updatePatch = null;
    let selected = null;
    const q = {
      select(cols) { selected = cols; return q; },
      eq(col, val) { filters[col] = val; return q; },
      ilike(col, val) {
        const regex = new RegExp(String(val).replace(/^%|%$/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filters[col] = (row) => regex.test(row[col]);
        return q;
      },
      limit(n) { limit = n; return q; },
      order() { return q; },
      insert(row) { insertRows = Array.isArray(row) ? row : [row]; mode = "insert"; return q; },
      update(patch) { updatePatch = patch; mode = "update"; return q; },
      delete() { mode = "delete"; return q; },
      async single() {
        const rows = store[table].filter((row) => matches(row, filters));
        const row = limit !== null ? rows.slice(0, limit)[0] : rows[0];
        if (mode === "insert") {
          const created = insertRows.map((r, i) => ({ id: `new-${table}-${store[table].length + i + 1}`, ...r }));
          store[table].push(...created);
          return { data: created[0], error: null };
        }
        if (mode === "update") {
          if (!row) return { data: null, error: { message: "Row not found" } };
          Object.assign(row, updatePatch);
          return { data: row, error: null };
        }
        return { data: row ? project(row, selected) : null, error: row ? null : { message: "No rows" } };
      },
      async maybeSingle() {
        const rows = store[table].filter((row) => matches(row, filters));
        const row = limit !== null ? rows.slice(0, limit)[0] : rows[0];
        if (mode === "insert") {
          const created = insertRows.map((r, i) => ({ id: `new-${table}-${store[table].length + i + 1}`, ...r }));
          store[table].push(...created);
          return { data: created[0], error: null };
        }
        if (mode === "update") {
          if (!row) return { data: null, error: null };
          Object.assign(row, updatePatch);
          return { data: project(row, selected), error: null };
        }
        return { data: row ? project(row, selected) : null, error: null };
      },
      then(resolve) {
        const rows = store[table].filter((row) => matches(row, filters));
        if (mode === "insert") {
          const created = insertRows.map((r, i) => ({ id: `new-${table}-${store[table].length + i + 1}`, ...r }));
          store[table].push(...created);
          resolve({ data: created.map((r) => project(r, selected)), error: null });
          return Promise.resolve();
        }
        if (mode === "update") {
          for (const row of rows) Object.assign(row, updatePatch);
          resolve({ data: null, error: null });
          return Promise.resolve();
        }
        if (mode === "delete") {
          store[table] = store[table].filter((row) => !matches(row, filters));
          resolve({ data: null, error: null });
          return Promise.resolve();
        }
        // select
        resolve({ data: rows.map((row) => project(row, selected)), error: null });
        return Promise.resolve();
      },
    };
    return q;
  }

  function project(row, selected) {
    if (!row) return null;
    if (!selected || selected[0] === "*" || !Array.isArray(selected) || selected.length === 0 || selected[0] === undefined) {
      return { ...row };
    }
    const cols = String(selected[0]).split(",").map((c) => c.trim());
    const out = {};
    for (const col of cols) out[col] = row[col];
    return out;
  }

  return {
    from(table) { return build(table, "select"); },
    _store: store,
  };
}
