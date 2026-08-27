#!/usr/bin/env node
/**
 * NEXUS — MOBILE PREVIEW HARNESS
 * ===============================
 * Brings up the Supabase test double enriched with a realistic
 * intelligence scenario (blocked/overdue tasks, activity rows, an
 * active mission with a blocked step) so the mobile surfaces can be
 * reviewed in a browser against rendered, server-computed data.
 *
 * The seeded rows follow the exact column shapes the app reads
 * (normalizeMissionRow, WorkspaceSnapshot, ActivityRow). Nothing here
 * ships to production — it is the same in-memory stub the e2e suite
 * uses, with three extra tables.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key npm run build
 *   node scripts/preview-mobile.mjs        # stub + seeds on :54321
 *   npm start -- --port 3000               # app against the stub
 *
 * Sign in with owner@nexus.test / any password.
 */

import { startSupabaseStub, WORKSPACE_ID, ONBOARDED_USER } from "../supabase/tests/supabase-stub.mjs";

const STUB_PORT = Number(process.env.STUB_PORT ?? 54321);
// Tables must exist BEFORE the stub starts: the merge copies the Map
// references at construction, and rows are written into those Maps.
const extraTables = {
  projects: new Map(),
  tasks: new Map(),
  activities: new Map(),
  intelligence_missions: new Map(),
};
const insert = (table, rows) => {
  const store = (extraTables[table] ??= new Map());
  for (const row of rows) store.set(String(row.id), row);
};
const stub = await startSupabaseStub(STUB_PORT, "127.0.0.1", {
  extraTables,
});

const now = Date.now();
const iso = (offsetDays) => new Date(now + offsetDays * 86_400_000).toISOString();
const uid = ONBOARDED_USER.id;

// ------------------------------------------------------------------
// 1. Work that generates real engine signals: overdue + blocked tasks
//    on an at-risk project with a near deadline.
// ------------------------------------------------------------------
await insert("projects", [
  {
    id: "proj-slides",
    workspace_id: WORKSPACE_ID,
    name: "Présentation client",
    status: "active",
    due_date: iso(-1), // overdue → PROJECT_AT_RISK / DEADLINE_RISK
    progress: 40,
    updated_at: iso(-1),
    created_at: iso(-12),
  },
]);
await insert("tasks", [
  {
    id: "task-slides-blocked",
    workspace_id: WORKSPACE_ID,
    title: "Finaliser les slides",
    status: "blocked",
    priority: "high",
    due_at: iso(-2), // overdue + blocked → critical signals
    completed_at: null,
    project_id: "proj-slides",
    updated_at: iso(-1),
    created_at: iso(-8),
  },
  {
    id: "task-payment-blocked",
    workspace_id: WORKSPACE_ID,
    title: "Connecter Payment API",
    status: "blocked",
    priority: "urgent",
    due_at: iso(-4),
    completed_at: null,
    project_id: "proj-slides",
    updated_at: iso(-2),
    created_at: iso(-10),
  },
  {
    id: "task-slides-content",
    workspace_id: WORKSPACE_ID,
    title: "Rédiger le plan de la présentation",
    status: "in_progress",
    priority: "medium",
    due_at: iso(1),
    completed_at: null,
    project_id: "proj-slides",
    updated_at: iso(0),
    created_at: iso(-6),
  },
]);

// ------------------------------------------------------------------
// 2. Real activity rows for the "Recent context" section.
// ------------------------------------------------------------------
await insert("activities", [
  {
    id: "act-1",
    workspace_id: WORKSPACE_ID,
    entity_type: "task",
    action: "updated",
    metadata: { title: "Finaliser les slides" },
    actor_id: uid,
    created_at: iso(0),
  },
  {
    id: "act-2",
    workspace_id: WORKSPACE_ID,
    entity_type: "project",
    action: "created",
    metadata: { title: "Présentation client" },
    actor_id: uid,
    created_at: iso(-1),
  },
  {
    id: "act-3",
    workspace_id: WORKSPACE_ID,
    entity_type: "task",
    action: "completed",
    metadata: { title: "Réserver la salle" },
    actor_id: uid,
    created_at: iso(-1),
  },
]);

