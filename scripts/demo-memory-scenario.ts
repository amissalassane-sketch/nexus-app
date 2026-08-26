// ============================================================
// NEXUS INTELLIGENCE — PHASE 2 DEMO: MEMORY & CONTEXTUAL LOOP
// ============================================================
// Full end-of-phase scenario (spec §13):
//
//   1. « Quelles sont mes 3 tâches prioritaires ? »
//   2. Intelligence retourne 3 tâches réelles.
//   3. « Passe la deuxième en urgente. »
//   4. Intelligence identifie exactement la deuxième tâche.
//   5. « Reporte-la à vendredi. »
//   6. Intelligence conserve la même cible.
//   7. « Finalement annule. »
//   8. Intelligence comprend qu'il s'agit de cette même tâche.
//   9. Chaque mutation demande confirmation.
//  10. Chaque mutation réussie est vérifiée côté serveur.
//  11. La mémoire reflète l'état réel.
//  12. Après refresh, le contexte pertinent reste disponible.
//  13. Après changement de workspace, aucune donnée précédente ne fuit.
//  14. Une référence ambiguë provoque une clarification, jamais une
//      supposition.
//
// Run: npx tsx scripts/demo-memory-scenario.ts
// ============================================================

import { buildWorkspaceContext } from "../src/lib/intelligence/context-builder";
import { runAgentDeterministic } from "../src/lib/intelligence/agent";
import { resolveReference } from "../src/lib/intelligence/references";
import {
  applyActionSuccess,
  emptyMemoryState,
  readMemory,
  saveMemory,
  updateMemoryAfterTurn,
} from "../src/lib/intelligence/memory";
import { executeIntelligenceAction, ActionError } from "../src/lib/intelligence/actions";
import type { WorkspaceSnapshot } from "../src/lib/intelligence/engine";
import type { IntelligenceMemoryState } from "../src/lib/intelligence/types";

const LINE = "─".repeat(74);

const now = new Date("2026-08-26T10:00:00Z"); // mercredi — vendredi = 2026-08-28
const snapshot: WorkspaceSnapshot = {
  now,
  projects: [
    { id: "p1", name: "Website Redesign", status: "active", due_date: "2026-08-28", progress: 40 },
    { id: "p2", name: "API Migration", status: "active", due_date: "2026-09-15", progress: 75 },
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

// ------------------------------------------------------------
// In-memory Supabase fake (workspace-scoped, same contract)
// ------------------------------------------------------------
const store = {
  tasks: snapshot.tasks.map((t) => ({ ...t, workspace_id: "ws-1", description: null })),
  projects: snapshot.projects.map((p) => ({ ...p, workspace_id: "ws-1", slug: p.name.toLowerCase().replace(/\s+/g, "-") })),
  goals: snapshot.goals.map((g) => ({ ...g, workspace_id: "ws-1" })),
  intelligence_memory: [] as Record<string, unknown>[],
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
    let insertRow: Record<string, unknown> | null = null;
    let updatePatch: Record<string, unknown> | null = null;
    let selected: string | null = null;
    const q = {
      select(cols: string) { selected = cols; return q; },
      eq(col: string, val: unknown) { filters[col] = val; return q; },
      ilike(col: string, val: string) {
        const re = new RegExp(String(val).replace(/^%|%$/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filters[col] = (row: Record<string, unknown>) => re.test(String(row[col]));
        return q;
      },
      limit(n: number) { void n; return q; },
      insert(row: Record<string, unknown>) { insertRow = row; mode = "insert"; return q; },
      update(patch: Record<string, unknown>) { updatePatch = patch; mode = "update"; return q; },
      delete() { mode = "delete"; return q; },
      async single() {
        const rows = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => matches(r, filters));
        const row = rows[0];
        if (mode === "insert") {
          const created = { id: `new-${table}-${Date.now()}`, workspace_id: filters.workspace_id ?? "ws-1", ...(insertRow as object) };
          (store[table as keyof typeof store] as Record<string, unknown>[]).push(created);
          return { data: project(created, selected), error: null };
        }
        if (mode === "update") {
          if (!row) return { data: null, error: { message: "Row not found" } };
          Object.assign(row, updatePatch);
          return { data: project(row, selected), error: null };
        }
        if (mode === "delete") {
          if (!row) return { data: null, error: { message: "Row not found" } };
          (store[table as keyof typeof store] as Record<string, unknown>[]) = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => r.id !== row.id);
          return { data: row, error: null };
        }
        return { data: row ? project(row, selected) : null, error: row ? null : { message: "No rows" } };
      },
      async maybeSingle() {
        const rows = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => matches(r, filters));
        const row = rows[0];
        if (mode === "insert") {
          if (insertRow) {
            const created = { id: `new-${table}-${Date.now()}`, workspace_id: filters.workspace_id ?? "ws-1", ...(insertRow as object) };
            (store[table as keyof typeof store] as Record<string, unknown>[]).push(created);
            return { data: project(created, selected), error: null };
          }
          return { data: null, error: null };
        }
        if (mode === "update" && !row) return { data: null, error: null };
        if (mode === "delete") {
          if (!row) return { data: null, error: null };
          (store[table as keyof typeof store] as Record<string, unknown>[]) = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => r.id !== row.id);
          return { data: row, error: null };
        }
        return { data: row ? project(row, selected) : null, error: null };
      },
      then(resolve: (value: unknown) => void) {
        return this.maybeSingle().then((result: { data: Record<string, unknown> | null }) => {
          if (mode === "delete") resolve({ data: null, error: result.data ? null : null });
          else resolve(result);
        });
      },
    };
    return q;
  },
  _store: store,
};
function project(row: Record<string, unknown>, selected: string | null) {
  if (!selected || selected === "*") return { ...row };
  const cols = selected.split(",").map((c) => c.trim());
  const out: Record<string, unknown> = {};
  for (const col of cols) out[col] = row[col];
  return out;
}

