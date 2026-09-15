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

console.log("\nNEXUS Admin — PR3 structural invariants\n");
const migration = read("supabase/migrations/028_admin_activity_security.sql");
for (const fn of ["admin_activity_list", "admin_audit_log_list", "admin_security_overview"]) {
  check(`${fn} is defined`, migration.includes(`function public.${fn}`));
  check(`${fn} asserts viewer access`, new RegExp(`function public\\.${fn}[\\s\\S]*?admin_assert_access\\('viewer'\\)`).test(migration));
  check(`${fn} pins search_path`, new RegExp(`function public\\.${fn}[\\s\\S]*?search_path = public, pg_temp`).test(migration));
}
check("migration has no dynamic SQL", !/execute\s+(format|\()/i.test(migration));
check("migration grants reads only to authenticated", migration.includes("to authenticated") && migration.includes("revoke all"));
for (const route of ["activity", "audit-log", "security"]) {
  check(`/admin/${route} exists`, existsSync(join(root, `src/app/admin/${route}/page.tsx`)));
  check(`/admin/${route} is dynamic`, read(`src/app/admin/${route}/page.tsx`).includes('dynamic = "force-dynamic"'));
}
const nav = read("src/lib/admin/nav.ts");
check("PR3 navigation entries are ready", ["Activity", "Audit Log", "Security"].every((label) => {
  const i = nav.indexOf(`label: "${label}"`);
  return i >= 0 && nav.slice(i, i + 180).includes('status: "ready"');
}));
check("security explicitly reports unavailable sessions", read("src/app/admin/security/page.tsx").includes("sessions"));
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