// ------------------------------------------------------------------
// 3. An active mission, blocked on step 2, stored in the exact shape
//    normalizeMissionRow reads (same contract as migration 025).
// ------------------------------------------------------------------
const steps = [
  {
    id: "step-1",
    title: "Clarifier l'objectif de la présentation",
    description: "Un objectif écrit, validé contre le projet réel.",
    status: "completed",
    order: 0,
    dependencies: [],
    completionRule: { kind: "plan_ready" },
    targetEntity: { type: "project", id: "proj-slides", label: "Présentation client" },
    action: null,
    verification: { verified: true, summary: "Projet réel trouvé", matched: ["project"], mismatched: [] },
    blockedReason: null,
    createdAt: iso(-6),
    updatedAt: iso(-5),
  },
  {
    id: "step-2",
    title: "Finaliser les slides",
    description: "La tâche « Finaliser les slides » existe mais elle est bloquée.",
    status: "blocked",
    order: 1,
    dependencies: ["step-1"],
    completionRule: { kind: "no_linked_blocked" },
    targetEntity: { type: "task", id: "task-slides-blocked", label: "Finaliser les slides" },
    action: {
      id: "act-unblock-slides",
      type: "update_task",
      label: "Débloquer « Finaliser les slides »",
      description: "Repasse la tâche en cours — mutation vérifiée côté serveur.",
      confirmationRequired: true,
      risk: "medium",
      payload: { taskId: "task-slides-blocked", status: "in_progress" },
    },
    verification: null,
    blockedReason:
      "Cette étape dépend de la tâche « Connecter Payment API », elle-même bloquée depuis 4 jours.",
    createdAt: iso(-6),
    updatedAt: iso(-1),
  },
  {
    id: "step-3",
    title: "Répéter la présentation",
    description: "Une répétition chronométrée avant vendredi.",
    status: "planned",
    order: 2,
    dependencies: ["step-2"],
    completionRule: { kind: "linked_tasks_exist" },
    targetEntity: null,
    action: null,
    verification: null,
    blockedReason: null,
    createdAt: iso(-6),
    updatedAt: iso(-6),
  },
];

await insert("intelligence_missions", [
  {
    id: "mission-preview",
    user_id: uid,
    workspace_id: WORKSPACE_ID,
    title: "Préparer ma présentation",
    objective: "Une présentation client prête et répétée pour vendredi.",
    kind: "prepare",
    status: "blocked",
    progress: 33,
    current_step_id: "step-2",
    steps,
    context: {
      relatedTaskIds: ["task-slides-blocked", "task-payment-blocked", "task-slides-content"],
      relatedProjectIds: ["proj-slides"],
      keyword: "présentation",
      deadline: iso(3),
      deadlineLabel: "vendredi",
      blockerLabels: ["Connecter Payment API", "Finaliser les slides"],
      blockerTaskIds: ["task-payment-blocked", "task-slides-blocked"],
      signals: [
        { type: "BLOCKED_WORK", title: "2 tâches bloquées dans « Présentation client »", severity: "critical" },
        { type: "DEADLINE_RISK", title: "Échéance dépassée pour « Présentation client »", severity: "warning" },
      ],
    },
    next_best_action: {
      stepId: "step-2",
      label: "Débloquer « Finaliser les slides »",
      reason: "C'est la seule étape active, et elle ne demande qu'un changement de statut vérifiable.",
      kind: "mutate",
      action: steps[1].action,
    },
    last_evaluated_at: iso(0),
    created_at: iso(-6),
    updated_at: iso(0),
  },
]);

console.log(`[preview-mobile] stub ready on ${stub.url}`);
console.log("[preview-mobile] seeded: 1 blocked mission, 3 tasks, 1 project, 3 activities");
console.log("[preview-mobile] login: owner@nexus.test / any password");
