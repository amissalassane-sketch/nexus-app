#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
let passed = 0;
let failed = 0;
function check(label, value) {
  if (value) { passed++; console.log(`  ✔ ${label}`); }
  else { failed++; console.error(`  ✘ ${label}`); }
}

console.log("\nNEXUS Admin — PR6 (subscriptions) structural invariants\n");
const migration = read("supabase/migrations/029_admin_subscriptions.sql");
check(
  "admin_subscriptions_list is defined",
  migration.includes("function public.admin_subscriptions_list")
);
check(
  "admin_subscriptions_list asserts viewer access",
  /function public\.admin_subscriptions_list[\s\S]*?admin_assert_access\('viewer'\)/.test(migration)
);
check(
  "admin_subscriptions_list pins search_path",
  /function public\.admin_subscriptions_list[\s\S]*?search_path = public, pg_temp/.test(migration)
);
// The function body builds no SQL from caller input (CASE whitelists
// only). The guarded revoke loop below it legitimately uses
// `execute format(...)` over a hardcoded array — 026/027's pattern —
// so the check is scoped to the function, not the whole file.
check(
  "the function body has no dynamic SQL",
  !/execute\s+(format|\()/i.test(migration.split("-- 2. GRANTS")[0])
);
check(
  "migration grants reads only to authenticated",
  migration.includes("to authenticated") && migration.includes("revoke all")
);
check(
  "the grant targets the real 7-argument signature (a mistyped arity would 404 the RPC)",
  migration.includes("admin_subscriptions_list(text, text, text, text, text, int, int)")
);
check(
  "the status vocabulary includes the sweep's 'expired'",
  migration.includes("when 'expired'") && migration.includes("'expired',")
);

const page = read("src/app/admin/subscriptions/page.tsx");
check("/admin/subscriptions exists", existsSync(join(root, "src/app/admin/subscriptions/page.tsx")));
check("/admin/subscriptions is dynamic", page.includes('dynamic = "force-dynamic"'));
check(
  "/admin/subscriptions is excluded from indexing",
  page.includes("index: false")
);
check(
  "/admin/subscriptions reads through the subscriptions module",
  page.includes("getAdminSubscriptionsList") &&
    page.includes("parseSubscriptionsListQuery(await searchParams)")
);
check(
  "/admin/subscriptions renders the error state",
  page.includes("<AdminErrorState")
);
check(
  "/admin/subscriptions renders a measured-empty state",
  page.includes("<AdminEmptyState") && page.includes("Nothing on this page")
);
// Comments stripped: the header legitimately documents WHY money is
// absent. The rule governs rendered copy, not the explanation.
const pageCode = page
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
check(
  "/admin/subscriptions shows no money (no provider is connected)",
  !pageCode.includes("MRR") &&
    !/\$\d/.test(pageCode) &&
    !pageCode.includes("invoice")
);
check(
  "/admin/subscriptions states the live-row definition",
  page.includes("most recently updated row")
);

const loading = read("src/app/admin/subscriptions/loading.tsx");
check(
  "subscriptions loading.tsx announces via a polite status region",
  loading.includes('role="status"') && loading.includes('aria-live="polite"')
);
check(
  "subscriptions loading.tsx respects reduced motion",
  loading.includes("motion-reduce:animate-none")
);

const nav = read("src/lib/admin/nav.ts");
check("Subscriptions is marked ready", (() => {
  const i = nav.indexOf('label: "Subscriptions"');
  return i >= 0 && nav.slice(i, i + 180).includes('status: "ready"');
})());

const lib = read("src/lib/admin/subscriptions.ts");
check(
  "the subscriptions data layer is read-only: no PostgREST table access at all",
  !lib.includes(".from(") &&
    !lib.includes(".insert(") &&
    !lib.includes(".update(") &&
    !lib.includes(".delete(") &&
    !lib.includes(".upsert(")
);
check(
  "…and its RPC vocabulary is exactly admin_subscriptions_list",
  lib.includes('"admin_subscriptions_list"') &&
    (lib.match(/"admin_[a-z_]+"/g) ?? []).length === 1
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
