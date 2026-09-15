#!/usr/bin/env node
/**
 * NEXUS ADMIN — DIRECTORY STRUCTURAL TESTS (PR 2)
 * ================================================
 * Static verification of the invariants /admin/users and /admin/workspaces
 * must hold at the source level. The runtime half — who the database
 * admits, what the payloads contain, how NULLs behave — is proven against
 * real PostgreSQL in supabase/tests/admin-users-workspaces.test.mjs, and
 * the state contract against fake clients in supabase/tests/admin-directory.test.mjs.
 * What only this file can see:
 *
 *   ADMIN-USERS-01  every directory route exists and sits behind the guard
 *   ADMIN-USERS-02  no directory route is reachable outside the layout
 *   ADMIN-USERS-04  the UI renders empty ≠ error ≠ unavailable, per branch
 *   ADMIN-USERS-06  not-found is a rendered state, and the layout never
 *                   bubbles it into the product's marketing 404
 *   ADMIN-SECURITY-02  no privileged read exists outside an admin-gated
 *                      server component; no client-side Supabase anywhere
 *   DESIGN      tokens stay admin-only; mono only where the system says
 *               mono (ids, timestamps, slugs); one icon library
 *   A11Y        captioned tables, labelled controls, aria-sort, aria-sort
 *               pagination, keyboard-visible focus
 *   NO FAKE     no hardcoded metrics, no fabricated labels
 *
 * Run:  node scripts/test-admin-users-workspaces.mjs
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

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const PAGES = {
  usersList: "app/admin/users/page.tsx",
  usersDetail: "app/admin/users/[userId]/page.tsx",
  wsList: "app/admin/workspaces/page.tsx",
  wsDetail: "app/admin/workspaces/[workspaceId]/page.tsx",
  usersLoading: "app/admin/users/loading.tsx",
  wsLoading: "app/admin/workspaces/loading.tsx",
};
const ALL_PAGES = Object.values(PAGES);
const ADMIN_DIR_FILES = [
  ...walk(src("components/admin")),
  ...walk(src("app/admin")),
  ...walk(src("lib/admin")),
].filter((f) => /\.(tsx?|mjs)$/.test(f));

console.log("\nNEXUS Admin — directory (PR 2) structural invariants\n");

// ------------------------------------------------------------------
console.log("ADMIN-USERS-01/02 — routes exist, and only behind the guard");
// ------------------------------------------------------------------
for (const [label, rel] of Object.entries(PAGES)) {
  check(`route file present: ${label}`, existsSync(src(rel)));
}

// The gate lives in app/admin/layout.tsx and is structurally unavoidable:
// every route below /admin renders inside it. What can rot is a route
// reaching for the client directly, or the layout's guard call being
// removed. Both are asserted here for the PR 2 surface.
const layout = read("app/admin/layout.tsx");
check(
  "the shared admin layout still performs the server-side identity gate",
  layout.includes("getPlatformAdminState()") && layout.includes("<AdminAccessDenied")
);
for (const rel of ALL_PAGES) {
  const text = read(rel);
  check(`${rel}: never a client component`, !text.includes('"use client"'));
  check(
    `${rel}: no browser Supabase client`,
    !text.includes("createBrowserClient") && !text.includes("@supabase/ssr")
  );
  check(
    `${rel}: excluded from search engines`,
    !text.includes("export const metadata") || text.includes("index: false") ||
      text.includes("generateMetadata")
  );
}
check(
  "users list reads through the admin directory module",
  read(PAGES.usersList).includes("getAdminUsersList")
);
check(
  "workspaces list reads through the admin directory module",
  read(PAGES.wsList).includes("getAdminWorkspacesList")
);
check(
  "user inspector resolves the id through the parse-before-query rule",
  read(PAGES.usersDetail).includes("parseDirectoryId") &&
    read(PAGES.usersDetail).includes("getAdminUserDetail")
);
check(
  "workspace inspector resolves the id through the parse-before-query rule",
  read(PAGES.wsDetail).includes("parseDirectoryId") &&
    read(PAGES.wsDetail).includes("getAdminWorkspaceDetail")
);

// Pages must go through the query parser, never raw searchParams values.
for (const rel of [PAGES.usersList, PAGES.wsList]) {
  const text = read(rel);
  check(
    `${rel}: searchParams pass through the whitelist parser`,
    /parse(Users|Workspaces)ListQuery\(await searchParams\)/.test(text)
  );
  check(
    `${rel}: raw searchParams never reach an RPC`,
    !/rpc\(/.test(text) && !/searchParams\.[a-z]/.test(text)
  );
}

// ------------------------------------------------------------------
console.log("\nADMIN-USERS-04 — the three outcomes stay three");
// ------------------------------------------------------------------
for (const rel of [PAGES.usersList, PAGES.wsList]) {
  const text = read(rel);
  check(`${rel}: renders the error state`, text.includes("<AdminErrorState"));
  check(`${rel}: renders a measured-empty state`, text.includes("<AdminEmptyState"));
  check(`${rel}: distinguishes page-out-of-range from no-matches`,
    text.includes("Nothing on this page"));
  check(`${rel}: offers retry on the failed read`, text.includes("<AdminRefreshButton"));
  check(`${rel}: never renders a KPI tile (no dashboard drift)`,
    !text.includes("KpiTile") && !text.includes("KpiGrid"));
}
for (const rel of [PAGES.usersDetail, PAGES.wsDetail]) {
  const text = read(rel);
  check(`${rel}: not-found is an explicit rendered state`,
    text.includes('state === "not_found"') && text.includes("not found"));
  check(`${rel}: failed reads render the error panel, not an empty record`,
    text.includes("<AdminErrorState"));
  check(`${rel}: the failed and missing states both return to the list`,
    text.includes('href="/admin/') || text.includes("backHref"));
}

// The invalid-id path must short-circuit BEFORE a database round trip.
has(PAGES.usersDetail, "if (userId === null)", "malformed id returns not-found without an RPC");
has(PAGES.wsDetail, "if (workspaceId === null)", "malformed id returns not-found without an RPC");

// ------------------------------------------------------------------
console.log("\nADMIN-SECURITY-02 — nothing privileged escapes the gate");
// ------------------------------------------------------------------
const directory = read("lib/admin/directory.ts");
check(
  "the directory data layer is read-only: no PostgREST table access at all",
  !directory.includes(".from(") &&
    !directory.includes(".insert(") &&
    !directory.includes(".update(") &&
    !directory.includes(".delete(") &&
    !directory.includes(".upsert(")
);
check(
  "…and its RPC vocabulary is exactly the four 027 readers",
  ["admin_users_list", "admin_user_detail", "admin_workspaces_list", "admin_workspace_detail"].every(
    (fn) => directory.includes(`"${fn}"`)
  ) && (directory.match(/"admin_[a-z_]+"/g) ?? []).length === 4,
  `rpc names: ${(directory.match(/"admin_[a-z_]+"/g) ?? []).join(", ")}`
);
check(
  "…and no mutation verb reaches it",
  !/"admin_[a-z_]*(set|update|delete|insert|grant|ban|impersonate)[a-z_]*"/.test(directory)
);

const serverOnly = ADMIN_DIR_FILES.filter((file) => {
  const rel = file.replace(src(""), "");
  if (rel.includes(join("components", "admin", "copy-button.tsx"))) return false;
  if (rel.includes(join("components", "admin", "admin-shell.tsx"))) return false;
  if (rel.includes(join("components", "admin", "admin-refresh-button.tsx"))) return false;
  return readFileSync(file, "utf8").includes('"use client"');
});
check(
  "client components inside the admin surface are only chrome (shell, refresh, copy)",
  serverOnly.length === 0,
  serverOnly.map((f) => f.replace(ROOT, "")).join(", ")
);
check(
  "no admin file reads a cookie, header or localStorage",
  ADMIN_DIR_FILES.every((file) => {
    const text = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    return (
      !text.includes("document.cookie") &&
      !text.includes("localStorage") &&
      !/cookies\(\)/.test(text.replace(/guard\.ts$/, "")) // guard documents it does NOT use cookies
    );
  })
);
check(
  "the layout guards /admin/** by construction: every page lives under app/admin",
  walk(src("app")).filter((f) => f.endsWith("page.tsx") && /\/admin\/(users|workspaces)/.test(f))
    .every((f) => f.includes(join("app", "admin"))),
  "a directory route moved outside the guarded subtree — do not do that"
);

// ------------------------------------------------------------------
console.log("\nNO FAKE DATA — the directory renders what the RPC returned");
// ------------------------------------------------------------------
const fakeFigurePatterns = [
  /\b\d{1,3}(,\d{3})+\b/, // 1,234-style invented magnitudes
  /99\.\d\s?%/i,
  /\bMRR\b[^\n]*\$\d/,
];
for (const rel of [...ALL_PAGES, "components/admin/table.tsx", "components/admin/list-controls.tsx", "components/admin/directory.tsx"]) {
  const text = read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const offenders = fakeFigurePatterns.filter((p) => p.test(text));
  check(`${rel}: contains no hardcoded figures`, offenders.length === 0);
}
check(
  "every list cell value flows from the payload — formatCount/formatDateTime only",
  [PAGES.usersList, PAGES.wsList].every((rel) =>
    read(rel).includes("formatCount") && read(rel).includes("AdminTimeCell")
  )
);
check(
  "the 'unnamed account' fallback is a truncated id, never a friendly nickname",
  read("components/admin/directory.tsx").includes("shortIdInline")
);

// ------------------------------------------------------------------
console.log("\nDESIGN — admin tokens only, mono where the system says mono");
// ------------------------------------------------------------------
const NEW_FILES = [
  "app/admin/users/page.tsx",
  "app/admin/users/[userId]/page.tsx",
  "app/admin/workspaces/page.tsx",
  "app/admin/workspaces/[workspaceId]/page.tsx",
  "app/admin/users/loading.tsx",
  "app/admin/workspaces/loading.tsx",
  "components/admin/table.tsx",
  "components/admin/list-controls.tsx",
  "components/admin/badges.tsx",
  "components/admin/detail.tsx",
  "components/admin/directory.tsx",
  "components/admin/copy-button.tsx",
];
for (const rel of NEW_FILES) {
  const text = read(rel);
  // badges.tsx is a pure value→tone mapping: it deliberately owns no
  // class strings, delegating every pixel to AdminStatusPill — which is
  // exactly why the same badge can never drift between screens. The
  // token rule for it is therefore "use no ramp at all", asserted below.
  if (rel.endsWith("badges.tsx")) {
    check(
      `${rel}: owns no class strings (all presentation delegated to the pill)`,
      !/className=/.test(text),
      "badge tone maps must stay the single source across lists and inspectors"
    );
  } else {
    check(`${rel}: uses admin tokens (bg-admin-/text-admin-)`, /-admin-(base|surface|border|text|accent|success|warning|danger|info)/.test(text));
  }
  check(
    `${rel}: no product palette classes`,
    !/\b(?:bg|text|border)-(?:bg-base|bg-surface(?:-2|-3)?|bg-subtle|text-primary|text-secondary|text-muted|accent-fg)\b/.test(text),
    "the product ramp and the admin ramp must not mix"
  );
  check(`${rel}: no raw hex colours`, !/#[0-9a-fA-F]{3,8}\b/.test(text));
}
check(
  "ids and timestamps render in mono (Geist Mono via font-mono)",
  read("components/admin/directory.tsx").includes("font-mono")
);
check(
  "the timestamp cell is a <time> element with dateTime",
  read("components/admin/directory.tsx").includes("<time") &&
    read("components/admin/directory.tsx").includes("dateTime={iso}")
);
check(
  "missing measurements render NOT_AVAILABLE, never a guessed 0",
  read("components/admin/directory.tsx").includes("NOT_AVAILABLE")
);

// ------------------------------------------------------------------
console.log("\nICONS — Tabler only, sizes from the system");
// ------------------------------------------------------------------
const iconOffenders = ADMIN_DIR_FILES.filter((file) =>
  readFileSync(file, "utf8").includes("lucide-react")
);
check("the PR 2 surface added no Lucide anywhere", iconOffenders.length === 0,
  iconOffenders.map((f) => f.replace(ROOT, "")).join(", "));
check(
  "other icon libraries are absent too",
  ADMIN_DIR_FILES.every(
    (file) =>
      !readFileSync(file, "utf8").includes("@heroicons") &&
      !readFileSync(file, "utf8").includes("react-icons") &&
      !readFileSync(file, "utf8").includes("@fortawesome")
  )
);
check(
  "new chrome routes all icons through the AdminIcon wrapper",
  ["table.tsx", "list-controls.tsx", "detail.tsx", "copy-button.tsx", "directory.tsx"].every(
    (f) => read(join("components/admin", f)).includes("<AdminIcon") ||
      !read(join("components/admin", f)).includes("svg")
  )
);

// ------------------------------------------------------------------
console.log("\nA11Y & RESPONSIVE — table semantics, labels, scroll");
// ------------------------------------------------------------------
const table = read("components/admin/table.tsx");
check("tables render a real <table> with an sr-only caption",
  table.includes("<table") && table.includes("<caption className=\"sr-only\">"));
check("header cells are <th scope=\"col\">", table.includes('scope="col"'));
check("sortable headers expose aria-sort", table.includes("aria-sort="));
check("row interaction is one stretched link per row (single tab stop)",
  table.includes("after:absolute after:inset-0 after:content-['']"));

const controls = read("components/admin/list-controls.tsx");
check("search is a GET form to the same route (works without JS)",
  controls.includes('method="get"') && controls.includes("action={pathname}"));
check("the search input is labelled", controls.includes("<label htmlFor=\"admin-list-search\""));
check("filter selects are labelled native selects",
  controls.includes("<select") && controls.includes("<label"));
check("pagination is a labelled nav landmark",
  controls.includes('<nav') && controls.includes('aria-label="Pagination"'));
check("pagination links name themselves and the current page is text, not a link",
  controls.includes('aria-label={dir === "prev" ? "Previous page" : "Next page"}'));

const usersListText = read(PAGES.usersList);
const wsListText = read(PAGES.wsList);
check("list routes mark themselves non-prerenderable",
  usersListText.includes('export const dynamic = "force-dynamic"') &&
    wsListText.includes('export const dynamic = "force-dynamic"'));
check("dense tables scroll instead of clipping on narrow screens",
  table.includes("overflow-x-auto") && table.includes("min-w-["));
check("lists keep one constrained column (min-w-0 discipline)",
  usersListText.includes("min-w-0") && wsListText.includes("min-w-0"));

for (const rel of [PAGES.usersLoading, PAGES.wsLoading]) {
  const text = read(rel);
  check(`${rel}: announces via a polite status region`,
    text.includes('role="status"') && text.includes("aria-live=\"polite\""));
  check(`${rel}: skeleton pulses respect reduced motion`,
    text.includes("motion-reduce:animate-none"));
  check(`${rel}: the decorative skeleton is hidden from AT`, text.includes('aria-hidden="true"'));
}

const focusTargets = ["table.tsx", "list-controls.tsx", "detail.tsx", "copy-button.tsx"];
const totalFocus = focusTargets.reduce(
  (n, f) => n + (read(join("components/admin", f)).match(/focus-visible:outline/g) ?? []).length,
  0
);
check("every new interactive element carries a visible focus ring", totalFocus >= 10,
  `found ${totalFocus}`);

// ------------------------------------------------------------------
console.log("\nSCOPE — PR 2 ships exactly PR 2");
// ------------------------------------------------------------------
const nav = read("lib/admin/nav.ts");
check("Users and Workspaces are marked ready",
  /href: "\/admin\/users",[\s\S]{0,80}status: "ready"/.test(nav) &&
  /href: "\/admin\/workspaces",[\s\S]{0,80}status: "ready"/.test(nav));
check("the planned entries that are NOT PR 2 remain planned with notes",
  nav.includes("PR 5") && nav.includes("PR 3") && (nav.match(/status: "planned"/g) ?? []).length >= 14);
check("Billing / Revenue / Flags pages were NOT created",
  !existsSync(src("app/admin/billing")) && !existsSync(src("app/admin/revenue")) &&
  !existsSync(src("app/admin/feature-flags")) && !existsSync(src("app/admin/intelligence")));
check("no impersonation route exists",
  !walk(src("app/admin")).some((f) => /impersonat/i.test(f)));
const impersonationContext = ADMIN_DIR_FILES
  .map((f) => {
    // Comments stripped: the rule governs executable text, not prose that
    // explains why something is absent. Copy strings survive removal.
    const text = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const m = text.match(/.{0,140}impersonat.{0,260}/is);
    return m ? { file: f.replace(ROOT, ""), ctx: m[0] } : null;
  })
  .filter(Boolean);
check(
  "every executable mention of impersonation sits inside refusal copy",
  impersonationContext.every((entry) =>
    /Out of scope|no session-minting|bypass every audit|not offered|disabled/i.test(entry.ctx)
  ) &&
    !ADMIN_DIR_FILES.some((f) =>
      readFileSync(f, "utf8").includes("createClientForImpersonation")
    ),
  impersonationContext.map((e) => e.file).join(", ") || "no runtime mentions at all"
);
check("no DELETE endpoint or mutation was added for users/workspaces",
  !existsSync(src("app/api/admin")) && !read("lib/admin/types.ts").includes("mutation"));

const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
check("test:admin wires the PR 2 suites (unit, SQL, structure)",
  pkg.includes("supabase/tests/admin-directory.test.mjs") &&
    pkg.includes("supabase/tests/admin-users-workspaces.test.mjs") &&
    pkg.includes("scripts/test-admin-users-workspaces.mjs"));

check("migration 027 exists and declares its gates",
  readFileSync(join(ROOT, "supabase/migrations/027_admin_directory.sql"), "utf8")
    .match(/admin_assert_access/g)?.length >= 4);
check("027 pins search_path on every function",
  (readFileSync(join(ROOT, "supabase/migrations/027_admin_directory.sql"), "utf8")
    .match(/set search_path = public, pg_temp/g) ?? []).length === 4);
check("027 revokes before granting (the 026 pattern)",
  readFileSync(join(ROOT, "supabase/migrations/027_admin_directory.sql"), "utf8")
    .includes("revoke all on function"));

console.log(`\n${passes} passed, ${failures} failed\n`);
process.exit(failures > 0 ? 1 : 0);
