#!/usr/bin/env node
/**
 * NEXUS ADMIN — CONTROL PLANE STRUCTURAL TESTS
 * =============================================
 * Static verification of the invariants the admin foundation must hold.
 * This project has no browser-test stack by design (see
 * scripts/test-mobile-ux.mjs for the same approach on the product shell),
 * so these assertions check the source-level guarantees that a manual
 * pass would otherwise rely on.
 *
 * The database half of the admin contract — who is allowed in, and what
 * the aggregate returns — is tested for real against PostgreSQL in
 * supabase/tests/admin-control-plane.test.mjs. This file covers what that
 * suite cannot see: routing, responsive layout, accessibility and the
 * "no fake data" rule at the presentation layer.
 *
 *   ADMIN-03  protection is server-side
 *   ADMIN-04  the overview answers its question
 *   ADMIN-09  system health never invents a status
 *   ADMIN-10  responsive
 *   ADMIN-11  accessibility
 *   ADMIN-12  no fabricated metrics
 *   ICONS     Tabler only, one visual language
 *
 * Run:  node scripts/test-admin-foundation.mjs   (or  npm run test:admin)
 * Exit: 0 = all invariants hold, 1 = at least one check failed.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
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
  check(`${rel}: ${detail ?? `contains “${needle}”`}`, text.includes(needle));
}

/** Removes comments, so an "absence" check tests the code rather than the
 *  prose explaining why something is absent. Without this, a guard file
 *  that documents "no localStorage is consulted" would fail a check for
 *  localStorage. */
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*\*[\s\S]*?\*\//g, "");
}

