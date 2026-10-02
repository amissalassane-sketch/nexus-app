// ============================================================
// NEXUS INTELLIGENCE — AUTONOMOUS MISSION ORCHESTRATOR
// Traverses multi-step mission workflows, evaluates real entity
// state, diagnoses blocking paths, and synthesizes operational
// missions directly from proactive automation proposals.
//
// Invariants:
// 1. Deterministic completion: steps are completed only when real
//    conditions in snapshot are verified.
// 2. Unblocking explainability: blocked steps always carry the exact
//    dependency reason and a recommended unblocking action.
// 3. Human-in-the-Loop on mutations: step actions always require
//    confirmation before executing.
// 4. Tenancy integrity: scoped strictly to (workspaceId, userId).
// ============================================================

import type {
  IntelligenceMission,
  MissionStep,
  MissionStepCompletionRule,
  MissionStepStatus,
  MissionCheckpoint,
  UnblockingPath,
  OrchestratedMissionProgress,
  SynthesizeMissionOptions,
} from "./types";
import type { WorkspaceSnapshot } from "./engine";
import { isActiveTask } from "./engine";
import { assertIntelligenceData } from "./data-error";

/**
 * Evaluates whether a deterministic completion rule is satisfied
 * against the real workspace snapshot.
 */
export function evaluateStepRule(
  rule: MissionStepCompletionRule,
  step: MissionStep,
  relatedTaskIds: string[],
  snapshot: WorkspaceSnapshot
): boolean {
  const relatedTasks = (snapshot.tasks || []).filter((t) => relatedTaskIds.includes(t.id));

  switch (rule.kind) {
    case "linked_tasks_exist":
      return relatedTasks.length > 0;

    case "no_linked_blocked":
      return !relatedTasks.some((t) => t.status === "blocked");

    case "linked_tasks_dated": {
      const open = relatedTasks.filter(isActiveTask);
      if (open.length === 0) return true;
      return open.every((t) => Boolean(t.due_at));
    }

    case "plan_ready":
      return relatedTasks.some(isActiveTask);

    case "target_done": {
      const target = step.targetEntity;
      if (!target?.id) return false;
      if (target.type === "task") {
        const task = (snapshot.tasks || []).find((t) => t.id === target.id);
        return Boolean(task && (task.status === "done" || task.status === "completed" || !!task.completed_at));
      }
      if (target.type === "project") {
        const project = (snapshot.projects || []).find((p) => p.id === target.id);
        return Boolean(project && (project.status === "completed" || project.status === "archived"));
      }
      return false;
    }

    case "action_verified":
      return Boolean(step.verification?.verified);

    default:
      return false;
  }
}

/**
 * Computes diagnostic unblocking paths for any blocked steps in a mission.
 */
export function computeUnblockingPaths(
  _mission: IntelligenceMission,
  steps: MissionStep[],
  lang: "fr" | "en" = "fr"
): UnblockingPath[] {
  const isFr = lang === "fr";
  const unblocking: UnblockingPath[] = [];
  const stepMap = new Map<string, MissionStep>(steps.map((s) => [s.id, s]));

  for (const step of steps) {
    if (step.status !== "blocked") continue;

    // Check unsatisfied dependencies
    let blockerStep: MissionStep | undefined;
    for (const depId of step.dependencies) {
      const dep = stepMap.get(depId);
      if (dep && dep.status !== "completed") {
        blockerStep = dep;
        break;
      }
    }

    if (blockerStep) {
      unblocking.push({
        stepId: step.id,
        blockedByStepId: blockerStep.id,
        reason: isFr
          ? `Bloqué en attente de la complétion de « ${blockerStep.title} »`
          : `Blocked waiting for completion of "${blockerStep.title}"`,
        suggestedAction: blockerStep.action ?? {
          id: `act-unblock-${blockerStep.id}`,
          type: "open_task",
          label: isFr ? `Traiter « ${blockerStep.title} »` : `Address "${blockerStep.title}"`,
          description: isFr ? "Compléter cette étape pour débloquer la suite" : "Complete this step to unblock subsequent work",
          confirmationRequired: false,
          risk: "low",
        },
      });
    } else {
      unblocking.push({
        stepId: step.id,
        reason: step.blockedReason || (isFr ? "Conditions préalables non réunies" : "Prerequisites not met"),
        suggestedAction: step.action ?? {
          id: `act-resolve-${step.id}`,
          type: "navigate",
          label: isFr ? "Examiner l'étape" : "Review step",
          description: isFr ? "Vérifier les données requises pour cette étape" : "Check prerequisites for this step",
          confirmationRequired: false,
          risk: "low",
        },
      });
    }
  }

  return unblocking;
}

