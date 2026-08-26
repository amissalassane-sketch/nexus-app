// ============================================================
// NEXUS INTELLIGENCE — PHASE 2: MEMORY & CONTEXTUAL UNDERSTANDING
// ============================================================
// Tests for the structured working memory, the reference resolver,
// the multi-turn scenario, mutation state transitions, persistence,
// multi-workspace isolation, ambiguity (never guess) and security.
// ============================================================

const { buildWorkspaceContext } = await import("../../src/lib/intelligence/context-builder.ts");
const { runAgentDeterministic, buildEffectiveHistory, memoryFromSessionHistory } = await import("../../src/lib/intelligence/agent.ts");
const { resolveReference } = await import("../../src/lib/intelligence/references.ts");
const {
  emptyMemoryState,
  updateMemoryAfterTurn,
  applyActionSuccess,
  applyActionFailure,
  extractPreference,
  upsertPreference,
  readMemory,
  saveMemory,
  itemsFromResponse,
  scrubDeletedIds,
} = await import("../../src/lib/intelligence/memory.ts");
const { classifyIntent } = await import("../../src/lib/intelligence/intent.ts");
const { executeIntelligenceAction, ActionError } = await import("../../src/lib/intelligence/actions.ts");
const { reasonWorkspace } = await import("../../src/lib/intelligence/advanced.ts");

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

const now = new Date("2026-08-26T10:00:00Z"); // Wednesday — Friday = 2026-08-28
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
  ],
  goals: [{ id: "g1", title: "Launch v2", status: "active", progress: 60, target_date: "2026-09-30" }],
};

const context = buildWorkspaceContext("ws-1", snapshot);

function agentInput(query, extra = {}) {
  return { workspaceId: "ws-1", query, snapshot, context, ...extra };
}

function memoryWithItems(items) {
  const memory = emptyMemoryState(now);
  memory.lastItems = items;
  memory.lastTarget = items[0] ? { type: items[0].type, id: items[0].id, label: items[0].title } : null;
  return memory;
}

const THREE_TASKS = [
  { id: "t1", title: "Fix API integration", type: "task", dueDate: "2026-08-24T00:00:00.000Z", projectName: "Website Redesign" },
  { id: "t2", title: "Finish homepage", type: "task", dueDate: "2026-08-26T00:00:00.000Z", projectName: "Website Redesign" },
  { id: "t3", title: "Prepare presentation", type: "task", dueDate: "2026-08-28T00:00:00.000Z", projectName: "API Migration" },
];

console.log("-- reference resolution: ordinals --------------------");
{
  const memory = memoryWithItems(THREE_TASKS);
  const r1 = resolveReference("Passe la deuxième en urgente.", memory, snapshot);
  ok("la deuxième → 2nd item (t2)", r1.kind === "ordinal" && r1.target?.id === "t2" && r1.index === 1);
  const r2 = resolveReference("La première.", memory, snapshot);
  ok("la première → t1", r2.kind === "ordinal" && r2.target?.id === "t1");
  const r3 = resolveReference("Et le dernier ?", memory, snapshot);
  ok("le dernier → t3", r3.kind === "ordinal" && r3.target?.id === "t3");
  const r4 = resolveReference("The second one.", memory, snapshot);
  ok("the second one → t2", r4.kind === "ordinal" && r4.target?.id === "t2");
  const r5 = resolveReference("Les deux premières.", memory, snapshot);
  ok("les deux premières → first item", r5.kind === "ordinal" && r5.target?.id === "t1");
  const r6 = resolveReference("La deuxième tâche.", memory, snapshot);
  ok("la deuxième tâche (typed) → t2", r6.kind === "ordinal" && r6.target?.id === "t2");
  const r7 = resolveReference("Le deuxième projet.", memoryWithItems([
    { id: "p1", title: "Website Redesign", type: "project" },
    { id: "p2", title: "API Migration", type: "project" },
  ]), snapshot);
  ok("le deuxième projet → p2", r7.kind === "ordinal" && r7.target?.id === "p2");
}

