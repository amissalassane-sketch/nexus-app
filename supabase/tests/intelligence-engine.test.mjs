// ============================================================
// NEXUS INTELLIGENCE — ENGINE TESTS (P3)
// Run with:
//   node --experimental-strip-types supabase/tests/intelligence-engine.test.mjs
// The engine is pure TypeScript with zero imports, so Node's
// type stripping can execute it directly.
// ============================================================

import assert from "node:assert/strict";
import { computeInsights, computeNextAction, deterministicBrief } from "../../src/lib/intelligence/engine.ts";

const NOW = new Date("2026-08-19T12:00:00.000Z");

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
};

const daysFromNow = (days) => new Date(NOW.getTime() + days * 86400000).toISOString();
const task = (overrides = {}) => ({
  id: crypto.randomUUID(),
  title: "Sample task",
  status: "todo",
  priority: "medium",
  due_at: null,
  project_id: null,
  completed_at: null,
  ...overrides,
});
const project = (overrides = {}) => ({
  id: crypto.randomUUID(),
  name: "Sample project",
  status: "active",
  progress: 0,
  due_date: null,
  ...overrides,
});
const goal = (overrides = {}) => ({
  id: crypto.randomUUID(),
  title: "Sample goal",
  status: "active",
  progress: 0,
  target_date: null,
  ...overrides,
});

test("overdue: detects the oldest with its reason", () => {
  const older = task({ title: "Older overdue", due_at: daysFromNow(-9) });
  const newer = task({ title: "Recent overdue", due_at: daysFromNow(-2) });
  const result = computeInsights({ now: NOW, tasks: [newer, older], projects: [], goals: [] });
  const overdue = result.insights.find((i) => i.signal === "overdue");
  assert.ok(overdue, "overdue signal missing");
  assert.equal(overdue.severity, "critical");
  assert.ok(overdue.title.includes("2 tasks overdue"));
  assert.ok(overdue.reason.includes("Older overdue"));
  assert.ok(overdue.reason.includes("9 days ago"));
});

test("done tasks never count as overdue", () => {
  const result = computeInsights({
    now: NOW,
    tasks: [task({ due_at: daysFromNow(-5), status: "done", completed_at: daysFromNow(-1) })],
    projects: [],
    goals: [],
  });
  assert.equal(result.insights.find((i) => i.signal === "overdue"), undefined);
});

test("blocked: project with a blocked task is flagged as not moving", () => {
  const proj = project({ name: "Website v2" });
  const blocked = task({ title: "Waiting on client", status: "blocked", project_id: proj.id });
  const result = computeInsights({ now: NOW, tasks: [blocked], projects: [proj], goals: [] });
  const blockedInsight = result.insights.find((i) => i.signal === "blocked");
  assert.ok(blockedInsight, "blocked signal missing");
  assert.ok(blockedInsight.title.includes("Website v2"));
  assert.ok(blockedInsight.title.includes("no longer moves"));
});

test("due_today: counts only today's active tasks", () => {
  const today = task({ title: "Today thing", due_at: daysFromNow(0) });
  const result = computeInsights({ now: NOW, tasks: [today], projects: [], goals: [] });
  const dueToday = result.insights.find((i) => i.signal === "due_today");
  assert.ok(dueToday, "due_today signal missing");
  assert.ok(dueToday.title.includes("1 task"));
  assert.ok(dueToday.title.includes("Today thing"));
});

test("empty_project: a project without any task asks for a first task", () => {
  const proj = project({ name: "Empty thing" });
  const result = computeInsights({ now: NOW, tasks: [], projects: [proj], goals: [] });
  const empty = result.insights.find((i) => i.signal === "empty_project");
  assert.ok(empty, "empty_project signal missing");
  assert.ok(empty.title.includes("Empty thing"));
  assert.ok(empty.reason.includes("first task"));
});

test("stale_project: active project whose tasks are all done is parked", () => {
  const proj = project({ name: "Parked", progress: 80 });
  const done = task({ title: "All done", status: "done", project_id: proj.id, completed_at: daysFromNow(-1) });
  const result = computeInsights({ now: NOW, tasks: [done], projects: [proj], goals: [] });
  const stale = result.insights.find((i) => i.signal === "stale_project");
  assert.ok(stale, "stale_project signal missing");
  assert.ok(stale.reason.includes("80%"));
});