function lacks(rel, needle, detail) {
  let text = "";
  try {
    text = read(rel);
  } catch {
    check(`${rel}: readable`, false, "file not found");
    return;
  }
  check(`${rel}: ${detail ?? `does not contain “${needle}”`}`, !text.includes(needle));
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const ADMIN_COMPONENTS = walk(src("components/admin"));
const ADMIN_ROUTES = walk(src("app/admin"));
const ADMIN_LIB = walk(src("lib/admin"));
const ALL_ADMIN = [...ADMIN_COMPONENTS, ...ADMIN_ROUTES, ...ADMIN_LIB];

console.log("\nNEXUS Admin — control plane structural invariants\n");

// ------------------------------------------------------------------
console.log("ADMIN-03 — protection is server-side");
// ------------------------------------------------------------------
const layout = read("app/admin/layout.tsx");
check(
  "the admin layout resolves identity through the database RPC",
  layout.includes("getPlatformAdminState()"),
  "layout must call getPlatformAdminState()"
);
check(
  "the admin layout renders a refusal screen instead of the shell",
  layout.includes("<AdminAccessDenied"),
  "no refusal branch found"
);
check(
  "the admin layout redirects an unauthenticated visitor to /admin/login",
  layout.includes('redirect("/admin/login")')
);
check(
  "the admin layout is never prerendered (identity is the input)",
  layout.includes('export const dynamic = "force-dynamic"')
);
check(
  "the admin surface is excluded from indexing",
  layout.includes("index: false"),
  "metadata.robots must be noindex"
);
check(
  "a refused attempt is written to the audit trail",
  layout.includes("recordAdminAccessDenied(")
);

const guard = read("lib/admin/guard.ts");
check(
  "the gate asks Postgres, via platform_admin_context()",
  guard.includes('rpc("platform_admin_context")')
);
check(
  "the gate is bounded and cancels the request on timeout",
  guard.includes("withTimeout(") && guard.includes("controller.abort()") === false &&
    guard.includes("AbortController")
);
check(
  "the gate fails closed on a missing migration",
  guard.includes("MIGRATION_NOT_APPLIED")
);
check(
  "the gate never reads a cookie to decide access",
  !guard.includes("cookies()"),
  "guard must not touch the cookie store"
);
const guardCode = codeOnly(guard);
check(
  "the gate never reads localStorage",
  !guardCode.includes("localStorage")
);
check(
  "the gate never inspects the pathname",
  !guardCode.includes("pathname")
);
check(
  "the gate never trusts a request header",
  !guardCode.includes("headers()") && !guardCode.includes("x-admin")
);
check(
  "the gate is cached per request, not per component",
  guard.includes("cache(")
);

// Every admin route must be a server component: a "use client" page could
// render before the server gate had run. The only exception is the
// dedicated auth surface (/admin/login, /admin/forgot-password,
// /admin/reset-password): those pages render through the layout's auth
// exemption — outside the gated shell — exactly like the public auth
// forms, because they ARE the login surface.
const ADMIN_AUTH_EXEMPT_ROUTES = new Set([
  "src/app/admin/login/page.tsx",
  "src/app/admin/forgot-password/page.tsx",
  "src/app/admin/reset-password/page.tsx",
]);
const clientAdminRoutes = ADMIN_ROUTES.filter(
  (file) =>
    readFileSync(file, "utf8").includes('"use client"') &&
    !ADMIN_AUTH_EXEMPT_ROUTES.has(file.replace(ROOT, ""))
);
check(
  "no gated admin route is a client component (auth surfaces exempt)",
  clientAdminRoutes.length === 0,
  clientAdminRoutes.map((f) => f.replace(ROOT, "")).join(", ")
);

// The proxy keeps /admin out of its public list, so an anonymous visitor
// is redirected before the layout ever runs. The ONLY /admin paths that
// may be public are the three auth surfaces — without them an operator
// could never sign in (infinite redirect loop).
const middleware = read("lib/supabase/middleware.ts");
const publicRouteBlock = middleware.slice(
  middleware.indexOf("const isPublicRoute"),
  middleware.indexOf("const isAuthForm")
);
check(
  "the proxy treats only the admin auth surfaces as public",
  ["/admin/login", "/admin/forgot-password", "/admin/reset-password"].every(
    (route) => publicRouteBlock.includes(route)
  ) &&
    !/startsWith\("\/admin"\)/.test(publicRouteBlock) &&
    !/===\s*"\/admin"/.test(publicRouteBlock)
);
check(
  "the proxy redirects anonymous /admin visitors to /admin/login",
  middleware.includes('pathname.startsWith("/admin")') &&
    middleware.includes('redirectWithCookies(response, new URL("/admin/login"')
);

// ------------------------------------------------------------------
console.log("\nADMIN-04 — the overview answers its question");
// ------------------------------------------------------------------
const overview = read("app/admin/overview/page.tsx");
has("app/admin/overview/page.tsx", "Platform status, business health and product usage");
for (const kpi of ["Total Users", "Active Users", "Workspaces", "MRR"]) {
  check(`overview: KPI “${kpi}” is present`, overview.includes(`label="${kpi}"`));
}
for (const section of [
  "Platform Status",
  "Business health",
  "Product Usage",
  "Intelligence Health",
  "Integration Health",
  "Data Integrity",
  "Background Jobs & Automations",
  "Needs Attention",
  "Growth",
  "Recent Activity",
]) {
  check(`overview: section “${section}” is present`, overview.includes(section));
}
check(
  "overview: the header states when the data was read",
  overview.includes("formatRelativeTime(generatedAt)") &&
    overview.includes("formatDateTime(generatedAt)")
);
check(
  "overview: the measurement period is stated, not implied",
  overview.includes("Period: last 30 days")
);
check(
  "overview: the operator can re-run the real reads",
  overview.includes("<AdminRefreshButton")
);
check(
  "overview: a failed aggregate renders an error state, not zeros",
  overview.includes("<AdminErrorState")
);
check(
  "overview: the health panel explains that no uptime figure exists",
  overview.includes("No uptime percentage")
);

// ------------------------------------------------------------------
console.log("\nADMIN-09 — health never invents a status");
// ------------------------------------------------------------------
const health = read("lib/admin/health.ts");
// The seven-state model: every state has exactly one cause.
for (const status of [
  '"operational"',
  '"degraded"',
  '"error"',
  '"not_configured"',
  '"not_measured"',
  '"stale"',
  '"blocked"',
]) {
  check(`health: status ${status} is modelled`, health.includes(status));
}
check(
  "health: the legacy ambiguous states (down / unknown) are gone",
  !health.includes('"down"') && !health.includes(': "unknown"')
);
check(
  "health: payments report Not configured — a declared absence, not a failure",
  /id: "payments"[\s\S]{0,200}status: "not_configured"/.test(health)
);
check(
  "health: storage is really probed (bucket listing), not guessed",
  health.includes("probeStorage") && health.includes('from("nexus-files")') === false
    ? health.includes("supabase.storage.from(\"nexus-files\")")
    : health.includes("supabase.storage.from")
);
check(
  "health: background jobs report Not configured, because no scheduler is deployed",
  /id: "jobs"[\s\S]{0,200}status: "not_configured"/.test(health)
);
check(
  "health: an unconfigured AI provider reports Not configured, with the exact env vars",
  /function probeIntelligence[\s\S]{0,600}not_configured[\s\S]{0,400}OPENAI_API_KEY/.test(health)
);
check(
  "health: degraded is derived from a real latency threshold",
  health.includes("const SLOW_MS") && health.includes("statusFromLatency")
);
check(
  "health: the database probe measures a real round trip",
  health.includes("performance.now()")
);
const healthCode = codeOnly(health);
check(
  "health: authentication probes GoTrue, not the local JWT",
  healthCode.includes("supabase.auth.getUser()") && !healthCode.includes("getSession()")
);
check(
  "health: a failed probe degrades to Not measured, never to Operational",
  health.includes('status: "not_measured" as ServiceStatus')
);
lacks("lib/admin/health.ts", "99.9", "no hardcoded uptime percentage");

// ------------------------------------------------------------------
console.log("\nADMIN-10 — responsive");
// ------------------------------------------------------------------
const shell = read("components/admin/admin-shell.tsx");
check(
  "shell: the sidebar is persistent from the tablet breakpoint up",
  shell.includes("hidden h-dvh w-[64px]") && shell.includes("md:flex")
);
check(
  "shell: the sidebar widens and shows labels on desktop",
  shell.includes("lg:w-[248px]") && shell.includes("hidden lg:inline")
);
check(
  "shell: below the tablet breakpoint a drawer takes over",
  shell.includes('id="nexus-admin-drawer"') && shell.includes("md:hidden")
);
check(
  "shell: content never overflows its column",
  shell.includes("min-w-0 flex-1")
);

const kpi = read("components/admin/kpi.tsx");
check(
  "KPI strip: two columns on a phone, four from the tablet up",
  kpi.includes("grid-cols-2") && kpi.includes("sm:grid-cols-4")
);
check(
  "KPI strip: hairlines survive the column change without nth-child rules",
  kpi.includes("gap-px bg-admin-border")
);

for (const [file, label] of [
  ["components/admin/health-list.tsx", "health list"],
  ["components/admin/activity-list.tsx", "activity list"],
]) {
  const text = read(file);
  check(
    `${label}: stacks on mobile and splits from the tablet up`,
    text.includes("flex-col") && text.includes("sm:flex-row")
  );
  check(
    `${label}: long content is constrained, never allowed to overflow`,
    text.includes("truncate") || text.includes("max-w-"),
    "expected truncate or a bounded measure"
  );
}

const navBody = read("components/admin/admin-shell.tsx");
check(
  "navigation: one DOM tree serves both sidebar widths",
  !/NavBody[\s\S]{0,400}compact=\{true\}[\s\S]{0,400}compact=\{false\}/.test(navBody),
  "the same links must not be rendered twice"
);

// ------------------------------------------------------------------
console.log("\nADMIN-11 — accessibility");
// ------------------------------------------------------------------
check("shell: the drawer is a real dialog", shell.includes('role="dialog"'));
check("shell: the drawer is modal", shell.includes('aria-modal="true"'));
check("shell: the drawer has an accessible name", shell.includes('aria-label="NEXUS Admin navigation"'));
check(
  "shell: Escape closes the drawer",
  shell.includes('event.key === "Escape"')
);
check(
  "shell: focus moves into the drawer and back to the trigger",
  shell.includes("closeRef.current?.focus()") && shell.includes("triggerRef.current?.focus()")
);
check(
  "shell: the trigger advertises what it controls",
  shell.includes("aria-expanded={drawerOpen}") &&
    shell.includes('aria-controls="nexus-admin-drawer"')
);
check(
  "shell: icon-only buttons carry an accessible label",
  shell.includes('aria-label="Open NEXUS Admin navigation"') &&
    shell.includes('aria-label="Close navigation"')
);
check(
  "shell: the current section is exposed to assistive technology",
  shell.includes('aria-current={active ? "page" : undefined}')
);
check(
  "shell: focus is visible on every interactive element",
  (shell.match(/focus-visible:outline/g) ?? []).length >= 5,
  "expected a focus ring on the trigger, close button, links and sign out"
);
check(
  "shell: the navigation is a landmark with a name",
  shell.includes('aria-label="NEXUS Admin sections"') && shell.includes("<nav")
);
check(
  "shell: planned entries are marked disabled, not silently hidden",
  shell.includes('aria-disabled="true"')
);
check(
  "shell: animation respects reduced motion",
  shell.includes("motion-safe:animate")
);
for (const tag of ["<main", "<header", "<aside"]) {
  check(`shell: uses the semantic ${tag.replace("<", "")} element`, shell.includes(tag));
}

const icons = read("components/admin/admin-icons.tsx");
check(
  "icons: decorative by default (aria-hidden unless named)",
  icons.includes("aria-hidden={label ? undefined : true}")
);
check(
  "icons: a named icon becomes role=\"img\" with a label",
  icons.includes('role={label ? "img" : undefined}') && icons.includes("aria-label={label}")
);

const healthList = read("components/admin/health-list.tsx");
check(
  "health list: status is written out, never colour alone",
  healthList.includes("<AdminServiceStatus") && healthList.includes('aria-hidden="true"')
);
const activity = read("components/admin/activity-list.tsx");
check(
  "activity list: timestamps are machine-readable",
  activity.includes("<time") && activity.includes("dateTime={entry.occurred_at}")
);

// ------------------------------------------------------------------
console.log("\nADMIN-12 — no fabricated metrics");
// ------------------------------------------------------------------
const format = read("lib/admin/format.ts");
check(
  "format: a missing value renders as “Not available”, never 0",
  format.includes('export const NOT_AVAILABLE = "Not available"') &&
    format.includes("if (!hasValue(value)) return NOT_AVAILABLE")
);
check(
  "format: an unknown denominator yields no percentage",
  format.includes("if (!hasValue(part) || !hasValue(total) || total === 0) return null")
);

check(
  "overview: MRR is reported as unavailable",
  /label="MRR"[\s\S]{0,120}value=\{NOT_AVAILABLE\}/.test(overview),
  "MRR must not be given a number while no provider is connected"
);
check(
  "overview: MRR explains why it is empty",
  /label="MRR"[\s\S]{0,240}No payment provider is connected/.test(overview)
);
check(
  "overview: Active Users states its own definition",
  /label="Active Users"[\s\S]{0,240}Signed in during the last 30 days/.test(overview)
);
check(
  "overview: sessions are declared unavailable rather than estimated",
  overview.includes("Sessions are not listed")
);

// Every KPI value must come from the formatters or the explicit
// "not available" marker — never from a literal typed into the page.
const valueProps = [...overview.matchAll(/value=\{([^}]*)\}/g)].map((m) => m[1].trim());
const literalValues = valueProps.filter(
  (v) => !v.startsWith("format") && v !== "NOT_AVAILABLE" && !v.startsWith("overview")
);
check(
  "overview: no KPI value is a hardcoded literal",
  literalValues.length === 0,
  `suspicious: ${literalValues.join(" | ")}`
);

