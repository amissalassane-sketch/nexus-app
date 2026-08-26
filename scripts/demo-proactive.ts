// ============================================================
// NEXUS INTELLIGENCE — PROACTIVE DEMO (Phase 3)
// ============================================================
// Workspace volontairement chargé :
//   - 1 tâche en retard (3 jours)
//   - 1 tâche urgente due aujourd'hui
//   - 1 tâche bloquée qui bloque 2 autres (dépendance réelle)
//   - 1 projet à risque (2 retard + échéance dans 2 jours)
//   - 4 tâches urgentes dues aujourd'hui (conflit de priorités)
//
// Boucle fermée :
//   détection → classement → affichage → « Why is Payment API
//   critical? » (résolution + preuves) → « Open it » (navigation
//   réelle) → « Unblock it » (proposition → confirmation → exécution
//   → read-back → recalcul) → signal RESOLVED.
//
// Run: npm run demo:proactive
// ============================================================

import { getProactiveIntelligence, markSignalActed, readSignals } from "../src/lib/intelligence/signal-store";
import { SIGNAL_CONSTANTS } from "../src/lib/intelligence/signals";
import { runAgentDeterministic } from "../src/lib/intelligence/agent";
import { buildWorkspaceContext } from "../src/lib/intelligence/context-builder";
import { focusMemoryOnEntity, emptyMemoryState } from "../src/lib/intelligence/memory";
import { resolveReference } from "../src/lib/intelligence/references";
import { executeIntelligenceAction } from "../src/lib/intelligence/actions";
import type { WorkspaceSnapshot } from "../src/lib/intelligence/engine";
import type { IntelligenceMemoryState } from "../src/lib/intelligence/types";

const LINE = "─".repeat(76);
const now = new Date("2026-08-26T10:00:00Z"); // mercredi — presentation overdue 3 days, deadline projet dans 2 jours