test("goal_at_risk: close deadline + low progress is at risk", () => {
  const risky = goal({ title: "Ship course", progress: 20, target_date: daysFromNow(10) });
  const safe = goal({ title: "Long term", progress: 80, target_date: daysFromNow(10) });
  const result = computeInsights({ now: NOW, tasks: [], projects: [], goals: [risky, safe] });
  const atRisk = result.insights.filter((i) => i.signal === "goal_at_risk");
  assert.equal(atRisk.length, 1);
  assert.ok(atRisk[0].title.includes("Ship course"));
});

test("momentum: counts completions of the last 7 days only", () => {
  const recent = task({ status: "done", completed_at: daysFromNow(-2) });
  const old = task({ status: "done", completed_at: daysFromNow(-20) });
  const result = computeInsights({ now: NOW, tasks: [recent, old], projects: [project()], goals: [] });
  assert.equal(result.momentum.completed7d, 1);
});

test("next_best_action cascade: no project → create project", () => {
  const next = computeNextAction({ now: NOW, tasks: [task()], projects: [], goals: [] });
  assert.ok(next.insight.title.includes("first project"));
});

test("next_best_action cascade: no task → add a task (with goal context)", () => {
  const next = computeNextAction({
    now: NOW,
    tasks: [],
    projects: [project()],
    goals: [goal({ title: "Learn piano", progress: 10 })],
  });
  assert.ok(next.insight.title.includes("next task"));
  assert.ok(next.insight.reason.includes("Learn piano"));
});

test("next_best_action cascade: overdue beats blocked and priority", () => {
  const overdue = task({ title: "The late one", due_at: daysFromNow(-3) });
  const blocked = task({ title: "Blocked one", status: "blocked" });
  const urgent = task({ title: "Urgent one", priority: "urgent" });
  const next = computeNextAction({ now: NOW, tasks: [urgent, blocked, overdue], projects: [project()], goals: [] });
  assert.ok(next.insight.title.includes("The late one"));
  assert.ok(next.insight.reason.includes("3 days late"));
});

test("next_best_action cascade: blocked beats priority when nothing is late", () => {
  const blocked = task({ title: "Blocked one", status: "blocked" });
  const urgent = task({ title: "Urgent one", priority: "urgent" });
  const next = computeNextAction({ now: NOW, tasks: [urgent, blocked], projects: [project()], goals: [] });
  assert.ok(next.insight.title.includes("Blocked one"));
});

test("next_best_action cascade: priority beats plain next", () => {
  const urgent = task({ title: "Urgent one", priority: "urgent" });
  const plain = task({ title: "Plain one", due_at: daysFromNow(1) });
  const next = computeNextAction({ now: NOW, tasks: [plain, urgent], projects: [project()], goals: [] });
  assert.ok(next.insight.title.includes("Urgent one"));
});

test("every insight carries a non-empty reason, entity and href", () => {
  const proj = project();
  const result = computeInsights({
    now: NOW,
    tasks: [
      task({ due_at: daysFromNow(-1) }),
      task({ status: "blocked", project_id: proj.id }),
      task({ due_at: daysFromNow(0) }),
    ],
    projects: [proj],
    goals: [goal({ progress: 10, target_date: daysFromNow(5) })],
  });
  for (const insight of result.insights) {
    assert.ok(insight.reason.length > 10, `${insight.id}: reason too short`);
    assert.ok(insight.entity.type, `${insight.id}: entity missing`);
    assert.ok(insight.href.startsWith("/"), `${insight.id}: bad href`);
    assert.ok(insight.cta.length > 0, `${insight.id}: cta missing`);
  }
});

test("brief: deterministic text handles the empty workspace honestly", () => {
  const input = { now: NOW, tasks: [], projects: [], goals: [] };
  const result = computeInsights(input);
  const brief = deterministicBrief(result, input);
  assert.ok(brief.includes("Nothing requires arbitration"));
  const withWork = {
    now: NOW,
    tasks: [task({ due_at: daysFromNow(-2) })],
    projects: [project()],
    goals: [],
  };
  const brief2 = deterministicBrief(computeInsights(withWork), withWork);
  assert.ok(brief2.length > 20);
});

console.log(`\nintelligence-engine: ${passed} assertions passed`);
