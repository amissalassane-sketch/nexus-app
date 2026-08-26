#!/usr/bin/env node
/**
 * NEXUS — MOBILE UX STRUCTURAL TESTS
 * ===================================
 * Static verification of the Phase Mobile UX invariants. There is no
 * browser-test stack in this project by design; these assertions check
 * the source-level guarantees that a real device pass would otherwise
 * rely on: safe areas, touch targets, no hover-only actions, no native
 * confirm(), reduced-motion gating, viewport configuration…
 *
 * Run:  node scripts/test-mobile-ux.mjs   (or  npm run test:mobile)
 * Exit: 0 = all invariants hold, 1 = at least one check failed.
 */

import { readFileSync, existsSync } from "node:fs";
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

function has(rel, needle, detail) {
  let text = "";
  try {
    text = read(rel);
  } catch {
    check(`${rel}: readable`, false, "file not found");
    return;
  }
  check(`${rel}: contains ${detail ?? `“${needle}”`}`, text.includes(needle));
}

console.log("\nNEXUS mobile UX — structural invariants\n");

// ------------------------------------------------------------------
console.log("Viewport & safe areas");
// ------------------------------------------------------------------
has("app/layout.tsx", 'viewportFit: "cover"', "viewport-fit=cover (iOS safe areas)");
has("app/layout.tsx", 'appleWebApp', "appleWebApp metadata (install prep)");

const shell = read("components/layout/app-shell.tsx");
check(
  "app-shell: header honors safe-area-inset-top",
  shell.includes("env(safe-area-inset-top)")
);
check(
  "app-shell: bottom nav honors safe-area-inset-bottom",
  shell.includes("pb-[env(safe-area-inset-bottom)]")
);
check(
  "app-shell: drawer footer honors safe-area-inset-bottom",
  shell.includes("env(safe-area-inset-bottom)+0.75rem")
);
check(
  "app-shell: mobile header shows current page title",
  shell.includes("breadcrumbFor(pathname)")
);
check(
  "app-shell: drawer closes on navigation",
  shell.includes("onNavigate={closeNav}")
);

has("components/ui/modal.tsx", "env(safe-area-inset-bottom)", "modal sheet safe-area padding");
has("components/intelligence/signal-detail.tsx", "env(safe-area-inset-top)", "signal detail top inset");
has("components/intelligence/signal-detail.tsx", "env(safe-area-inset-bottom)", "signal detail bottom inset");
has("components/ui/toast.tsx", "env(safe-area-inset-bottom)", "toast clears home indicator");

// ------------------------------------------------------------------
console.log("Mobile navigation model");
// ------------------------------------------------------------------
const navConfig = read("components/layout/nav-config.ts");
for (const href of ["/dashboard", "/app/intelligence", "/projects", "/tasks"]) {
  check(
    `nav-config: MOBILE_NAV carries ${href}`,
    navConfig.includes(`MOBILE_NAV`) && navConfig.includes(href),
    "primary destinations must not be dropped"
  );
}
check(
  "nav-config: no destination was removed from the full model",
  navConfig.includes('href: "/goals"') &&
    navConfig.includes('href: "/activity"') &&
    navConfig.includes('href: "/notifications"') &&
    navConfig.includes('href: "/integrations"') &&
    navConfig.includes('href: "/settings"'),
  "secondary destinations must still exist"
);

// ------------------------------------------------------------------
console.log("Touch — no hover-only interactions, no native confirm()");
// ------------------------------------------------------------------
for (const file of [
  "components/task-manager.tsx",
  "components/project-manager.tsx",
  "components/goal-manager.tsx",
]) {
  const text = read(file);
  check(
    `${file}: no window.confirm()`,
    !text.includes("window.confirm("),
    "deletes must be confirmed by the in-app ConfirmDialog"
  );
  check(
    `${file}: ConfirmDialog wired`,
    text.includes('from "@/components/ui/confirm-dialog"') && text.includes("ConfirmDialog"),
    "import + usage"
  );
  check(
    `${file}: row actions visible on touch (no hover-only reveal)`,
    text.includes("opacity-100 sm:opacity-0"),
    "actions must be always visible below sm"
  );
}

has("components/notification-center.tsx", "sm:opacity-0", "“Mark as read” visible on touch");
has("components/intelligence/signal-card.tsx", "sm:h-7", "signal CTA ≥36px on phones");
has("components/ui/button.tsx", 'sm:h-9 sm:px-3.5', "primary buttons ≥40px on phones");
has("components/ui/dropdown.tsx", "max-w-[calc(100vw-24px)]", "dropdowns clamped to viewport");

// ------------------------------------------------------------------
console.log("Intelligence mobile");
// ------------------------------------------------------------------
const ask = read("components/intelligence/intelligence-ask.tsx");
check("intelligence-ask: multi-line composer", ask.includes("<textarea") && ask.includes('enterKeyHint="send"'));
check(
  "intelligence-ask: Enter sends, Shift+Enter newline",
  ask.includes('event.key === "Enter" && !event.shiftKey')
);
check(
  "intelligence-ask: agent trace is a collapsible accordion",
  ask.includes('aria-expanded={traceOpen}') && ask.includes("AGENT_STATE_LABEL")
);
check(
  "intelligence-ask: tool trace is a collapsible accordion",
  ask.includes("setToolsOpen") && ask.includes("Outils consultés")
);
check(
  "intelligence-ask: send button keeps a ≥44px target on phones",
  ask.includes("min-h-[44px] sm:min-h-[40px]")
);

has("components/intelligence/mission-panel.tsx", "Prochaine meilleure action", "explicit next-best-action label");
has("components/intelligence/mission-panel.tsx", "min-h-[44px]", "mission action targets ≥44px");

// ------------------------------------------------------------------
console.log("Modals, forms, scroll & motion");
// ------------------------------------------------------------------
const modal = read("components/ui/modal.tsx");
check(
  "modal: bottom sheet on phones (never exceeds the screen)",
  modal.includes("items-end") && modal.includes("max-h-[92dvh]") && modal.includes("sm:items-center")
);
check(
  "modal: body scrolls internally with pinned actions",
  modal.includes("overflow-y-auto") && modal.includes("overscroll-contain")
);

has("app/globals.css", "prefers-reduced-motion", "reduced-motion gating");
has("app/globals.css", "-webkit-text-size-adjust", "iOS text-inflation guard");
has("app/globals.css", "overflow-x: hidden", "no accidental horizontal page scroll");

// ------------------------------------------------------------------
console.log("PWA preparation (no service worker)");
// ------------------------------------------------------------------
check(
  "manifest.ts exists (installability preparation)",
  existsSync(src("app/manifest.ts")),
  "web app manifest without a service worker"
);
if (existsSync(src("app/manifest.ts"))) {
  const manifest = read("app/manifest.ts");
  check("manifest: standalone display", manifest.includes('display: "standalone"'));
  check("manifest: icons referenced", manifest.includes("/icons/icon-512.png"));
  check("manifest: no service worker registered", !manifest.includes("serviceWorker"));
}

// ------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed\n`);
if (failures > 0) process.exit(1);
