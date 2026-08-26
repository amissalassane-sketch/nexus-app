// ============================================================
// NEXUS INTELLIGENCE — PLANNER
// ============================================================
// Builds an explicit, honest plan for complex requests. Every step
// is derived from real workspace rows (via the snapshot / tool
// results). The plan is displayed as a useful summary — never as a
// private chain-of-thought.
// ============================================================

import { isActiveTask, type WorkspaceSnapshot } from "./engine";
import type {
  IntelligencePlan,
  IntelligencePlanStep,
  IntelligenceIntentId,
  SessionHistoryItem,
} from "./types";
import type { WorkspaceContextSummary } from "./context-builder";

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Very light FR/EN detection used only to localize the plan summary. */
function isFrench(query: string): boolean {
  return /(^|\s)(je|j'ai|ma|mes|mon|les|des|est|sont|pour|une|un|la|le|du|de|fait|fais|mets|quels|quelles|quoi|tâches|taches|projets|journée|journee|semaine|retard|bloqué|bloquées|priorité|urgent|aujourd|crée|cree|supprime|annule|organise|prépare|prepare|résume|resume)/i.test(
    query
  );
}

export interface PlannerInput {
  intentId: IntelligenceIntentId;
  query: string;
  snapshot: WorkspaceSnapshot;
  context: WorkspaceContextSummary;
  sessionHistory?: SessionHistoryItem[];
}

/**
 * Builds the recommended plan for a request. Returns undefined when
 * the request does not need an explicit plan (pure reads, searches).
 */
