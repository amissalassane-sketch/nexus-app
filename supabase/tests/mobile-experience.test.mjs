// ============================================================
// NEXUS INTELLIGENCE — PHASE 6: MOBILE EXPERIENCE
// ============================================================
// Static verification of the Phase 6 invariants (same style as the
// other suites in this repo: no browser stack, the source-level
// guarantees a device pass relies on).
//
// Covered:
//   - mobile home hierarchy (attention → mission → next → recent → ask)
//   - the home is server-driven (no client fetch, no invented data)
//   - mission mutations are confirmation-gated (no implicit
//     confirmed:true from a single tap)
//   - mission cancellation is confirmed too
//   - internal signal codes never render raw (SIGNAL_TYPE_LABEL used)
//   - no window.location navigation on intelligence surfaces (SPA)
//   - ask deep links (?ask=1, ?q=) prefill/focus but never auto-send
//   - touch targets ≥44px on the new surfaces
//   - offline messages keep the data on screen (no blanking)
//   - the dead Phase-6 leftovers stay deleted
//
// Run:  node --import tsx supabase/tests/mobile-experience.test.mjs
//       (or npm run test:mobile-experience)
// ============================================================

import { readFileSync, existsSync } from "node:fs";

let passed = 0;
let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

const read = (rel) => readFileSync(rel, "utf8");

const mobileOverview = read("src/components/mobile-home/mobile-overview.tsx");
const missionPanel = read("src/components/intelligence/mission-panel.tsx");
const proactivePanel = read("src/components/intelligence/proactive-signals-panel.tsx");
const ask = read("src/components/intelligence/intelligence-ask.tsx");
const dashboard = read("src/app/(app)/dashboard/page.tsx");
const intelligencePage = read("src/app/(app)/app/intelligence/page.tsx");

console.log("-- mobile home surface ----------------------------------");

ok(
  "dashboard renders the mobile surface",
  dashboard.includes("<MobileOverview") && dashboard.includes('import { MobileOverview }')
);
ok(
  "mobile surface is phone-only (lg:hidden wrapper)",
  mobileOverview.includes("lg:hidden")
);
ok(
  "desktop overview preserved (hidden lg:block)",
  dashboard.includes('hidden space-y-6 lg:block') || dashboard.includes("hidden lg:block")
);
ok(
  "attention section before mission section",
  mobileOverview.indexOf('aria-label="Needs your attention"') <
    mobileOverview.indexOf('aria-label="Active mission"')
);
// The next-action block is the shared FocusPanel (its own file), so the
// order check uses its render site inside the mobile surface.
ok(
  "mission before next action (FocusPanel render site)",
  mobileOverview.indexOf('aria-label="Active mission"') <
    mobileOverview.indexOf("<FocusPanel insight={focus} />")
);
ok(
  "next action before recent context",
  mobileOverview.indexOf("<FocusPanel insight={focus} />") <
    mobileOverview.indexOf('aria-label="Recent activity"')
);
ok(
  "recent context before ask",
  mobileOverview.indexOf('aria-label="Recent activity"') <
    mobileOverview.indexOf('aria-label="Ask NEXUS"')
);
ok(
  "home reads the mission on the server (no client fetch)",
  dashboard.includes("readActiveMissions") &&
    !mobileOverview.includes('fetch("/api/intelligence/missions"')
);
ok(
  "mission read is bounded and best-effort",
  dashboard.includes("MISSION_READ_TIMEOUT") && dashboard.includes("catch(")
);
ok(
  "mission card shows progress + current step",
  mobileOverview.includes("role=\"progressbar\"") &&
    mobileOverview.includes("Current step")
);
ok(
  "mission deep link points at the mission anchor",
  mobileOverview.includes("/app/intelligence#mission")
);
ok(
  "no invented data: absent mission renders an honest empty card",
  mobileOverview.includes("No mission in progress")
);
ok(
  "no invented data: empty attention renders guidance, not fake signals",
  mobileOverview.includes("Nothing is at risk right now.")
);
ok(
  "no window-globals for data (the hallucinated pattern is gone)",
  !/window as any/.test(mobileOverview) && !/(window as any)/.test(read("src/app/(app)/dashboard/page.tsx"))
);