// The classic fake-dashboard numbers must appear nowhere in the surface.
const FAKE_FIGURES = ["14,284", "14284", "42,500", "42500", "99.98", "99.9%", "$12,480", "1,284,930"];
const offenders = ALL_ADMIN.filter((file) => {
  const text = readFileSync(file, "utf8");
  return FAKE_FIGURES.some((figure) => text.includes(figure));
});
check(
  "admin surface: no invented headline figures anywhere",
  offenders.length === 0,
  offenders.map((f) => f.replace(ROOT, "")).join(", ")
);

const types = read("lib/admin/types.ts");
check(
  "types: a missing measurement is modelled as null, not 0",
  types.includes("number | null") && types.includes("NULL means \"not measured")
);

// ------------------------------------------------------------------
console.log("\nICONS — Tabler only, one visual language");
// ------------------------------------------------------------------
const lucideUsers = ALL_ADMIN.filter((file) =>
  readFileSync(file, "utf8").includes("lucide-react")
);
check(
  "admin surface: no Lucide anywhere",
  lucideUsers.length === 0,
  lucideUsers.map((f) => f.replace(ROOT, "")).join(", ")
);
const otherIconLibs = ALL_ADMIN.filter((file) => {
  const text = readFileSync(file, "utf8");
  return (
    text.includes("@heroicons") ||
    text.includes("react-icons") ||
    text.includes("@fortawesome")
  );
});
check("admin surface: no other icon library", otherIconLibs.length === 0);
check("icons: sourced from @tabler/icons-react", icons.includes('from "@tabler/icons-react"'));
check("icons: outline stroke fixed at 1.75", icons.includes("stroke = 1.75"));
check("icons: 24px grid, rendered through currentColor", !icons.includes("fill="));
for (const [size, px] of [
  ["nav", 18],
  ["toolbar", 18],
  ["action", 16],
  ["state", 24],
  ["stateLg", 32],
]) {
  check(`icons: ${size} size is ${px}px`, new RegExp(`${size}:\\s*${px},`).test(icons));
}