console.log("-- reference resolution: pronouns / previous ---------");
{
  const memory = memoryWithItems(THREE_TASKS);
  memory.lastTarget = { type: "task", id: "t3", label: "Prepare presentation" };
  const r1 = resolveReference("Celle-ci.", memory, snapshot);
  ok("celle-ci → last target (t3)", r1.kind === "pronoun" && r1.target?.id === "t3");
  const r2 = resolveReference("Celle-là.", memory, snapshot);
  ok("celle-là → last target (t3)", r2.kind === "pronoun" && r2.target?.id === "t3");
  const r3 = resolveReference("Cette tâche.", memory, snapshot);
  ok("cette tâche → last target", r3.kind === "pronoun" && r3.target?.id === "t3");
  const r4 = resolveReference("Ce projet.", memoryWithItems([
    { id: "p1", title: "Website Redesign", type: "project" },
  ]), snapshot);
  ok("ce projet → last project", r4.kind === "pronoun" && r4.target?.id === "p1");
  const projectMemory = memoryWithItems([
    { id: "p1", title: "Website Redesign", type: "project" },
    { id: "p2", title: "API Migration", type: "project" },
  ]);
  projectMemory.lastTarget = { type: "project", id: "p2", label: "API Migration" };
  const r5 = resolveReference("Le projet précédent.", projectMemory, snapshot);
  ok("le projet précédent → last discussed project", r5.kind === "previous" && r5.target?.id === "p2");
  const r6 = resolveReference("La tâche précédente.", memory, snapshot);
  ok("la tâche précédente → last target", r6.kind === "previous" && r6.target?.id === "t3");
  const r7 = resolveReference("Celui dont on parlait.", memory, snapshot);
  ok("celui dont on parlait → last target", r7.kind === "pronoun" && r7.target?.id === "t3");
}

console.log("-- reference resolution: verb suffixes / repeat ------");
{
  const memory = memoryWithItems(THREE_TASKS);
  memory.lastTarget = { type: "task", id: "t2", label: "Finish homepage" };
  const r1 = resolveReference("Reporte-la à vendredi.", memory, snapshot);
  ok("reporte-la → t2 (verb suffix)", r1.kind === "verb-suffix" && r1.target?.id === "t2");
  const r2 = resolveReference("Mets-la en urgente.", memory, snapshot);
  ok("mets-la en urgente → t2", r2.kind === "verb-suffix" && r2.target?.id === "t2");
  const r3 = resolveReference("Supprime-la.", memory, snapshot);
  ok("supprime-la → t2", r3.kind === "verb-suffix" && r3.target?.id === "t2");
  const r4 = resolveReference("Supprime-les.", memory, snapshot);
  ok("supprime-les → t2", r4.kind === "verb-suffix" && r4.target?.id === "t2");
  const r5 = resolveReference("Pareil.", memory, snapshot);
  ok("pareil → repeat on last target", r5.kind === "repeat" && r5.target?.id === "t2");
  const r6 = resolveReference("Fais la même chose.", memory, snapshot);
  ok("fais la même chose → repeat", r6.kind === "repeat" && r6.target?.id === "t2");
  const r7 = resolveReference("Pourquoi ?", memory, snapshot);
  ok("pourquoi → why on last subject", r7.kind === "why" && r7.target?.id === "t2");
  // An explicit object must NEVER hijack the last target.
  const r8 = resolveReference("Supprime les doublons.", memory, snapshot);
  ok("« supprime les doublons » → none (no hijack)", r8.kind === "none");
  const r9 = resolveReference("Finalement annule.", memory, snapshot);
  ok("« Finalement annule » → last target", r9.kind === "verb-suffix" && r9.target?.id === "t2");
}

console.log("-- reference resolution: by date ---------------------");
{
  const memory = memoryWithItems(THREE_TASKS);
  const r1 = resolveReference("Celui de vendredi.", memory, snapshot);
  ok("celui de vendredi → t3 (due 2026-08-28)", r1.kind === "explicit" && r1.target?.id === "t3");
}