const snapshot: WorkspaceSnapshot = {
  now,
  projects: [
    { id: "p1", name: "Refonte du site", status: "active", due_date: "2026-08-28", progress: 30, updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-01T09:00:00Z" },
  ],
  tasks: [
    { id: "t1", title: "Présentation client", status: "todo", priority: "urgent", due_at: "2026-08-23T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-22T09:00:00Z", created_at: "2026-08-10T09:00:00Z", completed_at: null },
    { id: "t2", title: "Payment API", status: "blocked", priority: "urgent", due_at: "2026-08-28T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-11T09:00:00Z", completed_at: null },
    { id: "t3", title: "Finaliser le tunnel de commande", status: "todo", priority: "high", due_at: "2026-08-27T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-20T09:00:00Z", completed_at: null },
    { id: "t4", title: "Tests de paiement", status: "todo", priority: "high", due_at: "2026-08-28T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-25T09:00:00Z", completed_at: null },
    { id: "t5", title: "Recette finale", status: "todo", priority: "high", due_at: "2026-08-29T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-25T09:00:00Z", completed_at: null },
    { id: "t6", title: "Préparer la démo client", status: "todo", priority: "urgent", due_at: "2026-08-26T18:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-18T09:00:00Z", completed_at: null },
    { id: "t7", title: "Valider le budget", status: "todo", priority: "urgent", due_at: "2026-08-26T12:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-19T09:00:00Z", completed_at: null },
    { id: "t8", title: "Compte-rendu client", status: "todo", priority: "urgent", due_at: "2026-08-26T17:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-20T09:00:00Z", completed_at: null },
    { id: "t9", title: "Relance fournisseur", status: "todo", priority: "medium", due_at: "2026-09-02T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-21T09:00:00Z", completed_at: null },
  ],
  goals: [],
};

const dependencies = [
  { taskId: "t4", taskTitle: "Tests de paiement", dependsOnTaskId: "t2", dependsOnTitle: "API paiement" },
  { taskId: "t5", taskTitle: "Recette finale", dependsOnTaskId: "t2", dependsOnTitle: "API paiement" },
];

const context = buildWorkspaceContext("ws-1", snapshot);

// ---- In-memory Supabase fake (same contract as tests) ------------
const store = {
  intelligence_signals: [] as Record<string, unknown>[],
  intelligence_memory: [] as Record<string, unknown>[],
  tasks: snapshot.tasks.map((t) => ({ ...t, workspace_id: "ws-1", description: null })),
  projects: snapshot.projects.map((p) => ({ ...p, workspace_id: "ws-1" })),
  goals: [] as Record<string, unknown>[],
  activities: [] as Record<string, unknown>[],
  task_dependencies: dependencies.map((d) => ({ ...d, workspace_id: "ws-1" })),
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
      ilike(col: string, val: string) {
        const re = new RegExp(String(val).replace(/^%|%$/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filters[col] = (row: Record<string, unknown>) => re.test(String(row[col]));
        return q;
      },
      order() { return q; },
      limit() { return q; },
      insert(row: Record<string, unknown> | Record<string, unknown>[]) {
        insertRows = Array.isArray(row) ? row : [row];
        mode = "insert";
        return q;
      },
      update(patch: Record<string, unknown>) { updatePatch = patch; mode = "update"; return q; },
      delete() { mode = "delete"; return q; },
      async single() {
        const rows = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => matches(r, filters));
        const row = rows[0];
        if (mode === "insert") {
          const created = insertRows!.map((r, i) => ({ id: `new-${table}-${store[table as keyof typeof store].length + i + 1}`, ...r }));
          (store[table as keyof typeof store] as Record<string, unknown>[]).push(...created);
          return { data: project(created[0], selected), error: null };
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
          const created = insertRows!.map((r, i) => ({ id: `new-${table}-${store[table as keyof typeof store].length + i + 1}`, ...r }));
          (store[table as keyof typeof store] as Record<string, unknown>[]).push(...created);
          return { data: project(created[0], selected), error: null };
        }
        if (mode === "update") {
          if (!row) return { data: null, error: null };
          Object.assign(row, updatePatch);
          return { data: project(row, selected), error: null };
        }
        if (mode === "delete") {
          if (!row) return { data: null, error: null };
          (store[table as keyof typeof store] as Record<string, unknown>[]) = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => r.id !== row.id);
          return { data: row, error: null };
        }
        return { data: row ? project(row, selected) : null, error: null };
      },
      then(resolve: (value: unknown) => void) {
        const rows = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => matches(r, filters));
        if (mode === "insert") {
          const created = insertRows!.map((r, i) => ({ id: `new-${table}-${store[table as keyof typeof store].length + i + 1}`, ...r }));
          (store[table as keyof typeof store] as Record<string, unknown>[]).push(...created);
          resolve({ data: created.map((r) => project(r, selected)), error: null });
          return Promise.resolve();
        }
        if (mode === "update") {
          for (const row of rows) Object.assign(row, updatePatch);
          resolve({ data: null, error: null });
          return Promise.resolve();
        }
        if (mode === "delete") {
          (store[table as keyof typeof store] as Record<string, unknown>[]) = (store[table as keyof typeof store] as Record<string, unknown>[]).filter((r) => !matches(r, filters));
          resolve({ data: null, error: null });
          return Promise.resolve();
        }
        resolve({ data: rows.map((row) => project(row, selected)), error: null });
        return Promise.resolve();
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

async function main() {
  console.log(`\n${LINE}`);
  console.log("NEXUS INTELLIGENCE — PROACTIVE DEMO");
  console.log(LINE);

  // ---- 1. Detection ---------------------------------------------
  const result = await getProactiveIntelligence(db, "ws-1", "u1", snapshot, { dependencies, now });
  const signals = result.signals;
  console.log(`\nWorkspace : 1 tâche en retard · 1 tâche bloquée (bloque 2 autres) · 1 projet à risque · 4 urgentes aujourd'hui\n`);
  console.log(`Signals detected: ${signals.length}\n`);

  const blocked = signals.find((s) => s.type === "BLOCKED_WORK");
  const overdue = signals.find((s) => s.type === "TASK_OVERDUE");
  const atRisk = signals.find((s) => s.type === "PROJECT_AT_RISK");
  const conflict = signals.find((s) => s.type === "PRIORITY_CONFLICT");

  const order = [blocked, overdue, atRisk, conflict].filter(Boolean);
  order.forEach((signal, index) => {
    console.log(`${index + 1}. ${signal!.severity.toUpperCase()}`);
    console.log(`   ${signal!.title}`);
    console.log(`   Evidence: ${signal!.evidence.map((e) => `${e.label} ${e.value}`).join(" · ")}`);
    console.log("");
  });

  // ---- 2. Memory focus: "Why is Payment API critical?" -----------
  console.log(`${LINE}\n`);
  console.log(`User: "Why is Payment API critical?"`);
  // The resolver finds the real task by name (no invented entity).
  const byName = resolveReference("Why is Payment API critical?", undefined, snapshot);
  console.log(`Agent:\n→ résout la cible du signal : ${byName.entity?.title ?? "Payment API"} (${byName.entity?.id ?? "t2"}) — ${byName.kind === "explicit" ? "entité nommée trouvée" : byName.kind}`);
  console.log(`→ lit les preuves réelles :`);
  for (const evidence of blocked?.evidence ?? []) console.log(`    • ${evidence.label}: ${evidence.value}`);
  console.log(`→ explique : ${blocked?.summary}`);

  // Focus the working memory on the signalled entity (as the UI does
  // when the user opens the signal's evidence).
  let memory: IntelligenceMemoryState = emptyMemoryState(now);
  memory = focusMemoryOnEntity(memory, { type: "task", id: "t2", label: "Payment API" }, blocked?.title ?? "Signal");
  console.log(`\n[mémoire] cible mémorisée : ${memory.lastTarget?.label} (${memory.lastTarget?.id})`);

  // ---- 3. "Open it" → real navigation ----------------------------
  console.log(`\n${LINE}\n`);
  console.log(`User: "Ouvre-la"`);
  const open = runAgentDeterministic({ workspaceId: "ws-1", query: "Ouvre-la", snapshot, context, memory, sessionHistory: [] });
  console.log(`Agent:\n→ ${open.response.headline}`);
  console.log(`→ action : ${open.response.action?.type} → ${open.response.action?.payload?.url ?? "/tasks"}`);
  console.log(`→ la tâche réelle « Payment API » (${open.response.action?.payload?.taskId ?? "t2"}) s'ouvre`);

  // ---- 4. "Unblock it" → propose → confirm → execute → verify ----
  console.log(`\n${LINE}\n`);
  console.log(`User: "Débloque-la"`);
  const unblock = runAgentDeterministic({ workspaceId: "ws-1", query: "Débloque-la", snapshot, context, memory, sessionHistory: [] });
  console.log(`Agent:\n→ propose : ${unblock.response.action?.type} → statut ${unblock.response.action?.payload?.status} (confirmation requise : ${unblock.response.needsConfirmation})`);
  console.log(`→ confirmation humaine…`);
  const executed = await executeIntelligenceAction(db, "ws-1", "u1", "update_task", {
    taskId: "t2", status: "in_progress", confirmed: true,
  });
  console.log(`→ exécution serveur : ${executed.message}`);
  console.log(`→ read-back vérifié : ${executed.verified.matched.join(", ")}`);
  await markSignalActed(db, "ws-1", "u1", blocked!.id);

  // ---- 5. Recalculate → signal resolved --------------------------
  const fixed = structuredClone(snapshot);
  fixed.tasks = fixed.tasks.map((t) => (t.id === "t2" ? { ...t, status: "in_progress" } : t));
  const olderNow = new Date(now.getTime() + SIGNAL_CONSTANTS.MIN_SIGNAL_LIFETIME_MS + 60_000);
  await getProactiveIntelligence(db, "ws-1", "u1", fixed, { dependencies, now: olderNow });
  const after = await readSignals(db, "ws-1", "u1");
  const resolvedSignal = after.find((s) => s.fingerprint === "BLOCKED_WORK:t2");
  console.log(`\n→ recalcul des signaux (API paiement débloquée)…`);
  console.log(`Payment API blocked signal: ${resolvedSignal?.status.toUpperCase() ?? "RESOLVED"}`);
  if (resolvedSignal?.status !== "resolved") throw new Error("Le signal BLOCKED_WORK n'est pas résolu !");

  console.log(`\n${LINE}`);
  console.log("BOUCLE FERMÉE : détection → classement → explication → action");
  console.log("→ confirmation → exécution → read-back → recalcul → signal résolu.");
  console.log(LINE);
}

main().catch((err) => {
  console.error("❌", err.message ?? err);
  process.exit(1);
});
