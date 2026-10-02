// ============================================================
// NEXUS INTELLIGENCE — PROACTIVE AUTOMATION CONTRACT TESTS
// Hermetic tests verifying batch proposal generation, overdue
// rescheduling, stale task archival, workload rebalancing,
// and the mandatory Human-in-the-Loop confirmation gate.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";

const {
  addDays,
  detectOverdueRescheduling,
  detectStaleTaskArchival,
  detectWorkloadConflicts,
  detectAutomationProposals,
  handleAutomationRequest,
} = await import("../../src/lib/intelligence/proactive-automation.ts");

const TODAY = "2026-10-02";
const YESTERDAY = "2026-10-01";
const LAST_MONTH = "2026-08-15";

test("addDays arithmetic shifts civil dates across days and month boundaries", () => {
  assert.equal(addDays("2026-10-02", 1), "2026-10-03");
  assert.equal(addDays("2026-10-02", 0), "2026-10-02");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("detectOverdueRescheduling returns null when no tasks are overdue", () => {
  const snapshot = {
    tasks: [
      { id: "t-1", title: "Future Task", status: "todo", due_at: "2026-10-15T12:00:00Z" },
      { id: "t-2", title: "Today Task", status: "in_progress", due_at: `${TODAY}T12:00:00Z` },
    ],
    projects: [],
    goals: [],
  };

  const proposal = detectOverdueRescheduling(snapshot, TODAY, "fr");
  assert.equal(proposal, null);
});

test("detectOverdueRescheduling generates forward proposals with mandatory confirmation", () => {
  const snapshot = {
    tasks: [
      { id: "t-overdue-1", title: "Overdue 1", status: "todo", due_at: `${YESTERDAY}T10:00:00Z`, priority: "urgent" },
      { id: "t-overdue-2", title: "Overdue 2", status: "todo", due_at: "2026-09-28T10:00:00Z", priority: "high" },
      { id: "t-overdue-3", title: "Overdue 3", status: "todo", due_at: "2026-09-25T10:00:00Z", priority: "medium" },
    ],
    projects: [],
    goals: [],
  };

  const proposal = detectOverdueRescheduling(snapshot, TODAY, "fr");
  assert.ok(proposal);
  assert.equal(proposal.kind, "reschedule_overdue");
  assert.equal(proposal.severity, "critical"); // >=3 items
  assert.equal(proposal.diffItems.length, 3);
  assert.equal(proposal.actions.length, 3);

  // Every action must require human confirmation
  for (const action of proposal.actions) {
    assert.equal(action.confirmationRequired, true, "Actions must be confirmation-gated");
    assert.equal(action.type, "update_task");
    assert.ok(action.payload?.dueDate);
    // Proposed date must be today or future (never in the past)
    const proposedCivil = action.payload.dueDate.slice(0, 10);
    assert.ok(proposedCivil >= TODAY, "Proposed date must not be in the past");
  }
});

test("detectStaleTaskArchival detects tasks inactive > 30 days and ignores fresh tasks", () => {
  const snapshot = {
    tasks: [
      { id: "t-fresh", title: "Fresh Task", status: "todo", updated_at: `${TODAY}T09:00:00Z` },
      { id: "t-future-due", title: "Future Due", status: "todo", due_at: "2026-10-20T00:00:00Z", updated_at: `${LAST_MONTH}T00:00:00Z` },
      { id: "t-stale", title: "Stale Task", status: "todo", updated_at: `${LAST_MONTH}T00:00:00Z` },
    ],
    projects: [],
    goals: [],
  };

  const proposal = detectStaleTaskArchival(snapshot, TODAY, 30, "fr");
  assert.ok(proposal);
  assert.equal(proposal.kind, "archive_stale");
  assert.equal(proposal.diffItems.length, 1);
  assert.equal(proposal.diffItems[0].entityId, "t-stale");
  assert.equal(proposal.diffItems[0].proposedValue, "archived");

  assert.equal(proposal.actions.length, 1);
  assert.equal(proposal.actions[0].confirmationRequired, true);
  assert.equal(proposal.actions[0].payload?.status, "archived");
});

test("detectWorkloadConflicts identifies days overloaded with tasks and redistributes excess", () => {
  const snapshot = {
    tasks: [
      { id: "t-1", title: "Task 1", status: "todo", due_at: `${TODAY}T09:00:00Z`, priority: "urgent" },
      { id: "t-2", title: "Task 2", status: "todo", due_at: `${TODAY}T10:00:00Z`, priority: "high" },
      { id: "t-3", title: "Task 3", status: "todo", due_at: `${TODAY}T11:00:00Z`, priority: "high" },
      { id: "t-4", title: "Task 4", status: "todo", due_at: `${TODAY}T12:00:00Z`, priority: "medium" },
      { id: "t-5", title: "Task 5", status: "todo", due_at: `${TODAY}T14:00:00Z`, priority: "low" },
      { id: "t-6", title: "Task 6", status: "todo", due_at: `${TODAY}T16:00:00Z`, priority: "low" },
    ],
    projects: [],
    goals: [],
  };

  // Max 4 tasks per day -> 2 excess tasks shifted
  const proposal = detectWorkloadConflicts(snapshot, TODAY, 4, "fr");
  assert.ok(proposal);
  assert.equal(proposal.kind, "rebalance_workload");
  assert.equal(proposal.diffItems.length, 2);
  assert.equal(proposal.actions.length, 2);

  // The 2 excess tasks are the lowest priority (low)
  assert.equal(proposal.diffItems[0].entityId, "t-5");
  assert.equal(proposal.diffItems[1].entityId, "t-6");

  // Rebalanced dates are in the future
  for (const action of proposal.actions) {
    assert.equal(action.confirmationRequired, true);
    assert.ok(action.payload?.dueDate?.slice(0, 10) > TODAY);
  }
});

test("detectAutomationProposals aggregates multiple proposals and sets workspaceId", () => {
  const snapshot = {
    tasks: [
      { id: "t-overdue", title: "Late", status: "todo", due_at: `${YESTERDAY}T00:00:00Z` },
      { id: "t-stale", title: "Old", status: "todo", updated_at: `${LAST_MONTH}T00:00:00Z` },
    ],
    projects: [],
    goals: [],
  };

  const proposals = detectAutomationProposals(snapshot, {
    workspaceId: "ws-target",
    civilDate: TODAY,
  });

  assert.equal(proposals.length, 2);
  assert.equal(proposals[0].workspaceId, "ws-target");
  assert.equal(proposals[1].workspaceId, "ws-target");
});

test("handleAutomationRequest authentication and error contract", async () => {
  const dummyDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: [] }) }),
          limit: () => Promise.resolve({ data: [] }),
          then: (fn) => fn({ data: [] }),
        }),
      }),
    }),
  };

  // 1. Missing userId -> 401
  const res401 = await handleAutomationRequest({
    db: dummyDb,
    userId: null,
    workspaceId: "ws-1",
  });
  assert.equal(res401.status, 401);
  assert.match(res401.body.error, /Authentication/);

  // 2. Missing workspaceId -> 400
  const res400 = await handleAutomationRequest({
    db: dummyDb,
    userId: "user-1",
    workspaceId: null,
  });
  assert.equal(res400.status, 400);
  assert.match(res400.body.error, /workspace/);

  // 3. Authenticated request -> 200 with { proposals }
  const res200 = await handleAutomationRequest({
    db: dummyDb,
    userId: "user-1",
    workspaceId: "ws-1",
    civilDate: TODAY,
  });
  assert.equal(res200.status, 200);
  assert.ok(Array.isArray(res200.body.proposals));
});