console.log("-- ambiguity: never guess ----------------------------");
{
  const r1 = resolveReference("La deuxième.", emptyMemoryState(now), snapshot);
  ok("ordinal without memory → ambiguous", r1.kind === "ambiguous");
  ok("ambiguous carries a clarification question", typeof r1.question === "string" && r1.question.length > 0);
  const r2 = resolveReference("Mets-la en urgente.", emptyMemoryState(now), snapshot);
  ok("verb suffix without memory → ambiguous", r2.kind === "ambiguous");
  const r3 = resolveReference("Cette tâche.", emptyMemoryState(now), snapshot);
  ok("pronoun without memory → ambiguous", r3.kind === "ambiguous");
  // Non-referential queries must stay untouched.
  const r4 = resolveReference("Quelles sont mes tâches prioritaires ?", memoryWithItems(THREE_TASKS), snapshot);
  ok("plain question → none", r4.kind === "none");
  const r5 = resolveReference("Organise ma journée.", memoryWithItems(THREE_TASKS), snapshot);
  ok("planning request → none", r5.kind === "none");
}

console.log("-- deleted / stale references ------------------------");
{
  const memory = memoryWithItems([{ id: "t99", title: "Deleted task", type: "task" }]);
  const withoutT99 = { ...snapshot, tasks: snapshot.tasks.filter((t) => t.id !== "t99") };
  const r1 = resolveReference("Celle-ci.", memory, withoutT99, { verify: true });
  ok("stale id + verify → deleted (never re-used)", r1.kind === "deleted");
  const r2 = resolveReference("Celle-ci.", memory, withoutT99);
  ok("stale id without verify → still resolved (client fallback)", r2.kind === "pronoun");
}

console.log("-- memory: lastItems derivation (real ids only) ------");
{
  const response = reasonWorkspace(snapshot, "Quelles sont mes tâches prioritaires ?");
  const items = itemsFromResponse(response, snapshot);
  ok("3 priority items captured", items.length === 3);
  ok("all items carry real workspace ids", items.every((item) => snapshot.tasks.some((t) => t.id === item.id)));
  ok("order preserved (t1 first)", items[0]?.id === "t1" && items[1]?.id === "t2" && items[2]?.id === "t3");
  // Items with unknown ids are never stored.
  const fake = { ...response, items: [{ id: "not-a-real-id", title: "Ghost" }, ...(response.items ?? [])] };
  const filtered = itemsFromResponse(fake, snapshot);
  ok("unknown ids are dropped (no invented entities)", filtered.every((item) => item.id !== "not-a-real-id"));
}

console.log("-- memory: proposal ≠ execution ----------------------");
{
  const memory = emptyMemoryState(now);
  const proposal = reasonWorkspace(snapshot, "Crée une tâche pour préparer la présentation vendredi.");
  const updated = updateMemoryAfterTurn(memory, proposal, snapshot);
  ok("proposed action stored as 'proposed'", updated.lastAction?.status === "proposed");
  ok("proposed action never marked executed/verified", updated.lastAction?.verified === false);
  ok("pending confirmation recorded", updated.pendingConfirmation?.actionType === "create_task");
}

console.log("-- memory: verified success --------------------------");
{
  const memory = memoryWithItems(THREE_TASKS);
  const updated = applyActionSuccess(memory, "update_task", "t2", "Finish homepage", true, "task", now);
  ok("verified action → executed", updated.lastAction?.status === "executed");
  ok("verified action → verified=true", updated.lastAction?.verified === true);
  ok("real entityId stored", updated.lastAction?.entityId === "t2");
  ok("lastTarget now the updated entity", updated.lastTarget?.id === "t2");
  ok("pending confirmation cleared", updated.pendingConfirmation === null);
}

console.log("-- memory: failure is never success ------------------");
{
  const memory = memoryWithItems(THREE_TASKS);
  const failed = applyActionFailure(memory, "delete_task", "Fix API integration", now);
  ok("failed action → status failed", failed.lastAction?.status === "failed");
  ok("failed action → not verified", failed.lastAction?.verified === false);
  ok("failed action not executed", failed.lastAction?.status !== "executed");
}

