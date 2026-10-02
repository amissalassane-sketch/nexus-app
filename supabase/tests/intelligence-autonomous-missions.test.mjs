// ============================================================
// NEXUS INTELLIGENCE — AUTONOMOUS MISSIONS CONTRACT TESTS
// Hermetic tests verifying multi-step traversal, deterministic
// completion rules, blocker diagnostic paths, and proposal synthesis.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";

const {
  evaluateStepRule,
  computeUnblockingPaths,
  advanceAutonomousMission,
  synthesizeMissionFromProposal,
  handleOrchestrateMissionRequest,
} = await import("../../src/lib/intelligence/autonomous-orchestrator.ts");

test("evaluateStepRule accurately verifies snapshot conditions", () => {
  const snapshot = {
    tasks: [
      { id: "t-1", title: "Task 1", status: "done", due_at: "2026-10-05T00:00:00Z" },
      { id: "t-2", title: "Task 2", status: "todo", due_at: "2026-10-06T00:00:00Z" },
    ],
    projects: [],
    goals: [],
  };

  const dummyStep = {
    id: "step-1",
    title: "Test",
    description: "",
    status: "ready",
    order: 1,
    dependencies: [],
    completionRule: { kind: "linked_tasks_exist" },
    targetEntity: { type: "task", id: "t-1", label: "Task 1" },
    action: null,
    verification: null,
    createdAt: "",
    updatedAt: "",
  };

  // 1. linked_tasks_exist
  assert.equal(evaluateStepRule({ kind: "linked_tasks_exist" }, dummyStep, ["t-1"], snapshot), true);
  assert.equal(evaluateStepRule({ kind: "linked_tasks_exist" }, dummyStep, ["t-unknown"], snapshot), false);

  // 2. target_done
  assert.equal(evaluateStepRule({ kind: "target_done" }, dummyStep, ["t-1"], snapshot), true);
  const unDoneStep = { ...dummyStep, targetEntity: { type: "task", id: "t-2", label: "Task 2" } };
  assert.equal(evaluateStepRule({ kind: "target_done" }, unDoneStep, ["t-2"], snapshot), false);

  // 3. linked_tasks_dated
  assert.equal(evaluateStepRule({ kind: "linked_tasks_dated" }, dummyStep, ["t-1", "t-2"], snapshot), true);
});

