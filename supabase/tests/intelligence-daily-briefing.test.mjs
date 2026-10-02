// ============================================================
// NEXUS INTELLIGENCE — DAILY BRIEFING ENGINE CONTRACT TESTS
// Hermetic tests verifying deterministic executive synthesis,
// priority ranking, metric calculation, alerts and tenant isolation.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";

const {
  extractCivilDate,
  computeBriefingMetrics,
  selectTopFocusItems,
  generateAttentionAlerts,
  generateScheduleSummary,
  buildDeterministicNarrative,
  generateDailyBriefing,
  clearBriefingCache,
  handleBriefingRequest,
} = await import("../../src/lib/intelligence/daily-briefing.ts");

const TODAY = "2026-10-02";
const YESTERDAY = "2026-10-01";
const TOMORROW = "2026-10-03";

test("civil date extraction handles ISO strings, Dates, and missing dates", () => {
  assert.equal(extractCivilDate("2026-10-02T14:30:00.000Z"), "2026-10-02");
  assert.equal(extractCivilDate(new Date("2026-10-02T14:30:00.000Z")), "2026-10-02");
  const extracted = extractCivilDate(null);
  assert.match(extracted, /^\d{4}-\d{2}-\d{2}$/);
});

test("empty workspace produces honest, clean zero-state without errors", async () => {
  const emptySnapshot = {
    tasks: [],
    projects: [],
    goals: [],
  };

  const briefing = await generateDailyBriefing(emptySnapshot, {
    workspaceId: "ws-empty",
    civilDate: TODAY,
    language: "fr",
    bypassCache: true,
  });

  assert.equal(briefing.workspaceId, "ws-empty");
  assert.equal(briefing.date, TODAY);
  assert.equal(briefing.metrics.totalTasksDueToday, 0);
  assert.equal(briefing.metrics.totalOverdueTasks, 0);
  assert.equal(briefing.metrics.completedTasksYesterday, 0);
  assert.equal(briefing.focusItems.length, 0);
  assert.equal(briefing.attentionAlerts.length, 0);
  assert.equal(briefing.deterministicOnly, true);
  assert.match(briefing.headline, /Espace de travail sous contrôle/i);
});

test("metrics accurately count overdue, today-due and yesterday-completed tasks", () => {
  const snapshot = {
    tasks: [
      { id: "t-1", title: "Task Due Today", status: "todo", due_at: `${TODAY}T10:00:00Z` },
      { id: "t-2", title: "Task Due Today 2", status: "in_progress", due_at: `${TODAY}T18:00:00Z` },
      { id: "t-3", title: "Overdue Task", status: "todo", due_at: `${YESTERDAY}T12:00:00Z` },
      { id: "t-4", title: "Future Task", status: "todo", due_at: `${TOMORROW}T12:00:00Z` },
      { id: "t-5", title: "Completed Yesterday", status: "done", completed_at: `${YESTERDAY}T15:00:00Z` },
      { id: "t-6", title: "Completed Long Ago", status: "done", completed_at: "2026-09-01T15:00:00Z" },
    ],
    projects: [],
    goals: [],
  };

  const metrics = computeBriefingMetrics(snapshot, TODAY, "ws-test");
  assert.equal(metrics.totalTasksDueToday, 2);
  assert.equal(metrics.totalOverdueTasks, 1);
  assert.equal(metrics.completedTasksYesterday, 1);
});

test("selectTopFocusItems clamps to 3 items and strictly prioritizes overdue > today > urgent", () => {
  const snapshot = {
    tasks: [
      { id: "t-future-low", title: "Future Low", status: "todo", due_at: "2026-10-20T00:00:00Z", priority: "low" },
      { id: "t-urgent", title: "Urgent No Date", status: "todo", priority: "urgent" },
      { id: "t-today", title: "Due Today", status: "todo", due_at: `${TODAY}T14:00:00Z`, priority: "medium" },
      { id: "t-overdue", title: "Overdue Item", status: "todo", due_at: `${YESTERDAY}T10:00:00Z`, priority: "high" },
      { id: "t-today-high", title: "Due Today High", status: "todo", due_at: `${TODAY}T16:00:00Z`, priority: "high" },
    ],
    projects: [],
    goals: [
      { id: "g-1", title: "Goal Approaching", status: "in_progress", target_date: TODAY },
    ],
  };

  const focus = selectTopFocusItems(snapshot, TODAY, "fr");
  assert.equal(focus.length, 3, "Focus items must be clamped to 3");

  // Rank 1: Overdue item (Score: 100 + 30 = 130)
  assert.equal(focus[0].id, "t-overdue");
  assert.equal(focus[0].isOverdue, true);

  // Rank 2: Today High (Score: 80 + 30 = 110)
  assert.equal(focus[1].id, "t-today-high");
  assert.equal(focus[1].dueToday, true);

  // Rank 3: Today Medium (Score: 80 + 10 = 90) or Goal/Urgent
  assert.ok(focus[2].id === "t-today" || focus[2].id === "g-1");
});

test("generateAttentionAlerts produces critical alert on overdue and caps at 5", () => {
  const snapshot = {
    tasks: [
      { id: "t-1", title: "Task 1", status: "todo" },
    ],
    projects: [
      { id: "p-empty", name: "Empty Project", status: "active" },
    ],
    goals: [],
  };

  const metrics = {
    totalTasksDueToday: 0,
    totalOverdueTasks: 3,
    unresolvedUrgentSignals: 1,
    completedTasksYesterday: 0,
  };

  const alerts = generateAttentionAlerts(snapshot, metrics, "fr");
  assert.ok(alerts.length >= 2);
  assert.ok(alerts.length <= 5);

  const overdueAlert = alerts.find((a) => a.id === "alert-overdue");
  assert.ok(overdueAlert);
  assert.equal(overdueAlert.level, "critical");
  assert.match(overdueAlert.message, /3 tâche\(s\) en retard/);

  const inactiveProjAlert = alerts.find((a) => a.id === "alert-inactive-projects");
  assert.ok(inactiveProjAlert);
  assert.equal(inactiveProjAlert.level, "info");
});

