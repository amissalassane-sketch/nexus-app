// ============================================================
// NEXUS INTELLIGENCE — PHASE 4: MISSION ENGINE
// ============================================================
// Covers: creation, decomposition, dependencies, ordering,
// progress, nextBestAction, blocked/waiting/completed-after-read-back,
// failed mutation, mission failed/cancelled, resume after refresh,
// workspace isolation, forged ids, signal↔mission, Phase 2 memory
// compatibility, confirmation-gated and destructive actions, bounded
// loop, no hallucination, full multi-step scenario.
// ============================================================

const { buildWorkspaceContext } = await import("../../src/lib/intelligence/context-builder.ts");
const {
  detectMissionRequest,
  createMissionObject,
  findRelatedEntities,
  recomputeMission,
  runMissionLoop,
  computeNextBestAction,
  applyVerifiedActionToStep,
  readMission,
  readActiveMissions,
  saveMission,
  cancelMission,
  recomputeWorkspaceMissions,
} = await import("../../src/lib/intelligence/mission.ts");
const { executeIntelligenceAction } = await import("../../src/lib/intelligence/actions.ts");
const { readMemory, saveMemory, emptyMemoryState } = await import("../../src/lib/intelligence/memory.ts");

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

const now = new Date("2026-08-26T10:00:00Z"); // mercredi — vendredi = 2026-08-28
const SNAPSHOT = {
  now,
  projects: [{ id: "p1", name: "Refonte du site", status: "active", due_date: "2026-08-28", progress: 30, updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-01T09:00:00Z" }],
  tasks: [
    { id: "t1", title: "Préparer la présentation", status: "todo", priority: "high", due_at: "2026-08-28T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-10T09:00:00Z", completed_at: null },
    { id: "t2", title: "Finaliser les slides de la présentation", status: "blocked", priority: "high", due_at: "2026-08-27T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-11T09:00:00Z", completed_at: null },
    { id: "t3", title: "Rapport mensuel", status: "todo", priority: "low", due_at: "2026-09-02T00:00:00.000Z", project_id: null, updated_at: "2026-08-20T09:00:00Z", created_at: "2026-08-15T09:00:00Z", completed_at: null },
  ],
  goals: [],
};
const context = buildWorkspaceContext("ws-1", SNAPSHOT);

const QUERY = "Prépare-moi pour ma présentation de vendredi";

function buildMission() {
  const request = detectMissionRequest(QUERY, now);
  const related = findRelatedEntities(SNAPSHOT, request.keyword);
  return createMissionObject(request, "ws-1", "u1", SNAPSHOT, related, now);
}

console.log("-- detection & creation -----------------------------");
{
  const request = detectMissionRequest(QUERY, now);
  ok("mission request detected", request !== null);
  ok("keyword extracted (présentation)", request.keyword === "présentation" || request.keyword === "presentation");
  ok("deadline = vendredi (2026-08-28)", request.deadline === "2026-08-28");
  ok("kind = prepare", request.kind === "prepare");
  ok("plain question → no mission", detectMissionRequest("Quelles sont mes tâches prioritaires ?", now) === null);
  ok("single action → no mission", detectMissionRequest("Crée une tâche pour demain.", now) === null);
}

console.log("-- decomposition & dependencies ---------------------");
{
  const mission = buildMission();
  ok("5 steps created", mission.steps.length === 5);
  ok("steps ordered 1..5", mission.steps.every((s, i) => s.order === i + 1));
  ok("step-1 has no dependencies", mission.steps[0].dependencies.length === 0);
  ok("step-2 depends on step-1", mission.steps[1].dependencies.includes("step-1"));
  ok("step-5 depends on step-4", mission.steps[4].dependencies.includes("step-4"));
  ok("no invented entities in related", mission.context.relatedTaskIds.every((id) => SNAPSHOT.tasks.some((t) => t.id === id)));
  ok("related finds the 2 presentation tasks", mission.context.relatedTaskIds.length === 2);
  ok("blocked related task recorded", mission.context.blockerTaskIds.includes("t2"));
}

console.log("-- initial evaluation (recompute) -------------------");
{
  const mission = buildMission();
  ok("step-1 completed (tasks exist)", mission.steps[0].status === "completed");
  ok("step-2 blocked (t2 blocked)", mission.steps[1].status === "blocked");
  ok("step-3 completed (linked tasks are dated)", mission.steps[2].status === "completed");
  ok("mission blocked when a step is blocked", mission.status === "blocked");
  ok("nextBestAction proposes unblock", mission.nextBestAction?.kind === "mutate" && mission.nextBestAction.label.includes("Débloquer"));
  ok("nextBestAction references the real blocked task", mission.nextBestAction?.action?.payload?.taskId === "t2");
  ok("progress computed", mission.progress >= 0 && mission.progress <= 100);
}

console.log("-- unblock → re-evaluate → ready chain ---------------");
{
  const mission = buildMission();
  // Simulate the verified unblock mutation (server layer).
  const db = createFakeDb();
  const executed = await executeIntelligenceAction(db, "ws-1", "u1", "update_task", { taskId: "t2", status: "in_progress", confirmed: true });
  ok("unblock mutation verified", executed.success && executed.verified.verified === true);

  const snapshot = structuredClone(SNAPSHOT);
  snapshot.tasks = snapshot.tasks.map((t) => (t.id === "t2" ? { ...t, status: "in_progress" } : t));
  const re = runMissionLoop(mission, snapshot);
  console.error("DEBUG steps:", re.steps.map((s) => `${s.id}:${s.status}`).join(","));
  console.error("DEBUG NBA:", JSON.stringify(re.nextBestAction));
  ok("step-2 completed after unblock (no_linked_blocked)", re.steps[1].status === "completed");
  ok("step-4 ready when plan exists", re.steps[3].status === "ready" || re.steps[3].status === "completed");
  ok("step-5 ready → nextBestAction = complete t1", re.steps[4].status === "ready" && re.nextBestAction?.action?.payload?.taskId === "t1");
  ok("mission active again", re.status === "active");
}

console.log("-- completed after verified read-back (never by LLM) -");
{
  const mission = buildMission();
  const snapshot = structuredClone(SNAPSHOT);
  snapshot.tasks = snapshot.tasks.map((t) => (t.id === "t2" ? { ...t, status: "in_progress" } : t));
  const unblocked = runMissionLoop(mission, snapshot);

  // Verified mutation on step-5's target → completed.
  const db = createFakeDb();
  const executed = await executeIntelligenceAction(db, "ws-1", "u1", "complete_task", { taskId: "t1", confirmed: true });
  const applied = applyVerifiedActionToStep(unblocked, "step-5", {
    verified: executed.verified.verified,
    matched: executed.verified.matched,
    summary: executed.verified.summary,
  });
  ok("verified read-back → step completed", applied.steps.find((s) => s.id === "step-5")?.status === "completed");
  ok("verification stored on the step", applied.steps.find((s) => s.id === "step-5")?.verification?.verified === true);

  const snapshotDone = structuredClone(snapshot);
  snapshotDone.tasks = snapshotDone.tasks.map((t) => (t.id === "t1" ? { ...t, status: "done", completed_at: now.toISOString() } : t));
  const final = runMissionLoop(applied, snapshotDone);
  ok("all steps done → mission completed", final.status === "completed" && final.progress === 100);
}

console.log("-- failed mutation → step failed → mission failed ----");
{
  const mission = buildMission();
  const failed = applyVerifiedActionToStep(mission, "step-5", {
    verified: false,
    matched: [],
    summary: "Task could not be verified",
  });
  ok("failed verification → step failed", failed.steps.find((s) => s.id === "step-5")?.status === "failed");
  ok("failed step never completed", failed.steps.find((s) => s.id === "step-5")?.status !== "completed");
  const re = runMissionLoop(failed, SNAPSHOT);
  ok("mission failed when a step failed", re.status === "failed");
}

console.log("-- persistence & resume after refresh ----------------");
{
  const db = createFakeDb();
  const mission = buildMission();
  await saveMission(db, mission);
  const restored = await readMission(db, "ws-1", "u1", mission.id);
  ok("mission read back after save", restored !== null);
  ok("steps preserved", restored.steps.length === 5);
  ok("context preserved (related ids)", restored.context.relatedTaskIds.includes("t1"));
  ok("status preserved", restored.status === mission.status);
  const active = await readActiveMissions(db, "ws-1", "u1");
  ok("active missions listed", active.length === 1 && active[0].id === mission.id);
}

console.log("-- isolation workspace -------------------------------");
{
  const db = createFakeDb();
  const mission = buildMission();
  await saveMission(db, mission);
  const other = await readMission(db, "ws-2", "u1", mission.id);
  ok("mission of workspace A invisible in B", other === null);
  const otherUser = await readMission(db, "ws-1", "u2", mission.id);
  ok("mission of user A invisible to user B", otherUser === null);
  const forged = await readMission(db, "ws-1", "u1", "forged-id");
  ok("forged id → null", forged === null);
  const cancelled = await cancelMission(db, "ws-1", "u1", mission.id);
  ok("cancel works for the owner", cancelled === true);
  const crossCancel = await cancelMission(db, "ws-2", "u1", mission.id);
  ok("cannot cancel a mission of another workspace", crossCancel === false);
}

console.log("-- signal ↔ mission (Phase 3 link) -------------------");
{
  const mission = buildMission();
  const signal = {
    id: "s1",
    fingerprint: "BLOCKED_WORK:t2",
    type: "BLOCKED_WORK",
    severity: "critical",
    title: "« Finaliser les slides de la présentation » est bloquée",
    summary: "bloquée",
    evidence: [],
    scoreBreakdown: [],
    suggestedActions: [],
    entityType: "task",
    entityId: "t2",
    entityLabel: "Finaliser les slides de la présentation",
    score: 80,
    confidence: 0.9,
    affectedCount: 1,
    status: "new",
    createdAt: now.toISOString(),
    seenAt: null,
    dismissedAt: null,
    resolvedAt: null,
  };
  const re = recomputeMission(mission, SNAPSHOT, [signal], now);
  ok("signal context attached to mission", re.context.signals.length >= 1 && re.context.signals[0].type === "BLOCKED_WORK");
  const resolvedSignal = { ...signal, status: "resolved" };
  const snapshotFixed = structuredClone(SNAPSHOT);
  snapshotFixed.tasks = snapshotFixed.tasks.map((t) => (t.id === "t2" ? { ...t, status: "in_progress" } : t));
  const after = recomputeMission(re, snapshotFixed, [resolvedSignal], now);
  ok("mission re-evaluated when signal resolved", after.steps[1].status === "completed");
}

console.log("-- Phase 2 memory compatibility ----------------------");
{
  const db = createFakeDb();
  await saveMemory(db, "ws-1", "u1", emptyMemoryState(now), []);
  const mission = buildMission();
  await saveMission(db, mission);
  // The query route links lastMissionId in memory; simulate it.
  const stored = await readMemory(db, "ws-1", "u1");
  const updated = { ...stored.state, lastMissionId: mission.id, updatedAt: now.toISOString() };
  await saveMemory(db, "ws-1", "u1", updated, stored.preferences);
  const again = await readMemory(db, "ws-1", "u1");
  ok("memory.lastMissionId persisted", again.state.lastMissionId === mission.id);
  ok("memory state still valid (lastItems etc.)", Array.isArray(again.state.lastItems));
}

console.log("-- confirmation & destructive actions ----------------");
{
  const mission = buildMission();
  const mutateStep = mission.steps.find((s) => s.action?.confirmationRequired === true);
  ok("mutation step is confirmation-gated", Boolean(mutateStep));
  const step5 = mission.steps.find((s) => s.id === "step-5");
  ok("step-5 complete_task is confirmation-gated", step5.action?.confirmationRequired === true);
  // A destructive action attached to a mission step still requires confirmDeletion.
  const db = createFakeDb();
  const rejected = await executeIntelligenceAction(db, "ws-1", "u1", "delete_task", { taskId: "t1", confirmed: true }).catch((e) => ({ ok: false, message: e.message }));
  ok("destructive action without confirmDeletion rejected", rejected.ok === false);
}

console.log("-- bounded loop --------------------------------------");
{
  const mission = buildMission();
  // A snapshot where nothing changes → the loop must terminate quickly.
  const re = runMissionLoop(mission, SNAPSHOT, undefined, 3);
  ok("bounded loop terminates", re.steps.length === 5);
  const re2 = runMissionLoop(mission, SNAPSHOT, undefined, 20);
  ok("loop stable regardless of max iterations", JSON.stringify(re2.steps.map((s) => [s.id, s.status])) === JSON.stringify(re.steps.map((s) => [s.id, s.status])));
}

console.log("-- no hallucination ----------------------------------");
{
  const mission = buildMission();
  const json = JSON.stringify(mission);
  ok("no invented project in mission", !json.includes("Nonexistent"));
  ok("no fabricated deadline", !json.includes("2099-"));
  const related = findRelatedEntities(SNAPSHOT, "projet-inexistant");
  ok("unknown keyword → no related entities", related.taskIds.length === 0 && related.projectIds.length === 0);
}

console.log("-- full multi-step scenario --------------------------");
{
  const db = createFakeDb();
  // 1. Create.
  const request = detectMissionRequest(QUERY, now);
  const related = findRelatedEntities(SNAPSHOT, request.keyword);
  let mission = createMissionObject(request, "ws-1", "u1", SNAPSHOT, related, now);
  mission = runMissionLoop(mission, SNAPSHOT);
  await saveMission(db, mission);
  ok("1. mission created + persisted", (await readMission(db, "ws-1", "u1", mission.id)) !== null);
  ok("2. mission blocked at start (blocked slide task)", mission.status === "blocked");

  // 3. Next best action = unblock t2 (mutate, confirmation required).
  ok("3. nextBestAction proposes unblock with confirmation", mission.nextBestAction?.kind === "mutate" && mission.nextBestAction.action?.confirmationRequired === true);

  // 4. Execute the unblock via the secure server layer.
  const unblockAction = mission.nextBestAction.action;
  const executed = await executeIntelligenceAction(db, "ws-1", "u1", unblockAction.type, {
    ...unblockAction.payload,
    confirmed: true,
  });
  ok("4. unblock executed + verified", executed.success && executed.verified.verified === true);

  // 5. Re-evaluate with the fixed snapshot.
  const snapshot1 = structuredClone(SNAPSHOT);
  snapshot1.tasks = snapshot1.tasks.map((t) => (t.id === "t2" ? { ...t, status: "in_progress" } : t));
  mission = runMissionLoop(mission, snapshot1);
  ok("5. mission active again, next action = complete t1", mission.nextBestAction?.action?.payload?.taskId === "t1");

  // 6. Continue → complete t1 (verified).
  const completeAction = mission.nextBestAction.action;
  const executed2 = await executeIntelligenceAction(db, "ws-1", "u1", completeAction.type, { ...completeAction.payload, confirmed: true });
  ok("6. complete executed + verified", executed2.success && executed2.verified.verified === true);
  mission = applyVerifiedActionToStep(mission, mission.nextBestAction.stepId, {
    verified: executed2.verified.verified,
    matched: executed2.verified.matched,
    summary: executed2.verified.summary,
  });

  // 7. Final re-evaluation → mission completed.
  const snapshot2 = structuredClone(snapshot1);
  snapshot2.tasks = snapshot2.tasks.map((t) => (t.id === "t1" ? { ...t, status: "done", completed_at: now.toISOString() } : t));
  mission = runMissionLoop(mission, snapshot2);
  ok("7. mission completed after all steps verified", mission.status === "completed" && mission.progress === 100);
  ok("8. no next best action when completed", mission.nextBestAction === null);
}

console.log("-- recomputeWorkspaceMissions (after mutation) -------");
{
  const db = createFakeDb();
  const mission = buildMission();
  await saveMission(db, mission);
  const snapshotFixed = structuredClone(SNAPSHOT);
  snapshotFixed.tasks = snapshotFixed.tasks.map((t) => (t.id === "t2" ? { ...t, status: "in_progress" } : t));
  const updated = await recomputeWorkspaceMissions(db, "ws-1", "u1", snapshotFixed);
  ok("workspace missions recomputed", updated.length === 1 && updated[0].steps[1].status === "completed");
  const restored = await readMission(db, "ws-1", "u1", mission.id);
  ok("recompute persisted", restored.steps[1].status === "completed");
}

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
if (failed > 0) process.exit(1);

// ============================================================
// In-memory Supabase fake (missions + memory + tasks)
// ============================================================
function createFakeDb() {
  const store = {
    intelligence_missions: [],
    intelligence_memory: [],
    tasks: SNAPSHOT.tasks.map((t) => ({ ...t, workspace_id: "ws-1", description: null })).concat([
      { id: "t99", workspace_id: "ws-2", title: "Foreign task", status: "todo", priority: "medium", due_at: null, project_id: null, completed_at: null },
    ]),
    projects: SNAPSHOT.projects.map((p) => ({ ...p, workspace_id: "ws-1" })),
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
      in(col, vals) { filters[col] = (value) => vals.includes(value); return q; },
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
        if (mode === "delete") {
          if (!row) return { data: null, error: { message: "Row not found" } };
          store[table] = store[table].filter((r) => r.id !== row.id);
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
    if (!selected || !Array.isArray(selected) || selected[0] === undefined || selected[0] === "*") return { ...row };
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