test("advanceAutonomousMission unblocks next step and records checkpoint when rule passes", () => {
  const mission = {
    id: "mission-1",
    userId: "u-1",
    workspaceId: "ws-1",
    title: "Project Delivery",
    objective: "Ship the milestone",
    kind: "prepare",
    status: "active",
    progress: 0,
    currentStepId: "step-1",
    context: {
      relatedTaskIds: ["t-1", "t-2"],
      relatedProjectIds: [],
      keyword: "milestone",
      deadline: null,
      deadlineLabel: null,
      blockerLabels: [],
      blockerTaskIds: [],
      signals: [],
    },
    steps: [
      {
        id: "step-1",
        title: "Complete Core",
        description: "Finish task 1",
        status: "ready",
        order: 1,
        dependencies: [],
        completionRule: { kind: "target_done" },
        targetEntity: { type: "task", id: "t-1", label: "Task 1" },
        action: null,
        verification: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "step-2",
        title: "Deploy Milestone",
        description: "Deploy once core is done",
        status: "blocked",
        order: 2,
        dependencies: ["step-1"],
        completionRule: { kind: "target_done" },
        targetEntity: { type: "task", id: "t-2", label: "Task 2" },
        action: {
          id: "act-deploy",
          type: "complete_task",
          label: "Deploy",
          confirmationRequired: true,
        },
        verification: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    nextBestAction: null,
    lastEvaluatedAt: "",
    createdAt: "",
    updatedAt: "",
  };

  // Case A: t-1 is still open -> step 1 remains ready, step 2 remains blocked
  const openSnapshot = {
    tasks: [
      { id: "t-1", title: "Task 1", status: "todo" },
      { id: "t-2", title: "Task 2", status: "todo" },
    ],
    projects: [],
    goals: [],
  };

  const progressA = advanceAutonomousMission(mission, openSnapshot, "fr");
  assert.equal(progressA.mission.steps[0].status, "ready");
  assert.equal(progressA.mission.steps[1].status, "blocked");
  assert.equal(progressA.isComplete, false);
  assert.equal(progressA.unblockingPaths.length, 1);
  assert.equal(progressA.unblockingPaths[0].blockedByStepId, "step-1");

  // Case B: t-1 is completed -> step 1 completes, step 2 unblocks to ready
  const completedSnapshot = {
    tasks: [
      { id: "t-1", title: "Task 1", status: "done" },
      { id: "t-2", title: "Task 2", status: "todo" },
    ],
    projects: [],
    goals: [],
  };

  const progressB = advanceAutonomousMission(mission, completedSnapshot, "fr");
  assert.equal(progressB.hasAdvanced, true);
  assert.equal(progressB.mission.steps[0].status, "completed");
  assert.equal(progressB.mission.steps[1].status, "ready");
  assert.equal(progressB.mission.currentStepId, "step-2");
  assert.equal(progressB.mission.progress, 50);
  assert.ok(progressB.checkpoint);
  assert.equal(progressB.checkpoint.stepId, "step-1");
  assert.equal(progressB.checkpoint.newStatus, "completed");

  // Case C: t-2 is also completed -> mission completes 100%
  const allDoneSnapshot = {
    tasks: [
      { id: "t-1", title: "Task 1", status: "done" },
      { id: "t-2", title: "Task 2", status: "done" },
    ],
    projects: [],
    goals: [],
  };

  const progressC = advanceAutonomousMission(mission, allDoneSnapshot, "fr");
  assert.equal(progressC.isComplete, true);
  assert.equal(progressC.mission.status, "completed");
  assert.equal(progressC.mission.progress, 100);
});

test("computeUnblockingPaths diagnoses dependency bottlenecks with recommended actions", () => {
  const steps = [
    {
      id: "step-1",
      title: "Preparation",
      description: "",
      status: "ready",
      order: 1,
      dependencies: [],
      completionRule: { kind: "plan_ready" },
      targetEntity: null,
      action: { id: "act-prep", type: "open_task", label: "Prepare", confirmationRequired: false },
      verification: null,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "step-2",
      title: "Launch",
      description: "",
      status: "blocked",
      order: 2,
      dependencies: ["step-1"],
      completionRule: { kind: "action_verified" },
      targetEntity: null,
      action: null,
      verification: null,
      createdAt: "",
      updatedAt: "",
    },
  ];

  const dummyMission = { id: "m-1" };
  const unblocking = computeUnblockingPaths(dummyMission, steps, "fr");

  assert.equal(unblocking.length, 1);
  assert.equal(unblocking[0].stepId, "step-2");
  assert.equal(unblocking[0].blockedByStepId, "step-1");
  assert.match(unblocking[0].reason, /Preparation/);
});

test("synthesizeMissionFromProposal generates a valid 3-step operational mission", () => {
  const proposal = {
    id: "prop-reschedule-1",
    workspaceId: "ws-1",
    kind: "reschedule_overdue",
    title: "Replanification de 3 retards",
    description: "Replanifier les tâches en retard",
    severity: "critical",
    diffItems: [
      { entityId: "t-1", entityType: "task", title: "Task 1", field: "due_at", currentValue: null, proposedValue: "2026-10-03", reason: "" },
      { entityId: "t-2", entityType: "task", title: "Task 2", field: "due_at", currentValue: null, proposedValue: "2026-10-04", reason: "" },
    ],
    actions: [
      { id: "act-1", type: "update_task", label: "Replanifier Task 1", confirmationRequired: true },
    ],
    estimatedTimeSavedMinutes: 15,
    generatedAt: "2026-10-02T10:00:00Z",
  };

  const mission = synthesizeMissionFromProposal({
    workspaceId: "ws-1",
    userId: "user-test",
    proposal,
    language: "fr",
  });

  assert.equal(mission.workspaceId, "ws-1");
  assert.equal(mission.userId, "user-test");
  assert.equal(mission.steps.length, 3);
  assert.equal(mission.currentStepId, "step-1-review");
  assert.deepEqual(mission.context.relatedTaskIds, ["t-1", "t-2"]);
  assert.equal(mission.steps[0].status, "ready");
  assert.equal(mission.steps[1].status, "planned");
  assert.equal(mission.steps[1].dependencies[0], "step-1-review");
});

function createOrchestratorDb({ missionRow = null, tasks = [], projects = [] } = {}) {
  const writes = [];
  const missionFilters = [];
  const missionQuery = {
    eq: (field, value) => {
      missionFilters.push([field, value]);
      return missionQuery;
    },
    maybeSingle: async () => ({ data: missionRow, error: null }),
  };
  const updateQuery = {
    eq: () => updateQuery,
    select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
  };
  const db = {
    from: (table) => {
      if (table === "intelligence_missions") {
        return {
          select: () => missionQuery,
          update: (payload) => {
            writes.push({ kind: "update", payload });
            return updateQuery;
          },
          insert: async (payload) => {
            writes.push({ kind: "insert", payload });
            return { error: null };
          },
        };
      }
      const rows = table === "tasks" ? tasks : projects;
      return { select: () => ({ eq: async () => ({ data: rows, error: null }) }) };
    },
  };
  return { db, writes, missionFilters };
}

const validProposal = {
  id: "prop-1",
  workspaceId: "ws-1",
  kind: "reschedule_overdue",
  title: "Test Proposal",
  description: "Resolve overdue work",
  severity: "warning",
  diffItems: [],
  actions: [],
  estimatedTimeSavedMinutes: 10,
  generatedAt: "2026-10-02T10:00:00Z",
};

test("handleOrchestrateMissionRequest authenticates, validates, and persists synthesis", async () => {
  const dummyDb = {
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: true }) }) }) }) }),
  };

  // 1. Missing userId -> 401
  const res401 = await handleOrchestrateMissionRequest({
    db: dummyDb,
    userId: null,
    workspaceId: "ws-1",
  });
  assert.equal(res401.status, 401);

  // 2. Missing workspaceId -> 400
  const res400 = await handleOrchestrateMissionRequest({
    db: dummyDb,
    userId: "u-1",
    workspaceId: null,
  });
  assert.equal(res400.status, 400);

  // 3. Malformed proposals fail at the boundary instead of throwing a 500.
  const invalid = await handleOrchestrateMissionRequest({
    db: dummyDb,
    userId: "u-1",
    workspaceId: "ws-1",
    proposal: { kind: "reschedule_overdue", diffItems: {} },
  });
  assert.equal(invalid.status, 422);

  // 4. A valid proposal produces a trackable, persisted mission.
  const { db, writes } = createOrchestratorDb();

  const resSynth = await handleOrchestrateMissionRequest({
    db,
    userId: "u-1",
    workspaceId: "ws-1",
    proposal: validProposal,
  });

  assert.equal(resSynth.status, 200);
  assert.ok(resSynth.body.mission);
  assert.equal(resSynth.body.mission.steps.length, 3);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].payload.user_id, "u-1");
  assert.equal(writes[1].payload.workspace_id, "ws-1");
});