export function buildPlan(input: PlannerInput): IntelligencePlan | undefined {
  const { intentId, query, snapshot, context } = input;
  const now = snapshot.now ?? new Date();
  const fr = isFrench(query);
  const openTasks = snapshot.tasks.filter(isActiveTask);
  const projects = snapshot.projects;
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const overdue = openTasks.filter((t) => {
    const due = asDate(t.due_at);
    return due !== null && due.getTime() < now.getTime();
  });
  const blocked = openTasks.filter((t) => t.status === "blocked");
  const dueToday = openTasks.filter((t) => {
    const due = asDate(t.due_at);
    return due !== null && due.toDateString() === now.toDateString();
  });
  const weekAhead = now.getTime() + 7 * 86_400_000;
  const dueThisWeek = openTasks.filter((t) => {
    const due = asDate(t.due_at);
    return due !== null && due.getTime() >= now.getTime() && due.getTime() <= weekAhead;
  });

  const analyzeSummary = (): string =>
    fr
      ? `J'ai analysé ${plural(projects.length, "projet")} et ${plural(openTasks.length, "tâche")} ouverte${openTasks.length === 1 ? "" : "s"}. Voici le plan que je recommande.`
      : `I analyzed ${plural(projects.length, "project")} and ${plural(openTasks.length, "open task")}. Here is the plan I recommend.`;

  // ---- PLANNING --------------------------------------------------
  if (intentId === "PLAN") {
    const steps: IntelligencePlanStep[] = [];
    if (overdue.length > 0) {
      steps.push({
        id: "plan-overdue",
        title: fr
          ? `1. Éliminer la dette de retard (${plural(overdue.length, "tâche")})`
          : `1. Clear overdue debt (${plural(overdue.length, "task")})`,
        description: fr
          ? `Commencer par “${overdue[0].title}” — la tâche la plus ancienne en retard.`
          : `Start with “${overdue[0].title}” — the oldest overdue task.`,
        href: "/tasks?filter=overdue",
      });
    }
    if (blocked.length > 0) {
      steps.push({
        id: "plan-unblock",
        title: fr
          ? `2. Débloquer le travail (${plural(blocked.length, "tâche")})`
          : `2. Unblock stalled work (${plural(blocked.length, "task")})`,
        description: fr
          ? `“${blocked[0].title}”${blocked[0].project_id ? ` dans “${projectMap.get(blocked[0].project_id)}”` : ""} bloque ce qui en dépend.`
          : `“${blocked[0].title}”${blocked[0].project_id ? ` in “${projectMap.get(blocked[0].project_id)}”` : ""} stalls everything downstream.`,
        href: "/tasks?filter=blocked",
      });
    }
    if (dueToday.length > 0) {
      steps.push({
        id: "plan-today",
        title: fr
          ? `3. Protéger les échéances du jour (${plural(dueToday.length, "tâche")})`
          : `3. Protect today's commitments (${plural(dueToday.length, "task")})`,
        description: dueToday.slice(0, 2).map((t) => `“${t.title}”`).join(", "),
        href: "/tasks?filter=today",
      });
    }
    if (dueThisWeek.length > 0) {
      steps.push({
        id: "plan-week",
        title: fr
          ? `4. Avancer les jalons de la semaine (${plural(dueThisWeek.length, "tâche")})`
          : `4. Advance weekly milestones (${plural(dueThisWeek.length, "task")})`,
        description: fr
          ? "Répartir le travail sur les prochains jours, en gardant de la marge pour les imprévus."
          : "Spread the work across the coming days with margin for surprises.",
        href: "/tasks",
      });
    }
    if (steps.length === 0) {
      steps.push({
        id: "plan-clear",
        title: fr
          ? "Aucune pression d'échéance détectée"
          : "No deadline pressure detected",
        description: fr
          ? "Créneau idéal pour le travail stratégique de fond ou pour démarrer un nouveau projet."
          : "A good window for strategic deep work or starting a new project.",
        href: "/projects?create=1",
      });
    }
    return {
      summary: analyzeSummary(),
      steps,
      needsConfirmation: false,
    };
  }

  // ---- PRIORITIZATION -------------------------------------------
  if (intentId === "PRIORITIZE") {
    const top = [...openTasks]
      .sort((a, b) => {
        const w = (p: string | null | undefined) =>
          ({ urgent: 4, high: 3, medium: 2, low: 1 }[p ?? ""] ?? 0);
        return w(b.priority) - w(a.priority);
      })
      .slice(0, 3);
    if (top.length === 0) return undefined;
    const slots = ["09:00", "11:00", "14:00", "16:00"];
    const steps: IntelligencePlanStep[] = top.map((task, index) => ({
      id: `focus-${task.id}`,
      title: `${slots[index] ?? ""} — ${task.title}`.trim(),
      description: [
        task.priority ? `${task.priority}` : "",
        task.due_at
          ? `${daysUntil(asDate(task.due_at)!, now) === 0 ? (fr ? "aujourd'hui" : "today") : daysUntil(asDate(task.due_at)!, now) > 0 ? `${fr ? "dans" : "in"} ${daysUntil(asDate(task.due_at)!, now)}j` : `${Math.abs(daysUntil(asDate(task.due_at)!, now))}j ${fr ? "de retard" : "late"}`}`
          : "",
        task.project_id ? projectMap.get(task.project_id) ?? "" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      href: "/tasks",
    }));
    return {
      summary: fr
        ? `J'ai analysé ${plural(openTasks.length, "tâche")} ouverte${openTasks.length === 1 ? "" : "s"}. Voici ce que je recommande de faire en premier.`
        : `I analyzed ${plural(openTasks.length, "open task")}. Here is what I recommend doing first.`,
      steps,
      needsConfirmation: false,
    };
  }

  // ---- DETECTION → recovery plan --------------------------------
  if (intentId === "DETECT") {
    const steps: IntelligencePlanStep[] = [];
    if (blocked.length > 0) {
      steps.push({
        id: "recover-unblock",
        title: fr
          ? `Débloquer ${plural(blocked.length, "tâche")}`
          : `Unblock ${plural(blocked.length, "task")}`,
        description: fr
          ? `Commencer par “${blocked[0].title}” pour relancer le travail dépendant.`
          : `Start with “${blocked[0].title}” to free dependent work.`,
        href: "/tasks?filter=blocked",
      });
    }
    if (overdue.length > 0) {
      steps.push({
        id: "recover-overdue",
        title: fr
          ? `Rattraper ${plural(overdue.length, "tâche")} en retard`
          : `Catch up on ${plural(overdue.length, "overdue task")}`,
        description: fr
          ? `Planifier un créneau de rattrapage pour “${overdue[0].title}”.`
          : `Schedule a catch-up slot for “${overdue[0].title}”.`,
        href: "/tasks?filter=overdue",
      });
    }
    if (steps.length === 0) return undefined;
    return {
      summary: analyzeSummary(),
      steps,
      needsConfirmation: false,
    };
  }

  // ---- CREATE (task/project/goal) → one-step plan with action ---
  if (intentId === "CREATE") {
    return undefined; // The create proposal is already an explicit action card.
  }

  // ---- ANALYSIS → attention plan --------------------------------
  if (intentId === "ANALYZE") {
    const atRisk = context.projectsNeedingAttention.slice(0, 3);
    if (atRisk.length === 0) return undefined;
    const steps: IntelligencePlanStep[] = atRisk.map((p, index) => ({
      id: `attention-${p.id}`,
      title: `${index + 1}. ${p.name}`,
      description: p.reasons.join(", "),
      href: "/projects",
    }));
    return {
      summary: analyzeSummary(),
      steps,
      needsConfirmation: false,
    };
  }

  return undefined;
}
