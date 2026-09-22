#!/usr/bin/env node
// ============================================================
// P1 INTELLIGENCE WORKSTREAM — CONTEXT GRAPH + RECOVERY
// ============================================================
// Verifies the mandatory acceptance scenario:
//   "J'ai quoi à faire ?" → cross-source recovery view
// and the unified context model (source attribution, freshness,
// graceful degradation, no fabricated data).
// Runs against pure modules — no database, no model, no network.
// ============================================================

import assert from "node:assert/strict";

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
  }
}

console.log("Intelligence workstream — context graph + recovery\n");

// ---- imports (TS modules from .mjs: dynamic import with .ts ext) ----
const { freshnessOf, describeSources, describePartialAvailability, sourceRef, PROVIDER_LABEL } =
  await import("../src/lib/intelligence/context-graph.ts");
const {
  buildRecoveryView,
  renderRecoveryNarrative,
  detectRecoveryRequest,
  isVacationFlavour,
} = await import("../src/lib/intelligence/recovery.ts");
const { executeReadTool, getTool } = await import("../src/lib/intelligence/tools.ts");
const { isActiveTask } = await import("../src/lib/intelligence/engine.ts");

const NOW = new Date("2026-09-22T10:00:00.000Z");
const iso = (offsetDays) => new Date(NOW.getTime() + offsetDays * 86_400_000).toISOString();

// ============================================================
// 1. Freshness model
// ============================================================
console.log("1. Freshness model");
check("2h-old timestamp → fresh", () => {
  assert.equal(freshnessOf(iso(-2 / 24), NOW), "fresh");
});
check("2-day-old timestamp → recent", () => {
  assert.equal(freshnessOf(iso(-2), NOW), "recent");
});
check("10-day-old timestamp → stale", () => {
  assert.equal(freshnessOf(iso(-10), NOW), "stale");
});
check("future timestamp (upcoming event) → fresh, not negative-age", () => {
  assert.equal(freshnessOf(iso(1), NOW), "fresh");
});
check("null/invalid timestamp → unknown", () => {
  assert.equal(freshnessOf(null, NOW), "unknown");
  assert.equal(freshnessOf("not-a-date", NOW), "unknown");
});