test("handleOrchestrateMissionRequest normalizes, scopes, and persists mission progress", async () => {
  const { db, writes, missionFilters } = createOrchestratorDb({
    missionRow: {
      id: "mission-1",
      user_id: "u-1",
      workspace_id: "ws-1",
      title: "Finish delivery",
      objective: "Ship it",
      kind: "general",
      status: "active",
      progress: 0,
      current_step_id: "step-1",
      steps: [{
        id: "step-1",
        title: "Finish task",
        description: "Complete task t-1",
        status: "ready",
        order: 1,
        dependencies: [],
        completionRule: { kind: "target_done" },
        targetEntity: { type: "task", id: "t-1", label: "Task 1" },
        action: null,
        verification: null,
        createdAt: "2026-10-02T10:00:00Z",
        updatedAt: "2026-10-02T10:00:00Z",
      }],
      context: { relatedTaskIds: ["t-1"], relatedProjectIds: [], keyword: null, deadline: null, deadlineLabel: null, blockerLabels: [], blockerTaskIds: [], signals: [] },
      next_best_action: null,
      last_evaluated_at: "2026-10-02T10:00:00Z",
      created_at: "2026-10-02T10:00:00Z",
      updated_at: "2026-10-02T10:00:00Z",
    },
    tasks: [{ id: "t-1", title: "Task 1", status: "done", due_at: null, completed_at: "2026-10-02T10:00:00Z" }],
  });

  const result = await handleOrchestrateMissionRequest({ db, userId: "u-1", workspaceId: "ws-1", missionId: "mission-1" });

  assert.equal(result.status, 200);
  assert.equal(result.body.mission.userId, "u-1");
  assert.equal(result.body.mission.workspaceId, "ws-1");
  assert.equal(result.body.mission.status, "completed");
  assert.deepEqual(missionFilters, [["id", "mission-1"], ["workspace_id", "ws-1"], ["user_id", "u-1"]]);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].payload.status, "completed");
});