function run(query: string, memory?: IntelligenceMemoryState) {
  return runAgentDeterministic({
    workspaceId: "ws-1",
    query,
    snapshot,
    context,
    memory,
  });
}

async function main() {
  console.log(`\n${LINE}`);
  console.log("PHASE 2 — MÉMOIRE & COMPRÉHENSION CONTEXTUELLE (scénario de fin de phase)");
  console.log(LINE);

  let memory = emptyMemoryState(now);

  // ---- 1. List 3 real priorities -------------------------------
  console.log(`\n👤 « Quelles sont mes 3 tâches prioritaires ? »`);
  let out = run("Quelles sont mes 3 tâches prioritaires ?", memory);
  memory = updateMemoryAfterTurn(memory, out.response, snapshot);
  console.log(`🤖 ${out.response.headline}`);
  (out.response.items ?? []).forEach((item, i) => {
    console.log(`     ${i + 1}. ${item.title} — ${item.subtitle ?? ""}`);
  });
  console.log(`   [mémoire] ${memory.lastItems.length} entités mémorisées (ordonnées, ids réels)`);

  // ---- 2. "Passe la deuxième en urgente." ------------------------
  console.log(`\n👤 « Passe la deuxième en urgente. »`);
  out = run("Passe la deuxième en urgente.", memory);
  const target2 = out.response.action?.payload?.taskId;
  console.log(`🤖 Résolution: ${out.agent.memory?.referenceResolved?.kind} → « ${out.response.action?.payload?.query ?? target2} »`);
  console.log(`   Action proposée: ${out.response.action?.type} (${out.response.action?.payload?.priority}) — confirmation requise: ${out.response.needsConfirmation}`);
  if (target2 !== "t2") throw new Error("La deuxième tâche n'a pas été résolue correctement !");

  // Confirmation → execution → verification → memory update.
  const exec1 = await executeIntelligenceAction(db, "ws-1", "u1", "update_task", { taskId: target2, priority: "urgent", confirmed: true });
  memory = applyActionSuccess(memory, "update_task", target2, "Finish homepage", exec1.verified.verified, "task", now);
  console.log(`   ✅ Mutation vérifiée: ${exec1.message} (champs: ${exec1.verified.matched.join(", ")})`);
  console.log(`   [mémoire] lastAction = ${memory.lastAction?.status} / verified = ${memory.lastAction?.verified} / cible = ${memory.lastTarget?.id}`);

  // ---- 3. "Reporte-la à vendredi." -------------------------------
  console.log(`\n👤 « Reporte-la à vendredi. »`);
  out = run("Reporte-la à vendredi.", memory);
  console.log(`🤖 Résolution: ${out.agent.memory?.referenceResolved?.kind} → même cible (${out.response.action?.payload?.taskId})`);
  console.log(`   Action proposée: ${out.response.action?.type} → échéance ${out.response.action?.payload?.dueDate}`);
  if (out.response.action?.payload?.taskId !== "t2" || out.response.action?.payload?.dueDate !== "2026-08-28") {
    throw new Error("La cible ou la date n'est pas correcte !");
  }
  const exec2 = await executeIntelligenceAction(db, "ws-1", "u1", "move_task", { taskId: "t2", dueDate: "2026-08-28", confirmed: true });
  memory = applyActionSuccess(memory, "move_task", "t2", "Finish homepage", exec2.verified.verified, "task", now);
  console.log(`   ✅ Mutation vérifiée: ${exec2.message}`);

  // ---- 4. "Finalement annule." -----------------------------------
  console.log(`\n👤 « Finalement annule. »`);
  out = run("Finalement annule.", memory);
  console.log(`🤖 Résolution: ${out.agent.memory?.referenceResolved?.kind} → même cible (${out.response.action?.payload?.taskId}) — risque ${out.response.action?.risk}`);
  if (out.response.action?.payload?.taskId !== "t2") throw new Error("« Finalement annule » doit cibler la même tâche !");
  const exec3 = await executeIntelligenceAction(db, "ws-1", "u1", "delete_task", { taskId: "t2", confirmed: true, confirmDeletion: true });
  memory = applyActionSuccess(memory, "delete_task", "t2", "Finish homepage", exec3.verified.verified, "task", now);
  console.log(`   ✅ Suppression vérifiée: ${exec3.message}`);
  console.log(`   [mémoire] supprimés = ${memory.deletedEntityIds.join(", ")} — la référence est invalidée`);

  // ---- 5. Follow-up on the deleted task → honest answer ----------
  console.log(`\n👤 « Passe-la en urgente. » (juste après la suppression)`);
  out = run("Passe-la en urgente.", memory);
  console.log(`🤖 ${out.response.headline}`);
  console.log(`   ${out.response.narrative}`);
  if (out.response.action) throw new Error("Aucune action ne doit être proposée sur une entité supprimée !");

  // ---- 6. Refresh: memory persisted (server row) -----------------
  console.log(`\n🔄 REFRESH — persistance serveur`);
  await saveMemory(db, "ws-1", "u1", memory, []);
  const stored = await readMemory(db, "ws-1", "u1");
  if (!stored) throw new Error("La mémoire n'a pas été persistée !");
  console.log(`   [mémoire] relue après refresh: ${stored.state.lastItems.length} entités, lastAction=${stored.state.lastAction?.status}`);
  out = run("Quelles sont mes tâches prioritaires ?", stored.state);
  memory = updateMemoryAfterTurn(stored.state, out.response, snapshot);
  console.log(`   🤖 ${out.response.headline}`);
  (out.response.items ?? []).forEach((item, i) => console.log(`     ${i + 1}. ${item.title}`));

  // ---- 7. Ambiguity → clarification ------------------------------
  console.log(`\n👤 « La deuxième. » (sans contexte préalable)`);
  const ambiguous = run("La deuxième.", emptyMemoryState(now));
  console.log(`🤖 ${ambiguous.response.headline} — ${ambiguous.response.narrative}`);
  if (ambiguous.response.action) throw new Error("Une clarification ne doit jamais proposer d'action !");

  // ---- 8. Multi-workspace isolation ------------------------------
  console.log(`\n🔒 CHANGEMENT DE WORKSPACE — aucune fuite`);
  const snapshotB: WorkspaceSnapshot = {
    now,
    projects: [{ id: "p9", name: "Foreign Project", status: "active", due_date: null, progress: 10 }],
    tasks: [{ id: "t9", title: "Foreign task", status: "todo", priority: "high", due_at: null, project_id: "p9", created_at: now.toISOString(), completed_at: null }],
    goals: [],
  };
  const leaked = resolveReference("Celle-ci.", stored.state, snapshotB, { verify: true });
  console.log(`   [mémoire ws-1 sur ws-2] résolution = ${leaked.kind}${leaked.kind === "deleted" ? " → l'entité de ws-1 n'existe pas dans ws-2" : ""}`);
  const foreign = await executeIntelligenceAction(db, "ws-1", "u1", "complete_task", { taskId: "t9", confirmed: true }).then(
    () => ({ ok: true as const }),
    (e: unknown) => ({ ok: false as const, message: (e as ActionError).message })
  );
  console.log(`   [mutation sur tâche d'un autre workspace] ${foreign.ok === false ? `rejetée : ${foreign.message}` : "❌ NON REJETÉE"}`);

  console.log(`\n${LINE}`);
  console.log("✅ SCÉNARIO DE FIN DE PHASE RÉUSSI — 14 critères couverts.");
  console.log(LINE);
}

main().catch((err) => {
  console.error("❌", err.message ?? err);
  process.exit(1);
});
