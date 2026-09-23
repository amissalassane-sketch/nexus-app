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

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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
console.log("Forms — iOS focus zoom");
// ------------------------------------------------------------------
// iOS Safari scales the whole viewport when a form control's computed
// font-size is under 16px, and does not zoom back out. The viewport
// keeps user scaling (no maximum-scale), so the controls must be
// ≥16px on touch widths instead.
const css = read("app/globals.css");
const zoomGuard = css.slice(css.indexOf("iOS focus zoom"));
check(
  "globals.css: iOS focus-zoom guard present",
  zoomGuard.includes("font-size: 16px"),
  "text-entry controls must render at 16px on touch widths"
);
check(
  "globals.css: focus-zoom guard is width-scoped",
  /@media \(max-width: 767\.98px\)/.test(zoomGuard),
  "desktop keeps the 13.5px density"
);
check(
  "globals.css: range/radio/checkbox excluded from the guard",
  zoomGuard.includes('[type="range"]') &&
    zoomGuard.includes('[type="radio"]') &&
    zoomGuard.includes('[type="checkbox"]'),
  "a 4px slider must not inherit a 36px min-height"
);
check(
  "layout: viewport never disables user scaling",
  !read("app/layout.tsx").includes("maximumScale") &&
    !read("app/layout.tsx").includes("userScalable"),
  "pinch-zoom is accessibility, not a bug to suppress"
);

// ------------------------------------------------------------------
console.log("Metric rows — no three-up grid on phones");
// ------------------------------------------------------------------
// A three-column metric grid gives ~64px of content width at 320px,
// which truncates labels like "Avg. progress" into a meaningless stub.
const RESPONSIVE = /(\bxs|\bsm|\bmd|\btablet|\blg|\bxl|\bwide):grid-cols/;
for (const file of [
  "components/task-manager.tsx",
  "components/project-manager.tsx",
  "components/goal-manager.tsx",
]) {
  const text = read(file);
  const grids = text.match(/grid grid-cols-[0-9]+[^"]*"/g) ?? [];
  const squeezed = grids.filter(
    (g) => /grid-cols-[3-9]/.test(g) && !RESPONSIVE.test(g)
  );
  check(
    `${file}: no bare grid-cols-3+ metric row`,
    squeezed.length === 0,
    squeezed.join(" | ") || "phones must fall back to two columns"
  );
}

// ------------------------------------------------------------------
console.log("Layout system — grid, container, chrome");
// ------------------------------------------------------------------
// The design system the product is built against:
//   container 1148 / 768 / 360 · columns 12 / 8 / 4 · gutter 16
//   breakpoints 480 · 768 · 834 · 1024 · 1440
//   iOS  status 54 · nav 44 · tab 56 · home indicator 34 · margin 16
//   Android status 24 · app bar 56 · bottom nav 56 · system nav 48
const theme = read("app/globals.css");
for (const [token, value, why] of [
  ["--container-page", "1148px", "single page container"],
  ["--breakpoint-xs", "480px", "mobile landscape"],
  ["--breakpoint-md", "768px", "tablet portrait"],
  ["--breakpoint-tablet", "834px", "tablet landscape"],
  ["--breakpoint-lg", "1024px", "laptop"],
  ["--breakpoint-wide", "1440px", "desktop"],
  ["--page-margin", "16px", "iOS/Android 16pt page margin"],
  ["--grid-gutter", "16px", "16px gutter at every breakpoint"],
  ["--chrome-tab-bar", "56px", "bottom nav (iOS 56 / Android 56)"],
  ["--chrome-nav-bar", "56px", "app bar (Android 56)"],
]) {
  check(
    `globals.css: ${token} = ${value} (${why})`,
    new RegExp(`${token.replace(/-/g, "\\-")}:\\s*${value}\\s*;`).test(theme)
  );
}

// Breakpoint ORDER is load-bearing: Tailwind emits only the stops that
// are actually used, and if the custom stops are declared alone they
// land ahead of the built-in scale — `tablet:` (834px) would then be
// overridden by the smaller `md:` (768px) at 900px. Declaring the whole
// scale in one block keeps them in a single sorted run.
const order = [...theme.matchAll(/--breakpoint-([a-z0-9]+):\s*(\d+)px;/g)].map(
  (m) => [m[1], Number(m[2])]
);
const values = order.map(([, v]) => v);
check(
  "globals.css: breakpoint scale is declared in ascending order",
  values.length >= 8 && values.every((v, i) => i === 0 || values[i - 1] < v),
  order.map(([n, v]) => `${n}:${v}`).join(" ")
);
check(
  "globals.css: every breakpoint stop is redeclared (no default gap)",
  ["xs", "sm", "md", "tablet", "lg", "xl", "wide", "2xl"].every((n) =>
    order.some(([name]) => name === n)
  ),
  "a missing stop is emitted outside the sorted run"
);

// The single container: three widths (1080 / 1120 / 1180) used to be in
// play, so the landing page and the product disagreed about the edge.
for (const dir of ["components/landing", "components/layout", "app"]) {
  const stale = [];
  const walk = (rel) => {
    for (const entry of readdirSync(src(rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (/\.tsx?$/.test(entry.name)) {
        const t = read(child);
        if (/max-w-\[(1080|1120|1180|1148)px\]/.test(t)) stale.push(child);
      }
    }
  };
  walk(dir);
  check(
    `${dir}: no hard-coded page container width`,
    stale.length === 0,
    stale.join(", ") || "use max-w-page"
  );
}

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