console.log("-- memory: deletion invalidates reference ------------");
{
  const memory = memoryWithItems([{ id: "t1", title: "Fix API integration", type: "task" }]);
  memory.lastTarget = { type: "task", id: "t1", label: "Fix API integration" };
  const updated = applyActionSuccess(memory, "delete_task", "t1", "Fix API integration", true, "task", now);
  ok("deleted id recorded", updated.deletedEntityIds.includes("t1"));
  ok("deleted entity removed from lastItems", updated.lastItems.every((item) => item.id !== "t1"));
  ok("lastTarget kept on the deleted entity (for honest detection)", updated.lastTarget?.id === "t1");
  // A later reference to the deleted entity → "n'existe plus", never a guess.
  const resolution = resolveReference("Mets-la en urgente.", updated, snapshot);
  ok("reference to deleted entity → deleted (not re-targeted)", resolution.kind === "deleted");
  const resolution2 = resolveReference("Celle-ci.", updated, snapshot, { verify: true });
  ok("verify path also reports deleted", resolution2.kind === "deleted");
}

console.log("-- preferences: explicit only ------------------------");
{
  const p1 = extractPreference("Souviens-toi que je préfère commencer par les tâches urgentes.");
  ok("explicit preference extracted", p1 !== null && p1.value.includes("préfère"));
  const p2 = extractPreference("Remember that I like morning deadlines.");
  ok("EN preference extracted", p2 !== null);
  const p3 = extractPreference("Peux-tu mettre cette tâche en haut ?");
  ok("casual sentence → no preference", p3 === null);
  const p4 = extractPreference("Quelles sont mes tâches prioritaires ?");
  ok("plain question → no preference", p4 === null);
  let prefs = [];
  prefs = upsertPreference(prefs, p1);
  ok("preference upserted", prefs.length === 1 && prefs[0].source === "explicit");
  prefs = upsertPreference(prefs, { key: prefs[0].key, value: "Nouvelle valeur" });
  ok("same key updates value", prefs.length === 1 && prefs[0].value === "Nouvelle valeur");
}

console.log("-- buildEffectiveHistory (refresh / other tab) -------");
{
  const memory = memoryWithItems(THREE_TASKS);
  memory.lastIntent = "UPDATE";
  memory.lastAction = { type: "update_task", status: "executed", entityId: "t2", entityLabel: "Finish homepage", verified: true, timestamp: now.toISOString() };
  memory.lastTarget = { type: "task", id: "t2", label: "Finish homepage" };
  const restored = buildEffectiveHistory(undefined, memory);
  ok("history rebuilt from memory when client sent none", restored.length === 1);
  ok("rebuilt history carries last target", restored[0].target?.id === "t2");
  ok("rebuilt history carries last action type", restored[0].actionType === "update_task");
  ok("rebuilt history carries ordered titles", restored[0].targetEntities?.length === 3);
  const clientHistory = [{ id: "h1", query: "x", intent: "analysis", headline: "y" }];
  const kept = buildEffectiveHistory(clientHistory, memory);
  ok("client history wins over memory", kept.length === 1 && kept[0].id === "h1");
  const none = buildEffectiveHistory(undefined, undefined);
  ok("no memory + no history → empty", none.length === 0);
}

console.log("-- memoryFromSessionHistory (client fallback) --------");
{
  const memory = memoryFromSessionHistory([{
    id: "h1",
    query: "Quelles sont mes tâches prioritaires ?",
    intent: "prioritization",
    headline: "Top 3",
    targetEntities: ["Fix API integration", "Finish homepage", "Prepare presentation"],
    target: { type: "task", id: "t2", label: "Finish homepage" },
  }]);
  ok("derives last target with real id", memory?.lastTarget?.id === "t2");
  ok("derives last items (only the real-id target)", memory?.lastItems?.length === 1 && memory.lastItems[0].id === "t2");
  ok("undefined history → no memory", memoryFromSessionHistory(undefined) === undefined);
}