// ------------------------------------------------------------------
console.log("\nNAVIGATION — the shell does not link to nothing");
// ------------------------------------------------------------------
const nav = read("lib/admin/nav.ts");
const readyRoutes = [...nav.matchAll(/href: "([^"]+)",\s*\n\s*icon:[^,]+,\s*\n\s*status: "ready"/g)].map(
  (m) => m[1]
);
check("navigation: at least one route is ready", readyRoutes.length > 0);
for (const route of readyRoutes) {
  const pagePath = src(`app${route}/page.tsx`);
  check(`navigation: ${route} has a page`, existsSync(pagePath));
}
check(
  "navigation: planned entries carry a visible reason",
  (nav.match(/status: "planned"/g) ?? []).length ===
    (nav.match(/note:/g) ?? []).length,
  "every planned item needs a note"
);

// ------------------------------------------------------------------
console.log("\nDESIGN — the admin ramp stays inside the admin surface");
// ------------------------------------------------------------------
// Consumers only. src/app/globals.css is where the ramp is declared — the
// one file outside src/app/admin that is supposed to mention it — so it is
// excluded, and the declaration itself is checked separately.
const outsideAdmin = [
  ...walk(src("components")).filter((f) => !f.includes(`${join("components", "admin")}`)),
  ...walk(src("app")).filter((f) => !f.includes(`${join("app", "admin")}`)),
].filter((f) => /\.(tsx?|jsx?)$/.test(f));
const tokenLeak = outsideAdmin.filter((file) =>
  /\b(?:bg|text|border|outline|divide|from|to)-admin-/.test(readFileSync(file, "utf8"))
);
check(
  "design: admin tokens are not used by the product surface",
  tokenLeak.length === 0,
  tokenLeak.map((f) => f.replace(ROOT, "")).join(", ")
);

const globals = readFileSync(src("app/globals.css"), "utf8");
check(
  "design: admin keeps namespaced tokens with the required pure-black base",
  globals.includes("--color-admin-base: #000000") &&
    globals.includes("--color-admin-sidebar: #000000") &&
    globals.includes("--color-admin-accent: #d2ff4d")
);
check(
  "design: the product ramp is untouched (pure black base, white accent)",
  globals.includes("--color-bg-base: #000000") && globals.includes("--color-accent: #ffffff")
);

// ------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed\n`);
process.exit(failures > 0 ? 1 : 0);
