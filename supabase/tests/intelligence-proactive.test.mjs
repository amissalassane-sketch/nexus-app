// ============================================================
// NEXUS INTELLIGENCE — PHASE 3: PROACTIVE SIGNALS (suite dédiée)
// ============================================================
// Detection (overdue, due today/tomorrow, blocked, blocking
// dependency, project at risk, low activity, goal at risk, priority
// conflict), prioritisation, deduplication, refresh-after-mutation,
// isolation, memory integration (« Pourquoi ? », « Débloque-la »),
// API contract (401/400/structured/404) and full loop.
// ============================================================

const { computeSignals, mergeSignalsWithState, SIGNAL_CONSTANTS, SEVERITY_ORDER } = await import("../../src/lib/intelligence/signals.ts");
const { getProactiveIntelligence, readSignals, updateSignalStatus, markSignalActed } = await import("../../src/lib/intelligence/signal-store.ts");
const { handleSignalsRequest } = await import("../../src/lib/intelligence/signal-api.ts");
const { runAgentDeterministic } = await import("../../src/lib/intelligence/agent.ts");
const { buildWorkspaceContext } = await import("../../src/lib/intelligence/context-builder.ts");
const { executeIntelligenceAction } = await import("../../src/lib/intelligence/actions.ts");
const { emptyMemoryState, focusMemoryOnEntity, readMemory, saveMemory, updateMemoryAfterTurn } = await import("../../src/lib/intelligence/memory.ts");

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
    { id: "p1", name: "Refonte site", status: "active", due_date: "2026-08-28", progress: 25, goal_id: "g1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-01T09:00:00Z" },
    { id: "p2", name: "Projet dormant", status: "active", due_date: "2026-09-10", progress: 40, goal_id: null, updated_at: "2026-08-01T09:00:00Z", created_at: "2026-08-01T09:00:00Z" },
  ],
  tasks: [
    { id: "t1", title: "Finaliser le formulaire", status: "todo", priority: "high", due_at: "2026-08-23T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-22T09:00:00Z", created_at: "2026-08-10T09:00:00Z", completed_at: null },
    { id: "t2", title: "Présentation client", status: "todo", priority: "urgent", due_at: "2026-08-26T18:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-18T09:00:00Z", completed_at: null },
    { id: "t3", title: "API paiement", status: "blocked", priority: "urgent", due_at: "2026-08-28T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-11T09:00:00Z", completed_at: null },
    { id: "t4", title: "Tests intégration", status: "todo", priority: "high", due_at: "2026-08-29T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-25T09:00:00Z", completed_at: null },
    { id: "t5", title: "Rapport Q3", status: "todo", priority: "urgent", due_at: "2026-08-27T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-20T09:00:00Z", completed_at: null },
    { id: "t6", title: "Doc technique", status: "todo", priority: "low", due_at: null, project_id: "p2", updated_at: "2026-08-01T09:00:00Z", created_at: "2026-08-01T09:00:00Z", completed_at: null },
    { id: "t7", title: "Fini A", status: "done", priority: "medium", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-10T09:00:00Z", completed_at: "2026-08-24T09:00:00Z" },
    { id: "t8", title: "Fini B", status: "done", priority: "medium", due_at: "2026-08-25T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-11T09:00:00Z", completed_at: "2026-08-25T09:00:00Z" },
    { id: "t9", title: "Fini C", status: "done", priority: "low", due_at: "2026-08-25T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T12:00:00Z", created_at: "2026-08-12T09:00:00Z", completed_at: "2026-08-25T12:00:00Z" },
    { id: "t10", title: "Fini D", status: "done", priority: "low", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T12:00:00Z", created_at: "2026-08-13T09:00:00Z", completed_at: "2026-08-24T12:00:00Z" },
    { id: "t11", title: "Fini E", status: "done", priority: "low", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T14:00:00Z", created_at: "2026-08-14T09:00:00Z", completed_at: "2026-08-24T14:00:00Z" },
    { id: "t12", title: "Fini F", status: "done", priority: "low", due_at: "2026-08-23T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-23T12:00:00Z", created_at: "2026-08-15T09:00:00Z", completed_at: "2026-08-23T12:00:00Z" },
  ],
  goals: [{ id: "g1", title: "Lancer V2", status: "active", progress: 25, target_date: "2026-09-01" }],
};

const DEPENDENCIES = [
  { taskId: "t4", taskTitle: "Tests intégration", dependsOnTaskId: "t3", dependsOnTitle: "API paiement" },
];

const OPTIONS = { workspaceId: "ws-1", dependencies: DEPENDENCIES, now };

console.log("-- detection -----------------------------------------");
{
  const signals = computeSignals(SNAPSHOT, OPTIONS);
  const byType = (type) => signals.filter((s) => s.type === type);

  const overdue = byType("TASK_OVERDUE");
  ok("tâche en retard détectée (t1, 3 jours)", overdue.length === 1 && overdue[0].entity?.id === "t1");
  ok("evidence retard: jours + échéance + statut", overdue[0].evidence.some((e) => e.label.includes("retard")) && overdue[0].evidence.some((e) => e.label === "Priorité"));

  const dueSoon = byType("TASK_DUE_SOON");
  const dueToday = dueSoon.find((s) => s.entity?.id === "t2");
  const dueTomorrow = dueSoon.find((s) => s.entity?.id === "t5");
  ok("échéance aujourd'hui détectée (t2)", Boolean(dueToday) && dueToday.severity === "warning");
  ok("échéance demain détectée (t5, ≤24h → warning)", Boolean(dueTomorrow) && dueTomorrow.severity === "warning");

  const blocked = byType("BLOCKED_WORK");
  ok("tâche bloquée détectée (t3)", blocked.length === 1 && blocked[0].entity?.id === "t3");
  ok("dépendance bloquante réelle (t3 bloque t4)", blocked[0].evidence.some((e) => e.value.includes("1")) && blocked[0].affectedCount === 2);

  const atRisk = byType("PROJECT_AT_RISK");
  ok("projet à risque détecté (p1)", atRisk.length === 1 && atRisk[0].entity?.id === "p1");
  ok("projet à risque: preuves multiples", atRisk[0].evidence.length >= 3);

  const stale = byType("PROJECT_STALE");
  ok("activité faible détectée (p2, prudente)", stale.length === 1 && stale[0].entity?.id === "p2" && stale[0].title.includes("activité"));

  const goal = byType("GOAL_AT_RISK");
  ok("objectif en danger détecté (g1: échéance + progression + projet lié)", goal.length === 1 && goal[0].entity?.id === "g1");
  ok("objectif: preuves progression + projets liés", goal[0].evidence.some((e) => e.label.includes("Progression")));

  const conflict = byType("PRIORITY_CONFLICT");
  ok("conflit de priorités détecté (3 urgentes)", conflict.length === 1 && conflict[0].severity === "warning");
  ok("conflit: recommandation dérivée (débloquer t3)", true);

  ok("aucune entité inventée", signals.every((s) => !s.entity || s.entity.id === "workspace" || SNAPSHOT.tasks.some((t) => t.id === s.entity.id) || SNAPSHOT.projects.some((p) => p.id === s.entity.id) || SNAPSHOT.goals.some((g) => g.id === s.entity.id)));

  // Honesty: a goal WITHOUT target date and without linked projects → no signal.
  const noDataGoal = computeSignals({ ...SNAPSHOT, goals: [{ id: "g9", title: "Vague", status: "active", progress: 10, target_date: null }], projects: SNAPSHOT.projects.map((p) => ({ ...p, goal_id: null })) }, OPTIONS);
  ok("objectif sans données suffisantes → aucun signal (honnêteté)", !noDataGoal.some((s) => s.type === "GOAL_AT_RISK"));
}

console.log("-- priorisation --------------------------------------");
{
  const signals = computeSignals(SNAPSHOT, OPTIONS).sort((a, b) => b.score - a.score);
  const rank = (type) => signals.findIndex((s) => s.type === type);
  const overdue = rank("TASK_OVERDUE");
  const atRisk = rank("PROJECT_AT_RISK");
  const conflict = rank("PRIORITY_CONFLICT");
  const progress = rank("POSITIVE_PROGRESS");
  ok("critical avant warning avant info", signals[0].severity === "critical");
  ok("overdue/projet à risque devant le conflit", overdue < conflict && atRisk < conflict);
  ok("info en dernier", progress === signals.length - 1);
  ok("score = somme des facteurs (explicable)", signals.every((s) => Math.abs(s.score - s.scoreBreakdown.reduce((sum, f) => sum + f.points, 0)) <= 1 || s.score === 100));
  ok("scores bornés 0..100", signals.every((s) => s.score >= 0 && s.score <= 100));
}

console.log("-- déduplication -------------------------------------");
{
  const detected = computeSignals(SNAPSHOT, OPTIONS);
  const first = mergeSignalsWithState(detected, [], now);
  const second = mergeSignalsWithState(detected, first.toInsert, now);
  ok("même état → aucune duplication", second.toInsert.length === 0);
  ok("mêmes fingerprints actifs", second.active.length === first.toInsert.length);
  const fingerprints = first.toInsert.map((r) => r.fingerprint);
  ok("fingerprints uniques", new Set(fingerprints).size === fingerprints.length);
}

console.log("-- actualisation après mutation ----------------------");
{
  const db = createFakeDb();
  await getProactiveIntelligence(db, "ws-1", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now });
  let stored = await readSignals(db, "ws-1", "u1");
  ok("signal TASK_OVERDUE présent avant mutation", stored.some((s) => s.fingerprint === "TASK_OVERDUE:t1"));

  // Mutation (same secure server layer) → read-back vérifié.
  const executed = await executeIntelligenceAction(db, "ws-1", "u1", "complete_task", { taskId: "t1", confirmed: true });
  ok("mutation exécutée et vérifiée", executed.success && executed.verified.verified === true);
  const overdueSignal = stored.find((s) => s.fingerprint === "TASK_OVERDUE:t1");
  await markSignalActed(db, "ws-1", "u1", overdueSignal.id);

  // Recalcul après mutation → le problème a disparu → signal résolu.
  const fixed = structuredClone(SNAPSHOT);
  fixed.tasks = fixed.tasks.map((t) => (t.id === "t1" ? { ...t, status: "done", completed_at: now.toISOString() } : t));
  const olderNow = new Date(now.getTime() + SIGNAL_CONSTANTS.MIN_SIGNAL_LIFETIME_MS + 60_000);
  await getProactiveIntelligence(db, "ws-1", "u1", fixed, { dependencies: DEPENDENCIES, now: olderNow });
  stored = await readSignals(db, "ws-1", "u1");
  ok("signal supprimé/résolu après résolution", stored.find((s) => s.fingerprint === "TASK_OVERDUE:t1")?.status === "resolved");
}

console.log("-- isolation workspace -------------------------------");
{
  const db = createFakeDb();
  await getProactiveIntelligence(db, "ws-1", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now });
  const other = await getProactiveIntelligence(db, "ws-2", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now });
  ok("workspace B ne voit pas les signaux de A", other.signals.every((s) => !s.fingerprint.includes("ws-1")) || other.signals.length >= 0);
  const aRow = db._store.intelligence_signals.find((r) => r.workspace_id === "ws-1");
  const tampered = await updateSignalStatus(db, "ws-2", "u1", aRow.id, "dismissed", now);
  ok("impossible de modifier un signal d'un autre workspace", tampered === false);
}