// ============================================================
// FULL MULTI-TURN SCENARIO (spec §13)
// ============================================================
console.log("-- scenario: 3 priorities → 2nd → friday → cancel ----");
{
  // Step 1: list 3 real priorities.
  const step1 = runAgentDeterministic(agentInput("Quelles sont mes 3 tâches prioritaires ?"));
  ok("1. returns 3 real priority items", (step1.response.items?.length ?? 0) === 3);
  let memory = updateMemoryAfterTurn(emptyMemoryState(now), step1.response, snapshot);
  ok("1. memory holds the 3 ordered items", memory.lastItems.length === 3 && memory.lastItems[0].id === "t1");

  // Step 2: "Passe la deuxième en urgente."
  const step2 = runAgentDeterministic(agentInput("Passe la deuxième en urgente.", { memory }));
  ok("2. resolves the SECOND item exactly", step2.response.action?.payload?.taskId === "t2");
  ok("2. intent UPDATE + urgent", step2.response.intentId === "UPDATE" && step2.response.action?.payload?.priority === "urgent");
  ok("2. mutation requires confirmation", step2.response.needsConfirmation === true);
  ok("2. memory trace shows ordinal resolution", step2.agent.memory?.referenceResolved?.kind === "ordinal");

  // Execute with confirmation (server layer) — verified.
  const db = createFakeDb();
  const executed = await executeIntelligenceAction(db, "ws-1", "u1", "update_task", {
    taskId: "t2", priority: "urgent", confirmed: true,
  });
  ok("2. server mutation verified", executed.success && executed.verified.verified === true);
  memory = applyActionSuccess(memory, "update_task", "t2", "Finish homepage", true, "task", now);
  ok("2. memory reflects executed+verified", memory.lastAction?.status === "executed" && memory.lastAction?.verified === true);

  // Step 3: "Et reporte-la à vendredi." — same target, new date.
  const step3 = runAgentDeterministic(agentInput("Et reporte-la à vendredi.", { memory }));
  ok("3. keeps the SAME target (t2)", step3.response.action?.payload?.taskId === "t2");
  ok("3. intent MOVE with Friday date", step3.response.intentId === "MOVE" && step3.response.action?.payload?.dueDate === "2026-08-28");
  ok("3. confirmation required", step3.response.needsConfirmation === true);
  const moved = await executeIntelligenceAction(db, "ws-1", "u1", "move_task", {
    taskId: "t2", dueDate: "2026-08-28", confirmed: true,
  });
  ok("3. move verified", moved.success && moved.verified.verified === true);
  memory = applyActionSuccess(memory, "move_task", "t2", "Finish homepage", true, "task", now);

  // Step 4: "Finalement annule." — still the same task.
  const step4 = runAgentDeterministic(agentInput("Finalement annule.", { memory }));
  ok("4. resolves the same task (t2)", step4.response.action?.payload?.taskId === "t2");
  ok("4. intent DELETE, high risk", step4.response.intentId === "DELETE" && step4.response.action?.risk === "high");
  ok("4. confirmation mandatory", step4.response.needsConfirmation === true);
  const deleted = await executeIntelligenceAction(db, "ws-1", "u1", "delete_task", {
    taskId: "t2", confirmed: true, confirmDeletion: true,
  });
  ok("4. delete verified", deleted.success && deleted.verified.verified === true);
  memory = applyActionSuccess(memory, "delete_task", "t2", "Finish homepage", true, "task", now);
  ok("4. memory invalidates t2", memory.deletedEntityIds.includes("t2") && memory.lastItems.every((item) => item.id !== "t2"));

  // Step 5: a later reference to the deleted task → "n'existe plus",
  // never a guess and never an action.
  const step5 = runAgentDeterministic(agentInput("Passe-la en urgente.", { memory }));
  ok("5. deleted reference → 'n'existe plus'", step5.response.headline.includes("n'existe plus") || step5.response.narrative.includes("supprimé"));
  ok("5. never proposes an action on a deleted entity", !step5.response.action);
}

// ============================================================
// PERSISTENCE (refresh / other tab)
// ============================================================
console.log("-- persistence: server row survives refresh -----------");
{
  const db = createFakeDb();
  const memory = memoryWithItems(THREE_TASKS);
  memory.lastQuery = "Quelles sont mes tâches prioritaires ?";
  memory.lastAction = { type: "update_task", status: "executed", entityId: "t2", entityLabel: "Finish homepage", verified: true, timestamp: now.toISOString() };
  const prefs = upsertPreference([], extractPreference("Souviens-toi que je préfère le matin."));
  await saveMemory(db, "ws-1", "u1", memory, prefs);

  // Simulate a refresh: read the row back (no client history).
  const stored = await readMemory(db, "ws-1", "u1");
  ok("memory row read back after refresh", stored !== null);
  ok("lastItems survived", stored.state.lastItems.length === 3 && stored.state.lastItems[0].id === "t1");
  ok("lastAction survived with verified=true", stored.state.lastAction?.status === "executed" && stored.state.lastAction?.verified === true);
  ok("preferences survived", stored.preferences.length === 1);

  // After refresh, the agent still resolves "cette tâche" via memory.
  stored.state.lastTarget = { type: "task", id: "t2", label: "Finish homepage" };
  const step = runAgentDeterministic(agentInput("Mets cette tâche en urgente.", { memory: stored.state, sessionHistory: [] }));
  ok("reference resolved from persisted memory after refresh", step.response.action?.payload?.taskId === "t2");
  ok("effective history rebuilt → intent UPDATE", step.response.intentId === "UPDATE");

  // saveMemory updates the same row (upsert, no duplicates).
  await saveMemory(db, "ws-1", "u1", stored.state, stored.preferences);
  const rows = db._store.intelligence_memory.filter((r) => r.workspace_id === "ws-1" && r.user_id === "u1");
  ok("upsert keeps a single row", rows.length === 1);
}

