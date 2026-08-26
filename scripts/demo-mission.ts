// ============================================================
// NEXUS INTELLIGENCE — MISSION ENGINE DEMO (Phase 4)
// ============================================================
// User: « Prépare-moi pour ma présentation de vendredi. »
//
// → mission created (5 steps, dependencies)
// → mission blocked (a related task is blocked)
// → next best action = unblock the real task
// → confirmation → mutation → read-back → verified
// → mission re-evaluated → next step (complete the presentation task)
// → confirmation → mutation → read-back → verified
// → mission completed (progress 100%)
//
// Run: npm run demo:mission
// ============================================================

import {
  detectMissionRequest,
  findRelatedEntities,
  createMissionObject,
  runMissionLoop,
  applyVerifiedActionToStep,
  saveMission,
  readMission,
} from "../src/lib/intelligence/mission";
import { executeIntelligenceAction } from "../src/lib/intelligence/actions";
import type { WorkspaceSnapshot } from "../src/lib/intelligence/engine";

const LINE = "─".repeat(76);
const now = new Date("2026-08-26T10:00:00Z"); // mercredi — vendredi = 2026-08-28

const snapshot: WorkspaceSnapshot = {
  now,
  projects: [{ id: "p1", name: "Refonte du site", status: "active", due_date: "2026-08-28", progress: 30, updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-01T09:00:00Z" }],
  tasks: [
    { id: "t1", title: "Préparer la présentation", status: "todo", priority: "high", due_at: "2026-08-28T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-10T09:00:00Z", completed_at: null },
    { id: "t2", title: "Finaliser les slides de la présentation", status: "blocked", priority: "high", due_at: "2026-08-27T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-11T09:00:00Z", completed_at: null },
    { id: "t3", title: "Rapport mensuel", status: "todo", priority: "low", due_at: "2026-09-02T00:00:00.000Z", project_id: null, updated_at: "2026-08-20T09:00:00Z", created_at: "2026-08-15T09:00:00Z", completed_at: null },
  ],
  goals: [],
};

// ---- In-memory Supabase fake (same contract as the tests) --------
const store = {
  intelligence_missions: [] as Record<string, unknown>[],
  tasks: snapshot.tasks.map((t) => ({ ...t, workspace_id: "ws-1", description: null })),
  projects: snapshot.projects.map((p) => ({ ...p, workspace_id: "ws-1" })),
  goals: [] as Record<string, unknown>[],
};
function matches(row: Record<string, unknown>, filters: Record<string, unknown>) {
  for (const [col, val] of Object.entries(filters)) {
    if (typeof val === "function") { if (!val(row[col])) return false; }
    else if (row[col] !== val) return false;
  }
  return true;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = {
  from(table: string) {
    const filters: Record<string, unknown> = {};
    let mode = "select";
    let insertRows: Record<string, unknown>[] | null = null;
    let updatePatch: Record<string, unknown> | null = null;
    let selected: string | null = null;
    const q = {
      select(cols: string) { selected = cols; return q; },
      eq(col: string, val: unknown) { filters[col] = val; return q; },
      ilike() { filters.x = () => true; return q; },
      order() { return q; },
      limit() { return q; },
      in(col: string, vals: unknown[]) { filters[col] = (value: unknown) => vals.includes(value); return q; },
      insert(row: Record<string, unknown> | Record<string, unknown>[]) { insertRows = Array.isArray(row) ? row : [row]; mode = "insert"; return q; },
      update(patch: Record<string, unknown>) { updatePatch = patch; mode = "update"; return q; },
      delete() { mode = "delete"; return q; },
      async single() {
        const rows = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => matches(r, filters));
        const row = rows[0];
        if (mode === "insert") { const created = insertRows!.map((r, i) => ({ id: `new-${table}-${i}`, ...r })); (store[table as keyof typeof store] as Record<string, unknown>[]).push(...created); return { data: project(created[0], selected), error: null }; }
        if (mode === "update") { if (!row) return { data: null, error: { message: "Row not found" } }; Object.assign(row, updatePatch); return { data: project(row, selected), error: null }; }
        if (mode === "delete") { if (!row) return { data: null, error: { message: "Row not found" } }; (store[table as keyof typeof store] as Record<string, unknown>[]) = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => r.id !== row.id); return { data: row, error: null }; }
        return { data: row ? project(row, selected) : null, error: row ? null : { message: "No rows" } };
      },
      async maybeSingle() {
        const rows = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => matches(r, filters));
        const row = rows[0];
        if (mode === "insert") { const created = insertRows!.map((r, i) => ({ id: `new-${table}-${i}`, ...r })); (store[table as keyof typeof store] as Record<string, unknown>[]).push(...created); return { data: project(created[0], selected), error: null }; }
        if (mode === "update") { if (!row) return { data: null, error: null }; Object.assign(row, updatePatch); return { data: project(row, selected), error: null }; }
        if (mode === "delete") { if (!row) return { data: null, error: null }; (store[table as keyof typeof store] as Record<string, unknown>[]) = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => r.id !== row.id); return { data: row, error: null }; }
        return { data: row ? project(row, selected) : null, error: null };
      },
      then(resolve: (value: unknown) => void) {
        const rows = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => matches(r, filters));
        if (mode === "insert") { const created = insertRows!.map((r, i) => ({ id: `new-${table}-${store[table as keyof typeof store].length + i}`, ...r })); (store[table as keyof typeof store] as Record<string, unknown>[]).push(...created); resolve({ data: created.map((r) => project(r, selected)), error: null }); return Promise.resolve(); }
        if (mode === "update") { for (const r of rows) Object.assign(r, updatePatch); resolve({ data: null, error: null }); return Promise.resolve(); }
        if (mode === "delete") { (store[table as keyof typeof store] as Record<string, unknown>[]) = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => !matches(r, filters)); resolve({ data: null, error: null }); return Promise.resolve(); }
        resolve({ data: rows.map((r) => project(r, selected)), error: null }); return Promise.resolve();
      },
    };
    return q;
  },
  _store: store,
};
function project(row: Record<string, unknown>, selected: string | null) {
  if (!row) return null;
  if (!selected || selected === "*") return { ...row };
  const cols = selected.split(",").map((c) => c.trim());
  const out: Record<string, unknown> = {};
  for (const col of cols) out[col] = row[col];
  return out;
}