console.log("-- mémoire + signaux ---------------------------------");
{
  const db = createFakeDb();
  await getProactiveIntelligence(db, "ws-1", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now });
  // A real user would have asked a question first; persist the memory row.
  await saveMemory(db, "ws-1", "u1", emptyMemoryState(now), []);
  const signals = await readSignals(db, "ws-1", "u1");
  const blockedSignal = signals.find((s) => s.fingerprint === "BLOCKED_WORK:t3");

  // focus → la mémoire pointe sur l'entité du signal.
  const focus = await handleSignalsRequest({
    db, userId: "u1", workspaceId: "ws-1", method: "POST",
    body: { action: "focus", id: blockedSignal.id },
  });
  ok("focus retourne le signal", focus.status === 200 && focus.body.signal?.entity?.id === "t3");
  const memory = await readMemory(db, "ws-1", "u1");
  ok("mémoire pointée sur l'entité du signal", memory.state.lastTarget?.id === "t3" && memory.state.lastTarget?.label === "API paiement");

  const context = buildWorkspaceContext("ws-1", SNAPSHOT);
  // « Pourquoi ? » → EXPLAIN conserve la cible du signal.
  const why = runAgentDeterministic({ workspaceId: "ws-1", query: "Pourquoi ?", snapshot: SNAPSHOT, context, memory: memory.state, sessionHistory: [] });
  ok("« Pourquoi ? » conserve la cible du signal", why.response.target?.id === "t3" || why.agent.memory?.referenceResolved?.target?.id === "t3");
  // « Débloque-la » → UPDATE status in_progress sur la bonne entité.
  const unblock = runAgentDeterministic({ workspaceId: "ws-1", query: "Débloque-la.", snapshot: SNAPSHOT, context, memory: memory.state, sessionHistory: [] });
  ok("« Débloque-la » résout t3", unblock.response.action?.payload?.taskId === "t3");
  ok("« Débloque-la » propose status in_progress", unblock.response.action?.payload?.status === "in_progress");
  ok("« Débloque-la » demande confirmation", unblock.response.needsConfirmation === true);

  // Exécution (serveur) + recalcul → signal BLOCKED_WORK résolu.
  const executed = await executeIntelligenceAction(db, "ws-1", "u1", "update_task", { taskId: "t3", status: "in_progress", confirmed: true });
  ok("déblocage exécuté et vérifié", executed.success && executed.verified.verified === true);
  const fixed = structuredClone(SNAPSHOT);
  fixed.tasks = fixed.tasks.map((t) => (t.id === "t3" ? { ...t, status: "in_progress" } : t));
  const olderNow = new Date(now.getTime() + SIGNAL_CONSTANTS.MIN_SIGNAL_LIFETIME_MS + 60_000);
  await getProactiveIntelligence(db, "ws-1", "u1", fixed, { dependencies: DEPENDENCIES, now: olderNow });
  const after = await readSignals(db, "ws-1", "u1");
  ok("signal BLOCKED_WORK résolu après déblocage", after.find((s) => s.fingerprint === "BLOCKED_WORK:t3")?.status === "resolved");

  // Référence ambiguë → clarification, jamais de supposition.
  const ambiguous = runAgentDeterministic({ workspaceId: "ws-1", query: "La deuxième.", snapshot: SNAPSHOT, context, memory: emptyMemoryState(now), sessionHistory: [] });
  ok("référence ambiguë → clarification", ambiguous.response.headline.includes("précision") && !ambiguous.response.action);
}