// ============================================================
// 2. Source attribution (context graph)
// ============================================================
console.log("\n2. Source attribution");
check("describeSources renders provider · count · kind", () => {
  const lines = describeSources([
    sourceRef({ provider: "nexus", kind: "task", count: 17, now: NOW }),
    sourceRef({ provider: "nexus", kind: "note", count: 1, now: NOW }),
  ]);
  assert.deepEqual(lines, ["NEXUS · 17 tasks", "NEXUS · 1 note"]);
});
check("stale source is labelled, never hidden", () => {
  const lines = describeSources([
    sourceRef({ provider: "nexus", kind: "note", count: 3, latestAt: iso(-10), now: NOW }),
  ]);
  assert.match(lines[0], /stale data/);
});
check("unavailable source says so with detail (graceful degradation)", () => {
  const lines = describeSources([
    sourceRef({ provider: "gmail", kind: "message", count: 0, status: "unavailable", detail: "not connected" }),
  ]);
  assert.match(lines[0], /Gmail · 0 messages — unavailable \(not connected\)/);
});
check("partial availability sentence: what worked, what did not, what is excluded", () => {
  const sentence = describePartialAvailability([
    sourceRef({ provider: "nexus", kind: "task", count: 5 }),
    sourceRef({ provider: "gmail", kind: "message", count: 0, status: "unavailable" }),
  ]);
  assert.match(sentence, /J'ai analysé NEXUS\./);
  assert.match(sentence, /Gmail n'a pas répondu, donc cette source n'est pas incluse/);
});
check("all sources ok → no partial-availability sentence", () => {
  const sentence = describePartialAvailability([
    sourceRef({ provider: "nexus", kind: "task", count: 5 }),
  ]);
  assert.equal(sentence, null);
});
check("every Phase-1 provider has a label", () => {
  for (const provider of ["nexus", "gmail", "google-calendar", "slack", "notion", "github", "linear"]) {
    assert.ok(PROVIDER_LABEL[provider], `missing label for ${provider}`);
  }
});

// ============================================================
// 3. Vacation scenario — "J'ai quoi à faire ?"
// ============================================================
console.log("\n3. Vacation scenario — what do I have to do?");

const snapshot = {
  tasks: [
    { id: "t1", title: "Répondre au client Alpha", status: "todo", priority: "urgent", due_at: iso(-3), created_at: iso(-40), updated_at: iso(-3) },
    { id: "t2", title: "Préparer la présentation vendredi", status: "todo", priority: "high", due_at: iso(2), created_at: iso(-30), updated_at: iso(-1) },
    { id: "t3", title: "Déployer la release", status: "blocked", priority: "medium", due_at: null, created_at: iso(-20), updated_at: iso(-5) },
    { id: "t4", title: "Tâche ancienne", status: "done", priority: "low", due_at: iso(-9), created_at: iso(-50), updated_at: iso(-8) },
    { id: "t5", title: "Priorité sans date", status: "todo", priority: "high", due_at: null, created_at: iso(-10), updated_at: iso(-2) },
  ],
  projects: [
    { id: "p1", name: "Refonte site", status: "active", created_at: iso(-60), updated_at: iso(-6) },
  ],
  goals: [],
  notes: [
    { id: "n1", title: "Décision: passer à Postgres", note_type: "decision", project_id: "p1", updated_at: iso(-1) },
    { id: "n2", title: "Reunion équipe 12 sept", note_type: "meeting", project_id: null, updated_at: iso(-9) },
  ],
  events: [
    { id: "e1", title: "Point équipe", start_at: iso(2 / 24), end_at: iso(3 / 24), location: null, project_id: null },
    { id: "e2", title: "Démo client", start_at: iso(2), end_at: iso(2.25), location: null, project_id: null },
    { id: "e3", title: "Réunion passée", start_at: iso(-4), end_at: iso(-3.75), location: null, project_id: null },
  ],
  now: NOW,
};

check("trigger phrases in FR and EN are detected", () => {
  assert.ok(detectRecoveryRequest("J'ai quoi à faire ?"));
  assert.ok(detectRecoveryRequest("Qu'est-ce que j'ai à faire ?"));
  assert.ok(detectRecoveryRequest("Rattrape mon retard"));
  assert.ok(detectRecoveryRequest("What do I have to do?"));
  assert.ok(!detectRecoveryRequest("Crée une tâche préparer la démo"));
});
check("vacation flavour detected separately", () => {
  assert.ok(isVacationFlavour("Je reviens de vacances, quoi à faire ?"));
  assert.ok(!isVacationFlavour("J'ai quoi à faire ?"));
});

const view = buildRecoveryView({ snapshot, notes: snapshot.notes, events: snapshot.events, now: NOW });

check("recovery view builds without any model or network", () => {
  assert.ok(Array.isArray(view.items));
  assert.ok(view.items.length > 0);
});
check("done tasks never appear (no noise)", () => {
  assert.ok(!view.items.some((item) => item.id === "t4"));
});
check("past events are excluded — only actionable future context", () => {
  assert.ok(!view.items.some((item) => item.id === "e3"));
});
check("overdue urgent task ranks first with stated reasons", () => {
  const first = view.items[0];
  assert.equal(first.id, "t1");
  assert.ok(first.reasons.some((r) => r.kind === "overdue"));
  assert.ok(first.reasons.some((r) => r.label.includes("En retard")));
});
check("today's meeting is detected and attributed to NEXUS Calendar", () => {
  const meeting = view.items.find((item) => item.id === "e1");
  assert.ok(meeting, "today's meeting missing from recovery view");
  assert.equal(meeting.sourceLabel, "NEXUS Calendar");
  assert.ok(meeting.reasons.some((r) => r.label === "Aujourd'hui"));
});
check("blocked task is present with a 'unblock upstream' reason", () => {
  const blocked = view.items.find((item) => item.id === "t3");
  assert.ok(blocked);
  assert.ok(blocked.reasons.some((r) => r.kind === "blocked"));
});
check("dateless high-priority task surfaces with 'plan it' reason", () => {
  const nodate = view.items.find((item) => item.id === "t5");
  assert.ok(nodate);
  assert.ok(nodate.reasons.some((r) => r.label.includes("sans date")));
});
check("items are ranked (score descending)", () => {
  const scores = view.items.map((item) => item.score);
  const sorted = [...scores].sort((a, b) => b - a);
  assert.deepEqual(scores, sorted);
});
check("counts match the view (overdue, blocked, meetings)", () => {
  assert.equal(view.counts.overdue, 1);
  assert.equal(view.counts.blocked, 1);
  assert.equal(view.counts.meetingsSoon, 2);
});
check("every item carries a source label and a suggested action", () => {
  for (const item of view.items) {
    assert.ok(item.sourceLabel.length > 0, `item ${item.id} missing source label`);
    assert.ok(item.suggestedAction.length > 0, `item ${item.id} missing suggested action`);
    assert.ok(item.reasons.length > 0, `item ${item.id} on the list with zero reasons`);
  }
});
check("sources list reflects what was actually loaded", () => {
  const providers = view.sources.map((source) => source.provider);
  assert.ok(providers.includes("nexus"));
  assert.ok(!providers.includes("gmail"), "gmail claimed without any data");
});
check("proposal is a plan, not an execution — confirmation required", () => {
  assert.ok(view.proposal.some((line) => /confirmation requise/i.test(line)));
  assert.ok(view.proposal.length >= 2);
});
check("narrative exposes per-item source attribution", () => {
  const text = renderRecoveryNarrative(view);
  assert.match(text, /NEXUS Calendar/);
  assert.match(text, /Pourquoi :/);
  assert.match(text, /Je te propose/);
});
check("empty workspace → honest empty view, no fabricated problems", () => {
  const empty = buildRecoveryView({
    snapshot: { tasks: [], projects: [], goals: [], notes: [], events: [], now: NOW },
    now: NOW,
  });
  assert.equal(empty.items.length, 0);
  assert.match(empty.headline, /Rien ne demande ton attention/);
});
check("deterministic: same snapshot + clock → same ranking", () => {
  const again = buildRecoveryView({ snapshot, notes: snapshot.notes, events: snapshot.events, now: NOW });
  assert.deepEqual(
    again.items.map((item) => item.key),
    view.items.map((item) => item.key)
  );
});
check("external calendar events join with their own source label", () => {
  const withExternal = buildRecoveryView({
    snapshot,
    events: snapshot.events,
    externalEvents: [{ title: "Investor call", startAt: iso(1), url: "https://calendar.google.com/x" }],
    now: NOW,
  });
  const external = withExternal.items.find((item) => item.title === "Investor call");
  assert.ok(external);
  assert.equal(external.source, "google-calendar");
  assert.equal(external.sourceLabel, "Calendar");
  assert.equal(external.href, "https://calendar.google.com/x");
  assert.ok(withExternal.sources.some((source) => source.provider === "google-calendar"));
});
check("duplicate entity ids are deduped (one item per entity)", () => {
  const keys = view.items.map((item) => item.key);
  assert.equal(new Set(keys).size, keys.length);
});

// ============================================================
// 4. New read tools (notes, events, free time)
// ============================================================
console.log("\n4. New read tools");
const ctx = {
  workspaceId: "ws-test",
  snapshot,
  context: {
    totals: { openTasks: 4, overdueTasks: 1, blockedTasks: 1, doneTasks: 1 },
    healthScore: 50,
    healthBand: "needs attention",
  },
  activities: [],
  dependencies: [],
  now: NOW,
};

check("get_notes lists newest notes with project link", () => {
  const result = executeReadTool("get_notes", {}, ctx);
  assert.equal(result.status, "ok");
  assert.equal(result.count, 2);
  assert.equal(result.data[0].title, "Décision: passer à Postgres");
  assert.equal(result.data[0].project, "Refonte site");
});
check("get_notes filters by query", () => {
  const result = executeReadTool("get_notes", { query: "décision" }, ctx);
  assert.equal(result.count, 1);
});
check("get_notes empty → honest empty summary", () => {
  const result = executeReadTool("get_notes", {}, { ...ctx, snapshot: { ...snapshot, notes: [] } });
  assert.equal(result.count, 0);
  assert.match(result.summary, /Aucune note/);
});
check("get_events returns only upcoming, soonest first", () => {
  const result = executeReadTool("get_events", {}, ctx);
  assert.equal(result.count, 2);
  assert.equal(result.data[0].title, "Point équipe");
});
check("find_free_time respects events as busy blocks", () => {
  const result = executeReadTool("find_free_time", { days: 1, min_minutes: 30 }, ctx);
  assert.equal(result.status, "ok");
  // busy 12:00–13:00, working day 08:00–18:00 → morning 240min + afternoon 300min
  assert.equal(result.count, 2, `expected 2 windows, got ${result.count}`);
  assert.deepEqual(result.data.map((window) => window.minutes), [240, 300]);
});
check("find_free_time with no events → full working day", () => {
  const result = executeReadTool(
    "find_free_time",
    { days: 1, min_minutes: 60 },
    { ...ctx, snapshot: { ...snapshot, events: [] } }
  );
  assert.equal(result.count, 1);
  assert.equal(result.data[0].minutes, 600);
});
check("tools are registered with read permission and zero risk", () => {
  for (const name of ["get_notes", "get_events", "find_free_time"]) {
    const tool = getTool(name);
    assert.ok(tool, `${name} not registered`);
    assert.equal(tool.permission, "read");
    assert.equal(tool.risk, "none");
  }
});
check("legacy snapshot without notes/events still compiles at runtime", () => {
  const legacy = { ...ctx, snapshot: { tasks: snapshot.tasks, projects: snapshot.projects, goals: [] } };
  assert.equal(executeReadTool("get_notes", {}, legacy).count, 0);
  assert.equal(executeReadTool("get_events", {}, legacy).count, 0);
});

// ============================================================
// 5. isActiveTask sanity (used by recovery)
// ============================================================
console.log("\n5. Task filters");
check("done and cancelled are inactive; todo/blocked/in_progress active", () => {
  assert.ok(!isActiveTask({ id: "x", title: "t", status: "done" }));
  assert.ok(!isActiveTask({ id: "x", title: "t", status: "cancelled" }));
  assert.ok(isActiveTask({ id: "x", title: "t", status: "todo" }));
  assert.ok(isActiveTask({ id: "x", title: "t", status: "blocked" }));
});

// ============================================================
console.log(
  `\n${passed} passed, ${failed} failed / ${passed + failed} checks`
);
if (failed > 0) {
  process.exit(1);
}
