#!/usr/bin/env node
/**
 * NEXUS — PROJECT CREATION STRUCTURAL TESTS
 * =========================================
 * Regression coverage for the "impossible to create a project" incident:
 * while the guided tour was active, its fullscreen wrapper sat above every
 * product dialog and swallowed all pointer events, so clicking
 * "New project" / "Add project" had no visible effect. The creation form
 * itself also had silent dead-ends (submit disabled without explanation
 * when the workspace id was missing, slug collisions on duplicate names,
 * swallowed plan-limit check failures).
 *
 * There is no browser-test stack in this project by design; these
 * assertions check the source-level guarantees instead.
 *
 * Run:  node scripts/test-project-creation.mjs   (or  npm run test:creation)
 * Exit: 0 = all invariants hold, 1 = at least one check failed.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const src = (rel) => join(ROOT, "src", rel);
const read = (rel) => readFileSync(src(rel), "utf8");

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

console.log("\nNEXUS project creation — structural invariants\n");

// ------------------------------------------------------------------
console.log("Guided tour never swallows product clicks");
// ------------------------------------------------------------------
const tour = read("components/onboarding/guided-tour.tsx");
const spotlight = read("components/onboarding/spotlight.tsx");

check(
  "guided-tour: fullscreen wrapper is pointer-events-none (only panes + card intercept)",
  tour.includes("pointer-events-none fixed inset-0 z-[70]")
);

check(
  "guided-tour: card carries pointer-events-auto when no dialog is open",
  tour.includes('"pointer-events-auto absolute z-[71]')
);

check(
  "guided-tour: card steps out of the way while a modal dialog is open",
  tour.includes('modalActive && "invisible pointer-events-none"')
);

check(
  "guided-tour: Escape is owned by an open dialog, not the tour skip",
  tour.includes("if (modalActive) return;")
);

check(
  "spotlight: panes step out entirely while a modal dialog is active",
  spotlight.includes('modalActive ? "pointer-events-none opacity-0" : "pointer-events-auto"')
);

// ------------------------------------------------------------------
console.log("Project creation has no silent dead-end");
// ------------------------------------------------------------------
const manager = read("components/project-manager.tsx");

check(
  "project-manager: submit is never disabled on a missing workspace id",
  !manager.includes("disabled={saving || !workspaceId}")
);

check(
  "project-manager: submit re-resolves a missing workspace instead of failing silently",
  manager.includes("resolveWorkspace()")
);

check(
  "project-manager: missing workspace produces an explicit, actionable error",
  manager.includes("Your workspace is not connected yet")
);

check(
  "project-manager: creation slugs are unique (no duplicate-name dead-end)",
  manager.includes("uniqueSlug(name)")
);

check(
  "project-manager: slugs fold diacritics (French names stay readable)",
  manager.includes('normalize("NFD")')
);

check(
  "project-manager: plan-limit check failure surfaces a connection error",
  manager.includes("could not verify your plan limit")
);

check(
  "project-manager: creation refresh reads the resolved workspace id",
  manager.includes("await fetchProjects(activeWorkspaceId)")
);

console.log(`\n${passes} passed, ${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