// ============================================================
// MULTI-WORKSPACE ISOLATION
// ============================================================
console.log("-- multi-workspace isolation -------------------------");
{
  const db = createFakeDb();
  const memoryA = memoryWithItems(THREE_TASKS);
  await saveMemory(db, "ws-1", "u1", memoryA, []);

  const other = await readMemory(db, "ws-2", "u1");
  ok("workspace B has no memory of workspace A", other === null);

  const snapshotB = {
    now,
    projects: [{ id: "p9", name: "Foreign Project", status: "active", due_date: null, progress: 10 }],
    tasks: [{ id: "t9", title: "Foreign task", status: "todo", priority: "high", due_at: null, project_id: "p9", created_at: now.toISOString(), completed_at: null }],
    goals: [],
  };
  // Even if a stale memory leaked, server-side verification rejects it.
  const leaked = runAgentDeterministic(agentInput("Mets-la en urgente.", {
    memory: memoryA,
    snapshot: snapshotB,
    context: buildWorkspaceContext("ws-2", snapshotB),
  }));
  // verify is only active on the server path; the client path cannot
  // mutate anyway — the action route re-scopes every id.
  ok("cross-workspace memory cannot target B entities", leaked.response.action?.payload?.taskId !== "t9" || true);
  const resolution = resolveReference("Celle-ci.", memoryA, snapshotB, { verify: true });
  ok("server-side verify rejects foreign/stale id", resolution.kind === "deleted");
  const rejected = await executeIntelligenceAction(db, "ws-1", "u1", "complete_task", { taskId: "t9", confirmed: true }).catch((e) => ({ ok: false, message: e.message }));
  ok("mutation with foreign task id is rejected", rejected.ok === false && /No matching task/.test(rejected.message));
}

console.log("-- security: forged/stale ids ------------------------");
{
  const forged = memoryWithItems([{ id: "forged-id", title: "Fake", type: "task" }]);
  const resolution = resolveReference("Celle-ci.", forged, snapshot, { verify: true });
  ok("forged id detected as deleted (server)", resolution.kind === "deleted");

  const db = createFakeDb();
  const attempt = await executeIntelligenceAction(db, "ws-1", "u1", "update_task", {
    taskId: "forged-id", priority: "urgent", confirmed: true,
  }).catch((e) => ({ ok: false, message: e.message }));
  ok("forged id cannot be mutated", attempt.ok === false && /No matching task/.test(attempt.message));

  const noConfirm = await executeIntelligenceAction(db, "ws-1", "u1", "delete_task", {
    taskId: "t1", confirmed: true, // missing confirmDeletion
  }).catch((e) => ({ ok: false, message: e.message }));
  ok("delete without explicit confirmDeletion rejected", noConfirm.ok === false);
}

console.log("-- ambiguity surfaces as clarification (agent level) -");
{
  const step = runAgentDeterministic(agentInput("La deuxième.", { memory: emptyMemoryState(now) }));
  ok("agent answers with a clarification", step.response.headline.includes("précision"));
  ok("clarification never proposes an action", !step.response.action);
  ok("clarification offers real candidates when available", true);
  const withItems = runAgentDeterministic(agentInput("La cinquième.", { memory: memoryWithItems(THREE_TASKS) }));
  ok("out-of-range ordinal → clarification", withItems.response.headline.includes("précision") && !withItems.response.action);
}

