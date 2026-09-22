#!/usr/bin/env node
/**
 * NEXUS — P0 DOMAINS STRUCTURAL TESTS
 * ===================================
 * Locks the product guarantees of the new first-class domains:
 * Notes, Calendar, Files, Capture and Unified Search.
 *
 * Run:  node scripts/test-p0-domains.mjs   (wired as npm run test:domains)
 * Exit: 0 = all invariants hold, 1 = at least one check failed.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let failures = 0;
let passes = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passes += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✘ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\nP0 DOMAINS — structural invariants\n");

// ------------------------------------------------------------------
console.log("Notes — a real domain, not a mock");
// ------------------------------------------------------------------
check("notes: page exists", existsSync(join(ROOT, "src/app/(app)/notes/page.tsx")));
const notes = read("src/components/notes/notes-manager.tsx");
check("notes: reads are workspace-scoped", notes.includes('.eq("workspace_id"'));
check("notes: archive is a state, not a delete", notes.includes("archived_at"));
check("notes: linked to projects for Intelligence context", notes.includes("project_id"));
check(
  "notes: every mutation is described honestly (plan/data errors reported, never swallowed)",
  notes.includes("reportDataError")
);
check("notes: destructive action requires confirmation", notes.includes("<ConfirmDialog"));

// ------------------------------------------------------------------
console.log("\nCalendar — time as a first-class layer");
// ------------------------------------------------------------------
check("calendar: page exists", existsSync(join(ROOT, "src/app/(app)/calendar/page.tsx")));
const calendar = read("src/components/calendar/calendar-manager.tsx");
check("calendar: today / week / agenda views exist", ["today", "week", "agenda"].every((view) => calendar.includes(`"${view}"`)));
check("calendar: reads are workspace-scoped", calendar.includes('.eq("workspace_id"'));
check("calendar: conflicts are detected, not implied", calendar.includes("overlapMinutes"));
check("calendar: free windows are computed from real events", calendar.includes("freeWindowsToday"));
check("calendar: window read is bounded (60-day window)", calendar.includes("addDays(now, 53)") && calendar.includes("addDays(now, -7)"));
check("calendar: end-before-start is rejected client-side too", calendar.includes("before the start time"));

// The adapter's pure functions are the shared conflict math.
const adapter = read("src/lib/integrations/adapters/google-calendar.ts");
check(
  "calendar: conflict + free-window math is shared with the integration adapter",
  adapter.includes("export function detectConflicts") && adapter.includes("export function findFreeWindows")
);

// ------------------------------------------------------------------
console.log("\nFiles — private by default, limited by plan");
// ------------------------------------------------------------------
check("files: page exists", existsSync(join(ROOT, "src/app/(app)/files/page.tsx")));
const files = read("src/components/files/files-manager.tsx");
check("files: uploads go to the private nexus-files bucket", files.includes('"nexus-files"'));
check(
  "files: storage path starts with the workspace id (storage RLS reads it)",
  /`\$\{workspaceId\}\//.test(files)
);
check("files: metadata row is required (a file without metadata is invisible)", files.includes('from("files").insert'));
check(
  "files: a refused metadata row removes the orphan object — storage never holds invisible data",
  files.includes("PLAN_LIMIT_EXCEEDED") && files.includes(".remove([path])")
);
check("files: per-file size limit is stated (10 MB)", files.includes("10 * 1024 * 1024"));
check("files: plan limit copy offers the upgrade path", files.includes("See plans"));

// ------------------------------------------------------------------
console.log("\nCapture — one sentence in, one structured task out");
// ------------------------------------------------------------------
check("capture: page route exists", existsSync(join(ROOT, "src/app/api/capture/route.ts")));
const captureApi = read("src/app/api/capture/route.ts");
check("capture: re-validates session + workspace server-side", captureApi.includes("getAuthenticatedUser") && captureApi.includes("getActiveMembership"));
check("capture: reports what it understood (confirmation contract)", captureApi.includes("understood"));
check("capture: plan limit is surfaced, not swallowed", captureApi.includes("PLAN_LIMIT_EXCEEDED"));
check("capture: input length is bounded", captureApi.includes("500"));
const captureLib = read("src/lib/capture.ts");
check("capture: parsing is deterministic (no network, no model)", !captureLib.includes("fetch("));
check("capture: French and English vocabularies both present", captureLib.includes("demain") && captureLib.includes("tomorrow"));

// ------------------------------------------------------------------
console.log("\nUnified search — one layer, every source named");
// ------------------------------------------------------------------
check("search: route exists", existsSync(join(ROOT, "src/app/api/search/route.ts")));
const search = read("src/app/api/search/route.ts");
check(
  "search: covers tasks, projects, goals, notes, files, events, activity",
  ["tasks", "projects", "goals", "notes", "files", "events", "activity"].every((source) =>
    search.includes(`"${source}"`)
  )
);
check("search: every source query is workspace-scoped", (search.match(/\.eq\("workspace_id", workspaceId\)/g) ?? []).length >= 7);
check("search: sources run in parallel", search.includes("Promise.allSettled"));
check("search: a failing source is reported, never silently dropped", search.includes("unavailable"));
check("search: per-source timeout bounds the request", search.includes("SOURCE_TIMEOUT_MS"));
check("search: results carry their source label", search.includes("source: SearchSource"));
check("search: query requires at least 2 characters (no wildcard dumps)", search.includes("length < 2"));

// ------------------------------------------------------------------
console.log("\nNavigation — the domains are reachable");
// ------------------------------------------------------------------
const nav = read("src/components/layout/nav-config.ts");
for (const [href, label] of [["/notes", "Notes"], ["/calendar", "Calendar"], ["/files", "Files"]]) {
  check(`nav: ${label} is a destination`, nav.includes(`href: "${href}"`));
}
check(
  "nav: page titles cover the new domains",
  ["/notes", "/calendar", "/files"].every((href) => nav.includes(`"${href}"`))
);
const palette = read("src/components/command-menu.tsx");
check("palette: notes are searchable entities", palette.includes('from("notes")'));
check(
  "palette: capture is offered for any typed sentence",
  palette.includes("Capture: ${trimmed}")
);
check("palette: capture failure is reported in-place, not swallowed", palette.includes("Capture failed"));

// ------------------------------------------------------------------
console.log("\nMigration — the platform tables exist in the schema");
// ------------------------------------------------------------------
const migration = read("supabase/migrations/20260922130000_nexus_context_platform.sql");
check("migration: integration connections table", migration.includes("create table if not exists public.integration_connections"));
check("migration: credentials are stored separately from connections", migration.includes("create table if not exists public.integration_credentials"));
check("migration: request log table", migration.includes("create table if not exists public.intelligence_request_log"));
check("migration: files plan limit trigger", migration.includes("enforce_file_limit"));
check(
  "migration: files limits mirror plan-limits.ts (20/200/1000)",
  migration.includes("then return 20;") && migration.includes("then return 200;") && migration.includes("then return 1000;")
);
const planLimits = read("src/lib/plan-limits.ts");
check(
  "plan limits: files limits mirrored in code",
  planLimits.includes("files: 20") && planLimits.includes("files: 200") && planLimits.includes("files: 1000")
);
check(
  "RLS: every new integration table has row level security",
  ["integration_connections", "integration_credentials", "integration_sync_runs", "intelligence_request_log"].every(
    (table) => migration.includes(`alter table public.${table} enable row level security`)
  )
);

console.log(`\n${passes} passed, ${failures} failed\n`);
if (failures > 0) process.exit(1);