test("schedule summary extracts today events and sorts by earliest start time", () => {
  const snapshot = {
    tasks: [],
    projects: [],
    goals: [],
    events: [
      { id: "e-later", title: "Team Sync", start_at: `${TODAY}T16:00:00Z` },
      { id: "e-earlier", title: "Morning Standup", start_at: `${TODAY}T09:00:00Z` },
      { id: "e-tomorrow", title: "Demo", start_at: `${TOMORROW}T10:00:00Z` },
    ],
  };

  const summary = generateScheduleSummary(snapshot, TODAY);
  assert.ok(summary);
  assert.equal(summary.totalEvents, 2);
  assert.equal(summary.nextEventTitle, "Morning Standup");
  assert.equal(summary.nextEventTime, `${TODAY}T09:00:00Z`);
});

test("deterministic narrative varies accurately with state and language", () => {
  const frOverdue = buildDeterministicNarrative(
    { totalTasksDueToday: 2, totalOverdueTasks: 1, unresolvedUrgentSignals: 0, completedTasksYesterday: 0 },
    3,
    "fr"
  );
  assert.match(frOverdue.headline, /Attention requise/);
  assert.match(frOverdue.summary, /1 tâche\(s\) ont dépassé leur échéance/);

  const enNormal = buildDeterministicNarrative(
    { totalTasksDueToday: 4, totalOverdueTasks: 0, unresolvedUrgentSignals: 0, completedTasksYesterday: 1 },
    3,
    "en"
  );
  assert.match(enNormal.headline, /Focused on today's milestones/);
  assert.match(enNormal.summary, /4 task\(s\) scheduled for today/);
});

test("caching memoizes results by workspaceId + civilDate and bypassCache refreshes", async () => {
  clearBriefingCache();

  const snapshot = {
    tasks: [{ id: "t-1", title: "Task", status: "todo", due_at: `${TODAY}T10:00:00Z` }],
    projects: [],
    goals: [],
  };

  const firstCall = await generateDailyBriefing(snapshot, {
    workspaceId: "ws-cache-test",
    civilDate: TODAY,
  });

  const secondCall = await generateDailyBriefing(snapshot, {
    workspaceId: "ws-cache-test",
    civilDate: TODAY,
  });

  // Second call should return the exact same cached object
  assert.equal(firstCall, secondCall);

  // Bypass cache forces a fresh instance
  const thirdCall = await generateDailyBriefing(snapshot, {
    workspaceId: "ws-cache-test",
    civilDate: TODAY,
    bypassCache: true,
  });

  assert.notEqual(firstCall, thirdCall);
  assert.equal(thirdCall.metrics.totalTasksDueToday, 1);

  // Clearing cache invalidates it
  clearBriefingCache("ws-cache-test");
  const fourthCall = await generateDailyBriefing(snapshot, {
    workspaceId: "ws-cache-test",
    civilDate: TODAY,
  });
  assert.notEqual(thirdCall, fourthCall);
});

test("multi-tenant isolation: workspace contexts never cross-contaminate", async () => {
  const snapshotA = {
    tasks: [{ id: "t-a", title: "Task A", status: "todo", due_at: `${TODAY}T10:00:00Z` }],
    projects: [],
    goals: [],
  };

  const snapshotB = {
    tasks: [{ id: "t-b", title: "Task B", status: "todo", due_at: `${YESTERDAY}T10:00:00Z` }],
    projects: [],
    goals: [],
  };

  const briefA = await generateDailyBriefing(snapshotA, {
    workspaceId: "ws-A",
    civilDate: TODAY,
    bypassCache: true,
  });

  const briefB = await generateDailyBriefing(snapshotB, {
    workspaceId: "ws-B",
    civilDate: TODAY,
    bypassCache: true,
  });

  assert.equal(briefA.workspaceId, "ws-A");
  assert.equal(briefA.metrics.totalTasksDueToday, 1);
  assert.equal(briefA.metrics.totalOverdueTasks, 0);

  assert.equal(briefB.workspaceId, "ws-B");
  assert.equal(briefB.metrics.totalTasksDueToday, 0);
  assert.equal(briefB.metrics.totalOverdueTasks, 1);
});

test("handleBriefingRequest authentication & tenancy enforcement", async () => {
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
  const res401 = await handleBriefingRequest({
    db: dummyDb,
    userId: null,
    workspaceId: "ws-1",
  });
  assert.equal(res401.status, 401);
  assert.match(res401.body.error, /Authentication/);

  // 2. Missing workspaceId -> 400
  const res400 = await handleBriefingRequest({
    db: dummyDb,
    userId: "user-1",
    workspaceId: null,
  });
  assert.equal(res400.status, 400);
  assert.match(res400.body.error, /workspace/);

  // 3. Valid authenticated request with mock db -> 200
  const mockDb = {
    from: (table) => {
      let data = [];
      if (table === "tasks") {
        data = [{ id: "t-1", title: "Task 1", status: "todo", due_at: `${TODAY}T12:00:00Z` }];
      }
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve) => resolve({ data, error: null }),
      };
      return chain;
    },
  };

  const res200 = await handleBriefingRequest({
    db: mockDb,
    userId: "user-1",
    workspaceId: "ws-1",
    civilDate: TODAY,
  });
  assert.equal(res200.status, 200);
  assert.equal(res200.body.workspaceId, "ws-1");
  assert.equal(res200.body.metrics.totalTasksDueToday, 1);
});
