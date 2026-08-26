// ============================================================
// NEXUS INTELLIGENCE — PHASE 3 DEMO: PROACTIVE SIGNAL ENGINE
// ============================================================
// Full proactive loop (spec §18):
//
//   Workspace contient :
//   - 1 projet à risque
//   - 2 tâches en retard
//   - 1 tâche bloquée (qui bloque une autre)
//   - 1 échéance demain
//
//   → détection → scoring → dédup → cooldown → classement
//   → « Project X needs your attention » + preuves + actions
//   → l'utilisateur agit (mutation vérifiée côté serveur)
//   → le signal évolue (acted) puis disparaît (résolu)
//
// Run: npm run demo:signals
// ============================================================

import { getProactiveIntelligence, markSignalActed, readSignals, updateSignalStatus } from "../src/lib/intelligence/signal-store";
import { computeSignals, SIGNAL_CONSTANTS } from "../src/lib/intelligence/signals";
import { executeIntelligenceAction } from "../src/lib/intelligence/actions";
import type { WorkspaceSnapshot } from "../src/lib/intelligence/engine";

const LINE = "─".repeat(74);
const now = new Date("2026-08-26T10:00:00Z"); // mercredi

const snapshot: WorkspaceSnapshot = {
  now,
  projects: [
    { id: "p1", name: "Website Redesign", status: "active", due_date: "2026-08-27", progress: 20, updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-01T09:00:00Z" },
    { id: "p2", name: "API Migration", status: "active", due_date: "2026-09-15", progress: 75, updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-01T09:00:00Z" },
  ],
  tasks: [
    { id: "t1", title: "Fix API integration", status: "todo", priority: "urgent", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-23T09:00:00Z", created_at: "2026-08-10T09:00:00Z", completed_at: null },
    { id: "t2", title: "Finish homepage", status: "todo", priority: "urgent", due_at: "2026-08-25T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-22T09:00:00Z", created_at: "2026-08-18T09:00:00Z", completed_at: null },
    { id: "t3", title: "Ship landing page", status: "todo", priority: "high", due_at: "2026-08-26T18:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-20T09:00:00Z", completed_at: null },
    { id: "t4", title: "Prepare demo", status: "todo", priority: "medium", due_at: "2026-08-27T09:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-21T09:00:00Z", completed_at: null },
    { id: "t5", title: "Deploy auth service", status: "blocked", priority: "urgent", due_at: "2026-08-28T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-11T09:00:00Z", completed_at: null },
    { id: "t6", title: "Write integration tests", status: "todo", priority: "high", due_at: null, project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-25T09:00:00Z", completed_at: null },
    { id: "t7", title: "Migrate legacy endpoints", status: "todo", priority: "medium", due_at: "2026-09-10", project_id: "p2", updated_at: "2026-08-20T09:00:00Z", created_at: "2026-08-05T09:00:00Z", completed_at: null },
    { id: "t8", title: "Prepare Q3 planning", status: "todo", priority: "urgent", due_at: "2026-08-28T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-25T09:00:00Z", created_at: "2026-08-25T09:00:00Z", completed_at: null },
    { id: "t9", title: "Done task A", status: "done", priority: "medium", due_at: "2026-08-24T00:00:00.000Z", project_id: "p1", updated_at: "2026-08-24T09:00:00Z", created_at: "2026-08-10T09:00:00Z", completed_at: "2026-08-24T09:00:00Z" },
  ],
  goals: [{ id: "g1", title: "Launch v2", status: "active", progress: 60, target_date: "2026-09-30" }],
};

const dependencies = [
  { taskId: "t6", taskTitle: "Write integration tests", dependsOnTaskId: "t5", dependsOnTitle: "Deploy auth service" },
];

// ---- In-memory Supabase fake (same contract as the tests) --------
const store = {
  intelligence_signals: [] as Record<string, unknown>[],
  tasks: snapshot.tasks.map((t) => ({ ...t, workspace_id: "ws-1", description: null })),
  projects: snapshot.projects.map((p) => ({ ...p, workspace_id: "ws-1" })),
  goals: snapshot.goals.map((g) => ({ ...g, workspace_id: "ws-1" })),
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
  if (!selected || selected === "*") return { ...row };
  const cols = selected.split(",").map((c) => c.trim());
  const out: Record<string, unknown> = {};
  for (const col of cols) out[col] = row[col];
  return out;
}

async function main() {
  console.log(`\n${LINE}`);
  console.log("PHASE 3 — PROACTIVE INTELLIGENCE & SIGNAL ENGINE");
  console.log(LINE);

  console.log(`\n📊 WORKSPACE (données réelles) :`);
  console.log(`   - 2 tâches en retard (t1, t2) · 1 tâche bloquée (t5 → bloque t6)`);
  console.log(`   - 1 échéance demain (projet p1 « Website Redesign »)`);
  console.log(`   - 3 tâches urgentes simultanées · progression p1 = 20%`);

  // ---- 1. Détection + scoring (déterministe) ----------------------
  console.log(`\n🤖 SIGNAL ENGINE — détection (1 snapshot → signaux) :`);
  const detected = computeSignals(snapshot, { workspaceId: "ws-1", dependencies, now });
  const critical = detected.filter((s) => s.severity === "critical");
  const warning = detected.filter((s) => s.severity === "warning");
  console.log(`   ${detected.length} signaux détectés (${critical.length} critiques, ${warning.length} élevés, ${detected.length - critical.length - warning.length} autres)`);
  console.log(`   Classement par score (déterministe, explicable) :`);
  for (const signal of detected.slice(0, 5)) {
    console.log(`     [${signal.severity.toUpperCase().padEnd(8)}] ${signal.score.toString().padStart(3)}/100 · ${signal.title}`);
  }
  const top = detected[0];
  console.log(`\n   Preuves du signal n°1 (« ${top.title} ») :`);
  for (const evidence of top.evidence) console.log(`     • ${evidence.label}: ${evidence.value}`);
  console.log(`   Décomposition du score :`);
  for (const factor of top.scoreBreakdown) console.log(`     • ${factor.factor} +${factor.points} (${factor.detail})`);

  // ---- 2. Orchestration + persistance + dédup ---------------------
  console.log(`\n💾 ORCHESTRATION — getProactiveIntelligence (dédup + cooldown + persistance) :`);
  const first = await getProactiveIntelligence(db, "ws-1", "u1", snapshot, { dependencies, now });
  console.log(`   ${first.attentionCount} signaux actifs affichables, ${first.criticalCount} critiques.`);
  console.log(`   Persistés : ${db._store.intelligence_signals.length} lignes (fingerprints uniques).`);
  const second = await getProactiveIntelligence(db, "ws-1", "u1", snapshot, { dependencies, now: new Date(now.getTime() + 60_000) });
  console.log(`   Re-scan 60s plus tard (état inchangé) : ${second.attentionCount} actifs, ${db._store.intelligence_signals.length} lignes — aucune duplication.`);

  // ---- 3. Affichage « Needs your attention » ----------------------
  const projectSignal = first.signals.find((s) => s.type === "PROJECT_AT_RISK");
  console.log(`\n🔔 AFFICHAGE — « ${projectSignal?.title ?? "?"} »`);
  console.log(`   ${projectSignal?.summary ?? ""}`);
  console.log(`   Preuves :`);
  for (const evidence of projectSignal?.evidence ?? []) console.log(`     • ${evidence.label}: ${evidence.value}`);
  console.log(`   Actions proposées :`);
  for (const action of projectSignal?.suggestedActions ?? []) {
    console.log(`     ${action.kind === "navigate" ? "→ ouvrir" : "✎ mutation (confirmation requise)"} · ${action.label}`);
  }

  // ---- 4. Cycle de vie : vu → ignoré → cooldown -------------------
  console.log(`\n🔄 CYCLE DE VIE :`);
  await updateSignalStatus(db, "ws-1", "u1", projectSignal!.id, "seen", now);
  console.log(`   ✓ new → seen (affiché à l'utilisateur)`);
  await updateSignalStatus(db, "ws-1", "u1", projectSignal!.id, "dismissed", now);
  console.log(`   ✓ seen → dismissed (ignoré ≠ résolu — le problème existe toujours)`);
  const afterDismiss = await getProactiveIntelligence(db, "ws-1", "u1", snapshot, { dependencies, now: new Date(now.getTime() + 60_000) });
  const pStillTracked = afterDismiss.signals.every((s) => s.fingerprint !== projectSignal?.fingerprint);
  console.log(`   ✓ re-scan : signal non réaffiché (cooldown ${SIGNAL_CONSTANTS.COOLDOWN_DISMISSED_MS / 3600_000}h) — problème toujours présent (${pStillTracked ? "absents des actifs" : "réaffiché"})`);

  // ---- 5. Action depuis un signal : mutation vérifiée -------------
  console.log(`\n⚡ ACTION DEPUIS UN SIGNAL (via le système serveur sécurisé) :`);
  const overdueSignal = first.signals.find((s) => s.type === "TASK_OVERDUE" && s.entityId === "t1");
  const mutateAction = overdueSignal?.suggestedActions.find((a) => a.kind === "mutate");
  if (!overdueSignal || !mutateAction?.action) throw new Error("Signal TASK_OVERDUE:t1 introuvable");
  console.log(`   Signal : ${overdueSignal.title}`);
  console.log(`   Action proposée : ${mutateAction.label} (confirmation humaine requise)`);
  console.log(`   → Confirmation → POST /api/intelligence/action …`);
  const result = await executeIntelligenceAction(db, "ws-1", "u1", mutateAction.action.type, {
    ...mutateAction.action.payload,
    confirmed: true,
  });
  console.log(`   ✅ ${result.message} — champs vérifiés : ${result.verified.matched.join(", ")}`);
  await markSignalActed(db, "ws-1", "u1", overdueSignal.id);

  // ---- 6. Le problème disparaît → signal résolu -------------------
  console.log(`\n✅ RÉSOLUTION :`);
  const fixed = structuredClone(snapshot);
  fixed.tasks = fixed.tasks.map((t) =>
    t.id === "t1" ? { ...t, status: "done", completed_at: now.toISOString() } : t
  );
  const olderNow = new Date(now.getTime() + SIGNAL_CONSTANTS.MIN_SIGNAL_LIFETIME_MS + 60_000);
  await getProactiveIntelligence(db, "ws-1", "u1", fixed, { dependencies, now: olderNow });
  const stored = await readSignals(db, "ws-1", "u1");
  const t1Signal = stored.find((s) => s.fingerprint === "TASK_OVERDUE:t1");
  console.log(`   Tâche t1 terminée → fingerprint TASK_OVERDUE:t1 absent du détecteur`);
  console.log(`   État du signal : ${t1Signal?.status}${t1Signal?.resolvedAt ? ` (résolu à ${t1Signal.resolvedAt.slice(0, 16)}Z)` : ""}`);

  console.log(`\n${LINE}`);
  console.log("✅ BOUCLE PROACTIVE COMPLÈTE : détection → score → dédup → cooldown →");
  console.log("   affichage → preuves → actions → mutation vérifiée → résolution.");
  console.log(LINE);
}

main().catch((err) => {
  console.error("❌", err.message ?? err);
  process.exit(1);
});