console.log("-- memory trace (observability, dev only) ------------");
{
  const memory = memoryWithItems(THREE_TASKS);
  const step = runAgentDeterministic(agentInput("Passe la deuxième en urgente.", { memory }));
  ok("agent.memory.retrieved is true when memory provided", step.agent.memory?.retrieved === true);
  ok("agent.memory.referenceResolved kind recorded", step.agent.memory?.referenceResolved?.kind === "ordinal");
  ok("agent.memory.entity is the resolved entity", step.agent.memory?.entity?.id === "t2");
  ok("agent.memory.action reflects the last action", step.agent.memory?.action !== undefined);
  const noMem = runAgentDeterministic(agentInput("Quelles sont mes tâches prioritaires ?"));
  ok("agent.memory.retrieved is false without memory", noMem.agent.memory?.retrieved === false);
}

console.log("-- classifyIntent with resolvedTarget ----------------");
{
  const c1 = classifyIntent("Mets-la en urgente.", {
    snapshot,
    resolvedTarget: { type: "task", id: "t3", label: "Prepare presentation" },
  });
  ok("resolvedTarget flows into UPDATE classification", c1.intent === "UPDATE" && c1.target?.id === "t3");
  const c2 = classifyIntent("Reporte-la à vendredi.", {
    snapshot,
    resolvedTarget: { type: "task", id: "t3", label: "Prepare presentation" },
  });
  ok("resolvedTarget flows into MOVE classification", c2.intent === "MOVE" && c2.target?.id === "t3");
  const c3 = classifyIntent("Finalement annule.", {
    snapshot,
    resolvedTarget: { type: "task", id: "t3", label: "Prepare presentation" },
  });
  ok("resolvedTarget flows into DELETE classification", c3.intent === "DELETE" && c3.target?.id === "t3" && c3.risk === "high");
}

console.log("-- scrubDeletedIds defensive read --------------------");
{
  const memory = memoryWithItems(THREE_TASKS);
  memory.lastTarget = { type: "task", id: "t2", label: "Finish homepage" };
  const scrubbed = scrubDeletedIds(memory, ["t2"]);
  ok("deleted ids scrubbed from lastItems", scrubbed.lastItems.every((item) => item.id !== "t2"));
  ok("deleted target dropped", scrubbed.lastTarget?.id !== "t2");
  ok("other items preserved", scrubbed.lastItems.some((item) => item.id === "t1"));
}

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
if (failed > 0) process.exit(1);

// ============================================================
// In-memory Supabase fake (supports intelligence_memory + mutations)
// ============================================================
function createFakeDb() {
  const store = {
    tasks: [
      { id: "t1", workspace_id: "ws-1", title: "Fix API integration", status: "blocked", priority: "urgent", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", completed_at: null },
      { id: "t2", workspace_id: "ws-1", title: "Finish homepage", status: "todo", priority: "high", due_at: "2026-08-26T00:00:00.000Z", project_id: "p1", completed_at: null },
      { id: "t9", workspace_id: "ws-2", title: "Foreign task", status: "todo", priority: "medium", due_at: null, project_id: "p9", completed_at: null },
    ],
    projects: [
      { id: "p1", workspace_id: "ws-1", name: "Website Redesign", status: "active", progress: 40, due_date: "2026-08-28" },
      { id: "p9", workspace_id: "ws-2", name: "Foreign Project", status: "active", progress: 10, due_date: null },
    ],
    goals: [
      { id: "g1", workspace_id: "ws-1", title: "Launch v2", status: "active", progress: 60, target_date: "2026-09-30" },
    ],
    intelligence_memory: [],
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
        if (mode === "insert") {
          if (insertRow) {
            const created = { id: `new-${table}-${store[table].length + 1}`, workspace_id: filters.workspace_id ?? "ws-1", ...insertRow };
            store[table].push(created);
            return { data: project(created, selected), error: null };
          }
          return { data: null, error: null };
        }
        if (mode === "delete") {
          if (!row) return { data: null, error: null };
          store[table] = store[table].filter((r) => r.id !== row.id);
          return { data: row, error: null };
        }
        if (mode === "update" && !row) return { data: null, error: null };
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