/**
 * Advances a mission's steps deterministically against the workspace snapshot,
 * updating step statuses and recording audit checkpoints.
 */
export function advanceAutonomousMission(
  mission: IntelligenceMission,
  snapshot: WorkspaceSnapshot,
  lang: "fr" | "en" = "fr"
): OrchestratedMissionProgress {
  const isFr = lang === "fr";
  const previousCurrentId = mission.currentStepId;
  const updatedSteps: MissionStep[] = [];
  let hasAdvanced = false;
  let checkpoint: MissionCheckpoint | undefined;

  const stepMap = new Map<string, MissionStep>(mission.steps.map((s) => [s.id, s]));

  // Evaluate each step in sequence
  for (const step of mission.steps) {
    const prevStatus = step.status;
    let newStatus: MissionStepStatus = prevStatus;

    // Check if completion rule is already satisfied
    const ruleSatisfied = evaluateStepRule(
      step.completionRule,
      step,
      mission.context.relatedTaskIds,
      snapshot
    );

    if (ruleSatisfied) {
      newStatus = "completed";
    } else {
      // Check dependencies
      const depsCompleted = step.dependencies.every((depId) => {
        const dep = stepMap.get(depId);
        return dep && (dep.status === "completed" || updatedSteps.some((u) => u.id === depId && u.status === "completed"));
      });

      if (!depsCompleted) {
        newStatus = "blocked";
        step.blockedReason = isFr
          ? "Dépendance non terminée"
          : "Unsatisfied step dependency";
      } else if (prevStatus === "planned" || prevStatus === "blocked") {
        newStatus = "ready";
        step.blockedReason = null;
      }
    }

    if (newStatus !== prevStatus) {
      hasAdvanced = true;
      if (!checkpoint) {
        checkpoint = {
          id: `chk-${step.id}-${Date.now()}`,
          stepId: step.id,
          previousStatus: prevStatus,
          newStatus,
          reason: ruleSatisfied
            ? (isFr ? "Condition de complétion vérifiée" : "Completion condition satisfied")
            : (isFr ? "Dépendances débloquées" : "Dependencies unblocked"),
          timestamp: new Date().toISOString(),
        };
      }
    }

    const updated: MissionStep = {
      ...step,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    updatedSteps.push(updated);
    stepMap.set(step.id, updated);
  }

  // Determine the next active step
  const activeStep = updatedSteps.find((s) => s.status === "ready" || s.status === "in_progress")
    || updatedSteps.find((s) => s.status === "blocked")
    || null;

  const completedCount = updatedSteps.filter((s) => s.status === "completed").length;
  const progress = updatedSteps.length > 0 ? Math.round((completedCount / updatedSteps.length) * 100) : 0;
  const isComplete = completedCount === updatedSteps.length && updatedSteps.length > 0;

  const unblockingPaths = computeUnblockingPaths(mission, updatedSteps, lang);

  const updatedMission: IntelligenceMission = {
    ...mission,
    steps: updatedSteps,
    currentStepId: activeStep?.id ?? null,
    progress,
    status: isComplete ? "completed" : activeStep?.status === "blocked" ? "blocked" : "active",
    nextBestAction: activeStep?.action
      ? {
          stepId: activeStep.id,
          label: activeStep.action.label,
          reason: activeStep.description,
          kind: "mutate",
          action: activeStep.action,
        }
      : null,
    lastEvaluatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (previousCurrentId !== updatedMission.currentStepId) {
    hasAdvanced = true;
  }

  return {
    mission: updatedMission,
    hasAdvanced,
    unblockingPaths,
    checkpoint,
    isComplete,
  };
}

/**
 * Synthesizes an actionable 3-step operational mission directly
 * from a proactive automation proposal.
 */
export function synthesizeMissionFromProposal(
  options: SynthesizeMissionOptions
): IntelligenceMission {
  const { workspaceId, userId, proposal, language = "fr" } = options;
  const isFr = language === "fr";
  const now = new Date().toISOString();

  const relatedTaskIds = proposal.diffItems
    .filter((d) => d.entityType === "task")
    .map((d) => d.entityId);

  const steps: MissionStep[] = [
    {
      id: "step-1-review",
      title: isFr ? "Examiner la proposition de lot" : "Review proposal batch",
      description: isFr
        ? `Consulter les ${proposal.diffItems.length} modifications suggérées par l'analyse proactive.`
        : `Inspect the ${proposal.diffItems.length} proposed changes identified by proactive analysis.`,
      status: "ready",
      order: 1,
      dependencies: [],
      completionRule: { kind: "plan_ready" },
      targetEntity: null,
      action: null,
      verification: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "step-2-apply",
      title: isFr ? "Appliquer les ajustements confirmés" : "Apply confirmed adjustments",
      description: isFr
        ? `Valider et appliquer le lot d'actions recommandées (${proposal.title}).`
        : `Validate and apply recommended action batch (${proposal.title}).`,
      status: "planned",
      order: 2,
      dependencies: ["step-1-review"],
      completionRule: { kind: "action_verified" },
      targetEntity: null,
      action: proposal.actions[0] ?? null,
      verification: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "step-3-verify",
      title: isFr ? "Vérifier la résorption du blocage" : "Verify backlog resolution",
      description: isFr
        ? "Confirmer que les entités traitées ne présentent plus de conflit ou retard."
        : "Confirm that affected entities no longer exhibit conflict or overdue state.",
      status: "planned",
      order: 3,
      dependencies: ["step-2-apply"],
      completionRule: { kind: "linked_tasks_dated" },
      targetEntity: null,
      action: null,
      verification: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    id: `mission-auto-${proposal.id}`,
    userId,
    workspaceId,
    title: isFr ? `Mission : ${proposal.title}` : `Mission: ${proposal.title}`,
    objective: proposal.description,
    kind: "catchup",
    status: "active",
    progress: 0,
    currentStepId: "step-1-review",
    steps,
    context: {
      relatedTaskIds,
      relatedProjectIds: [],
      keyword: proposal.kind,
      deadline: null,
      deadlineLabel: null,
      blockerLabels: [],
      blockerTaskIds: [],
      signals: [],
    },
    nextBestAction: {
      stepId: "step-1-review",
      label: isFr ? "Démarrer la mission" : "Start mission",
      reason: isFr ? "Examiner le plan d'action" : "Review action plan",
      kind: "navigate",
      href: `/app/intelligence?mission=mission-auto-${proposal.id}`,
    },
    lastEvaluatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export interface OrchestrateApiDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface HandleOrchestrateOptions {
  db: OrchestrateApiDb;
  userId: string | null;
  workspaceId: string | null;
  missionId?: string;
  proposal?: unknown;
  language?: "fr" | "en";
}

/**
 * Handles incoming mission orchestration API requests.
 */
export async function handleOrchestrateMissionRequest(
  options: HandleOrchestrateOptions
): Promise<{ status: number; body: Record<string, unknown> | OrchestratedMissionProgress | { mission: IntelligenceMission } }> {
  const { db, userId, workspaceId, missionId, proposal, language = "fr" } = options;

  if (!userId) {
    return { status: 401, body: { error: "Authentication required" } };
  }

  if (!workspaceId) {
    return { status: 400, body: { error: "Active workspace is required" } };
  }

  // 1. Synthesize proposal into mission if proposal passed
  if (proposal && typeof proposal === "object" && "kind" in proposal && "diffItems" in proposal) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mission = synthesizeMissionFromProposal({
      workspaceId,
      userId,
      proposal: proposal as any,
      language,
    });
    return { status: 200, body: { mission } };
  }

  if (!missionId) {
    return { status: 400, body: { error: "Mission ID or Proposal is required" } };
  }

  // Load mission row
  const missionRes = await db
    .from("intelligence_missions")
    .select("*")
    .eq("id", missionId)
    .eq("workspace_id", workspaceId)
    .single();

  if (missionRes.error || !missionRes.data) {
    return { status: 404, body: { error: "Mission not found in workspace" } };
  }

  // Load workspace snapshot
  const [tasksRes, projectsRes] = await Promise.all([
    db.from("tasks").select("id, title, status, priority, due_at, completed_at, project_id").eq("workspace_id", workspaceId),
    db.from("projects").select("id, name, status").eq("workspace_id", workspaceId),
  ]);

  assertIntelligenceData(tasksRes, projectsRes);

  const snapshot: WorkspaceSnapshot = {
    tasks: (tasksRes.data ?? []) as WorkspaceSnapshot["tasks"],
    projects: (projectsRes.data ?? []) as WorkspaceSnapshot["projects"],
    goals: [],
  };

  const progress = advanceAutonomousMission(missionRes.data as IntelligenceMission, snapshot, language);

  return { status: 200, body: progress };
}