function printMission(mission: NonNullable<Awaited<ReturnType<typeof readMission>>>, label: string) {
  console.log(`\n${label}`);
  console.log(`  ${mission.title} — ${mission.progress}% (${mission.status})`);
  for (const step of mission.steps) {
    const icon =
      step.status === "completed" ? "✓" :
      step.status === "blocked" ? "⚠" :
      step.status === "ready" ? "●" :
      step.status === "waiting" ? "○" :
      step.status === "failed" ? "✗" : "·";
    console.log(`  ${icon} ${step.title} [${step.status}]${step.blockedReason ? ` — ${step.blockedReason}` : ""}`);
  }
  if (mission.nextBestAction) {
    console.log(`  → Prochaine action : ${mission.nextBestAction.label} (${mission.nextBestAction.kind})`);
  }
}

async function main() {
  console.log(`\n${LINE}`);
  console.log("NEXUS INTELLIGENCE — MISSION ENGINE DEMO");
  console.log(LINE);

  console.log(`\n👤 « Prépare-moi pour ma présentation de vendredi. »`);

  // ---- 1. UNDERSTAND + DECOMPOSE ---------------------------------
  const request = detectMissionRequest("Prépare-moi pour ma présentation de vendredi", now)!;
  const related = findRelatedEntities(snapshot, request.keyword);
  console.log(`\n🤖 UNDERSTAND → objectif décomposable (${request.kind})`);
  console.log(`   Keyword: ${request.keyword} · Échéance: ${request.deadlineLabel} (${request.deadline})`);
  console.log(`   Tâches liées (réelles) : ${related.taskIds.map((id) => snapshot.tasks.find((t) => t.id === id)?.title).join(" · ")}`);
  console.log(`   Blocages détectés : ${related.blockerLabels.join(", ") || "aucun"}`);

  let mission = createMissionObject(request, "ws-1", "u1", snapshot, related, now);
  mission = runMissionLoop(mission, snapshot);
  await saveMission(db, mission);
  printMission(mission, "📋 PLAN — mission créée et évaluée (état réel)");

  // ---- 2. Next best action : unblock ------------------------------
  console.log(`\n🤖 NEXT BEST ACTION (déterministe) : ${mission.nextBestAction?.label}`);
  console.log(`   Raison : ${mission.nextBestAction?.reason}`);

  const unblockAction = mission.nextBestAction!.action!;
  console.log(`\n👤 Confirmation : exécuter « ${unblockAction.label} »`);
  const executed = await executeIntelligenceAction(db, "ws-1", "u1", unblockAction.type, {
    ...unblockAction.payload,
    confirmed: true,
  });
  console.log(`🤖 EXECUTE → ${executed.message}`);
  console.log(`   VERIFY → read-back : ${executed.verified.matched.join(", ")} (${executed.verified.verified ? "OK" : "FAIL"})`);
  mission = applyVerifiedActionToStep(mission, mission.nextBestAction!.stepId, {
    verified: executed.verified.verified,
    matched: executed.verified.matched,
    summary: executed.verified.summary,
  });

  // ---- 3. Re-evaluate with the real (mutated) snapshot ------------
  const snapshot1 = structuredClone(snapshot);
  snapshot1.tasks = snapshot1.tasks.map((t) => (t.id === "t2" ? { ...t, status: "in_progress" } : t));
  mission = runMissionLoop(mission, snapshot1);
  await saveMission(db, mission);
  printMission(mission, "🔄 MISSION RÉÉVALUÉE (tâche débloquée)");

  // ---- 4. Next step : complete the presentation task --------------
  console.log(`\n🤖 NEXT BEST ACTION : ${mission.nextBestAction?.label}`);
  const completeAction = mission.nextBestAction!.action!;
  console.log(`\n👤 Confirmation : exécuter « ${completeAction.label} »`);
  const executed2 = await executeIntelligenceAction(db, "ws-1", "u1", completeAction.type, {
    ...completeAction.payload,
    confirmed: true,
  });
  console.log(`🤖 EXECUTE → ${executed2.message}`);
  console.log(`   VERIFY → read-back : ${executed2.verified.matched.join(", ")} (${executed2.verified.verified ? "OK" : "FAIL"})`);
  mission = applyVerifiedActionToStep(mission, mission.nextBestAction!.stepId, {
    verified: executed2.verified.verified,
    matched: executed2.verified.matched,
    summary: executed2.verified.summary,
  });

  // ---- 5. Final re-evaluation → completed -------------------------
  const snapshot2 = structuredClone(snapshot1);
  snapshot2.tasks = snapshot2.tasks.map((t) => (t.id === "t1" ? { ...t, status: "done", completed_at: now.toISOString() } : t));
  mission = runMissionLoop(mission, snapshot2);
  await saveMission(db, mission);
  printMission(mission, "✅ MISSION RÉÉVALUÉE (travail terminé)");

  // ---- 6. Resume after "refresh" ----------------------------------
  const restored = await readMission(db, "ws-1", "u1", mission.id);
  console.log(`\n🔄 REPRISE APRÈS REFRESH : mission « ${restored?.title} » retrouvée (${restored?.status}, ${restored?.progress}%).`);

  console.log(`\n${LINE}`);
  console.log("BOUCLE DE MISSION FERMÉE : comprendre → décomposer → planifier →");
  console.log("évaluer → next best action → confirmation → exécution → read-back →");
  console.log("réévaluer → compléter.");
  console.log(LINE);
}

main().catch((err) => {
  console.error("❌", err.message ?? err);
  process.exit(1);
});
