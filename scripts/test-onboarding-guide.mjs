#!/usr/bin/env node
/**
 * NEXUS — ONBOARDING GUIDE STRUCTURAL TESTS
 * ========================================
 * Regression coverage for the guide-hardening pass: the tour must do its
 * job (welcome → first project → first task → intelligence) without ever
 * blocking the product underneath, hanging in an unhydrated limbo, or
 * disagreeing with itself about open dialogs.
 *
 * There is no browser-test stack in this project by design; these
 * assertions check the source-level guarantees instead.
 *
 * Run:  node scripts/test-onboarding-guide.mjs   (or  npm run test:guide)
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

console.log("\nNEXUS onboarding guide — structural invariants\n");

// ------------------------------------------------------------------
console.log("One dialog observation, shared and pre-paint");
// ------------------------------------------------------------------
const spotlight = read("components/onboarding/spotlight.tsx");
const tour = read("components/onboarding/guided-tour.tsx");

check(
  "spotlight: shared useModalActive() hook exists",
  spotlight.includes("export function useModalActive()")
);

check(
  "spotlight: detection runs pre-paint (no flash over deep-linked dialogs)",
  /export function useModalActive[\s\S]*?useLayoutEffect/.test(spotlight)
);

check(
  "guided-tour: card uses the shared hook, no own observer",
  tour.includes("useModalActive()") &&
    !tour.includes("new MutationObserver")
);

check(
  "guided-tour: shared state passed down to the spotlight",
  tour.includes("modalActive={modalActive}")
);

check(
  "spotlight: panes fully transparent while a dialog owns the screen",
  spotlight.includes('"pointer-events-none opacity-0"')
);

check(
  "spotlight: dead measureGuide export removed",
  !spotlight.includes("measureGuide")
);

// ------------------------------------------------------------------
console.log("Guidance layer can never hang unhydrated or throw");
// ------------------------------------------------------------------
const provider = read("components/onboarding/onboarding-provider.tsx");

check(
  "provider: boot always settles hydration, even on remote failure",
  provider.includes("finally") && provider.includes("setHydrated(true)")
);

check(
  "provider: remote sync never throws into click/activation handlers",
  /try \{\s*void writeRemoteOnboarding/.test(provider)
);

// ------------------------------------------------------------------
console.log("Every guidance entry point opens its form");
// ------------------------------------------------------------------
const goals = read("components/goal-manager.tsx");

check(
  "goal-manager: ?create=1 opens the form on in-place navigation",
  goals.includes("prevCreateParam")
);

const sidebar = read("components/layout/workspace-sidebar.tsx");

check(
  "sidebar: global Create trigger is not mislabeled as project creation",
  sidebar.includes('data-guide="global-create"') &&
    !sidebar.includes('data-guide="create-project"')
);

// ------------------------------------------------------------------
console.log("Help center behaves like a modal");
// ------------------------------------------------------------------
const help = read("components/onboarding/help-center.tsx");

check(
  "help-center: background scroll locked while open",
  help.includes('document.body.style.overflow = "hidden"')
);

check(
  "help-center: focus moves inside on open, back to opener on close",
  help.includes("previouslyFocused")
);

console.log(`\n${passes} passed, ${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