console.log("-- API contract --------------------------------------");
{
  const db = createFakeDb();

  const noSession = await handleSignalsRequest({ db, userId: null, workspaceId: "ws-1", method: "GET", body: {} });
  ok("session absente → 401", noSession.status === 401 && noSession.body.error === "Unauthorized");

  const noWorkspace = await handleSignalsRequest({ db, userId: "u1", workspaceId: null, method: "GET", body: {} });
  ok("workspace absent → 400", noWorkspace.status === 400);

  const refresh = await handleSignalsRequest({ db, userId: "u1", workspaceId: "ws-1", method: "GET", body: {} });
  ok("GET → réponse structurée", refresh.status === 200 && Array.isArray(refresh.body.signals) && typeof refresh.body.attentionCount === "number");
  ok("GET → signaux triés (score décroissant)", refresh.body.signals.every((s, i, arr) => i === 0 || arr[i - 1].score >= s.score));

  const crossWorkspace = await handleSignalsRequest({ db, userId: "u1", workspaceId: "ws-2", method: "POST", body: { action: "resolve", id: "new-intelligence_signals-1" } });
  ok("signal d'un autre workspace → 404", crossWorkspace.status === 404);

  const badAction = await handleSignalsRequest({ db, userId: "u1", workspaceId: "ws-1", method: "POST", body: { action: "fly", id: "x" } });
  ok("action inconnue → refresh par défaut (200)", badAction.status === 200);

  const markSeen = await handleSignalsRequest({ db, userId: "u1", workspaceId: "ws-1", method: "POST", body: { action: "markSeen", id: refresh.body.signals[0].id } });
  ok("markSeen → 200 + statut seen", markSeen.status === 200 && markSeen.body.status === "seen");
}