console.log("-- mission panel: confirmation gate ----------------------");

ok(
  "mutations render an inline confirmation panel",
  missionPanel.includes('role="alertdialog"') &&
    missionPanel.includes("Confirmer et exécuter")
);
ok(
  "the request with confirmed:true is only sent from the confirmation",
  // runAction is only invoked from the confirmation buttons
  missionPanel.includes("onClick={() => void runAction(pendingAction)}")
);
ok(
  "confirmation can be cancelled",
  missionPanel.includes("onClick={() => setPendingAction(null)}")
);
ok(
  "mission cancellation is confirmed (no one-tap cancel)",
  missionPanel.includes("confirmingCancel") && missionPanel.includes("Annuler la mission")
);
ok(
  "current step shows why it blocks",
  missionPanel.includes("Pourquoi ça bloque")
);
ok(
  '"Voir pourquoi" disclosure exists',
  missionPanel.includes("Voir pourquoi") && missionPanel.includes("MissionWhy")
);
ok(
  "steps show order, status, dependencies, block reason",
  missionPanel.includes("Dépendance :") && missionPanel.includes("order + 1") &&
    missionPanel.includes("STATUS_LABEL")
);
ok(
  "per-step action is offered on actionable steps",
  missionPanel.includes("actionable") && missionPanel.includes("onMutate")
);
ok(
  "loading state is a skeleton, not a blank",
  missionPanel.includes("animate-pulse") && missionPanel.includes("Chargement de la mission")
);
ok(
  "offline keeps the mission on screen",
  missionPanel.includes("Les dernières informations affichées restent disponibles")
);
ok(
  "no window.location navigation (SPA router)",
  !missionPanel.includes("window.location")
);
ok(
  "mission anchor present for deep links",
  missionPanel.includes('id="mission"')
);

console.log("-- signals: human language ------------------------------");

ok(
  "signal types render SIGNAL_TYPE_LABEL, never the raw code",
  proactivePanel.includes("SIGNAL_TYPE_LABEL[signal.type]")
);
ok(
  "the entity concerned is displayed",
  proactivePanel.includes("Concerne :")
);
ok(
  "offline keeps displayed signals",
  proactivePanel.includes("Les signaux affichés restent disponibles") &&
    !proactivePanel.includes("setSignals([])")
);
ok(
  "mutations from signals are confirmation-gated",
  proactivePanel.includes("setConfirming") && proactivePanel.includes("Confirmer et exécuter")
);

console.log("-- ask console -------------------------------------------");

ok(
  "?ask=1 focuses the composer (scroll + focus, no auto-send)",
  ask.includes("autoFocus") && ask.includes("scrollIntoView") &&
    ask.includes("preventScroll: true")
);
ok(
  "initialQuery prefills the composer state only",
  ask.includes("initialQuery") && ask.includes("useState(initialQuery)")
);
ok(
  "intelligence page reads the deep link params",
  intelligencePage.includes("searchParams") &&
    intelligencePage.includes("autoFocusAsk") &&
    intelligencePage.includes("initialAskQuery")
);
ok(
  "prefill is bounded",
  intelligencePage.includes("slice(0, 500)")
);
ok(
  "composer keeps the 44px floor",
  ask.includes("min-h-[44px]")
);
ok(
  "enterKeyHint stays send (mobile keyboard)",
  ask.includes('enterKeyHint="send"')
);

console.log("-- touch targets -----------------------------------------");

ok(
  "mobile home ask CTA ≥44px",
  mobileOverview.includes("min-h-[44px]")
);
ok(
  "mission CTA ≥44px",
  missionPanel.includes('className="min-h-[44px]"')
);
ok(
  "starter chips ≥44px",
  mobileOverview.includes("min-h-[44px] items-center rounded-pill")
);

console.log("-- phase 6 leftovers stay deleted -----------------------");

ok(
  "MobileHome.tsx (dead, hallucinated globals) removed",
  !existsSync("src/components/mobile-home/MobileHome.tsx")
);
ok(
  "signals-mobile.tsx (dead, broken imports) removed",
  !existsSync("src/components/intelligence/signals-mobile.tsx")
);

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
process.exit(failed > 0 ? 1 : 0);