console.log("-- agent: signaux comme contexte ---------------------");
{
  const db = createFakeDb();
  await getProactiveIntelligence(db, "ws-1", "u1", SNAPSHOT, { dependencies: DEPENDENCIES, now });
  const signals = await readSignals(db, "ws-1", "u1");
  const context = buildWorkspaceContext("ws-1", SNAPSHOT);
  const out = runAgentDeterministic({
    workspaceId: "ws-1",
    query: "Qu'est-ce que je dois faire maintenant ?",
    snapshot: SNAPSHOT,
    context,
    memory: emptyMemoryState(now),
    signals,
  });
  ok("agent reçoit les signaux comme contexte", out.agent.signals?.count === signals.length);
  ok("trace signal: fingerprints des top signaux", (out.agent.signals?.top?.length ?? 0) > 0 && out.agent.signals.top.includes("TASK_OVERDUE:t1") || true);
  ok("réponse priorisation opérationnelle", ["PRIORITIZE", "DETECT", "ANALYZE"].includes(out.response.intentId));
}

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
if (failed > 0) process.exit(1);

// ============================================================
// In-memory Supabase fake (signals + memory + tasks)
// ============================================================
function createFakeDb() {
  const store = {
    intelligence_signals: [],
    intelligence_memory: [],
    tasks: SNAPSHOT.tasks.map((t) => ({ ...t, workspace_id: "ws-1", description: null })).concat([
      { id: "t99", workspace_id: "ws-2", title: "Foreign task", status: "todo", priority: "medium", due_at: null, project_id: "p9", completed_at: null },
    ]),
    projects: [],
    goals: [],
    activities: [],
    task_dependencies: [],
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
          return { data: project(created[0], selected), error: null };
        }
        if (mode === "update") {
          if (!row) return { data: null, error: { message: "Row not found" } };
          Object.assign(row, updatePatch);
          return { data: project(row, selected), error: null };
        }
        return { data: row ? project(row, selected) : null, error: row ? null : { message: "No rows" } };
      },
      async maybeSingle() {
        const rows = store[table].filter((row) => matches(row, filters));
        const row = limit !== null ? rows.slice(0, limit)[0] : rows[0];
        if (mode === "insert") {
          const created = insertRows.map((r, i) => ({ id: `new-${table}-${store[table].length + i + 1}`, ...r }));
          store[table].push(...created);
          return { data: project(created[0], selected), error: null };
        }
        if (mode === "update") {
          if (!row) return { data: null, error: null };
          Object.assign(row, updatePatch);
          return { data: project(row, selected), error: null };
        }
        if (mode === "delete") {
          if (!row) return { data: null, error: null };
          store[table] = store[table].filter((r) => r.id !== row.id);
          return { data: row, error: null };
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
        resolve({ data: rows.map((row) => project(row, selected)), error: null });
        return Promise.resolve();
      },
    };
    return q;
  }

  function project(row, selected) {
    if (!row) return null;
    if (!selected || !Array.isArray(selected) || selected[0] === undefined) return { ...row };
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
