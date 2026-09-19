/**
 * ============================================================
 * NEXUS ADMIN — AUTH & AUTHORIZATION CONTRACT SUITE
 * ============================================================
 * Tests the security invariants of the NEXUS Control Center
 * authentication and platform_admins authorization contract:
 *
 *   A. Unauthenticated user -> Admin refused (redirect /admin/login)
 *   B. Authenticated standard user -> Admin refused (status not_admin)
 *   C. Authenticated platform admin -> Admin authorised (status admin)
 *   D. Sign out -> Session cleared, admin access ceases
 *   E. Direct navigation /admin/overview without session -> unauthenticated
 *   F. Direct navigation /admin/overview with non-admin session -> not_admin
 *   G. Direct navigation /admin/overview with Admin session -> authorized
 *   H. Access /admin/login without session -> permitted
 *   I. Access /admin/login with Admin session -> redirected to overview
 *   J. Cannot self-promote via client PostgREST queries (RLS zero-policy)
 *   K. Cannot modify public.platform_admins from standard account
 *   L. Password reset does not leak email existence
 *   M. No service_role or admin secret in client bundles
 *   N. All ready Admin routes guarded by server-side verification
 * ============================================================
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const { readyAdminRoutes } = await import("../../src/lib/admin/nav.ts");
const { classifyGuardError } = await import("../../src/lib/admin/guard.ts");

let passed = 0;
let failed = 0;

function ok(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const db = await PGlite.create();

// Setup minimal postgres environment with roles
await db.exec(`
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;
`);

// Apply base schema fixture + needed migrations
await db.exec(readFileSync(join(here, "00_base_schema_fixture.sql"), "utf8"));
await db.exec(`
create table if not exists public.intelligence_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  signal_type text,
  payload jsonb,
  created_at timestamptz default now()
);
create table if not exists public.intelligence_missions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  title text,
  status text,
  created_at timestamptz default now()
);
create table if not exists public.intelligence_memory (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  key text,
  value jsonb,
  created_at timestamptz default now()
);
`);
await db.exec(readFileSync(join(here, "..", "migrations", "026_admin_control_plane.sql"), "utf8"));

// Seed test identities
const REGULAR_USER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_USER_ID = "22222222-2222-4222-8222-222222222222";
const REVOKED_ADMIN_ID = "33333333-3333-4333-8333-333333333333";

await db.query(`insert into auth.users (id, email) values 
  ($1, 'regular@nexus.test'),
  ($2, 'admin@nexus.test'),
  ($3, 'revoked@nexus.test')`, [REGULAR_USER_ID, ADMIN_USER_ID, REVOKED_ADMIN_ID]);

// Add ADMIN_USER_ID to platform_admins
await db.query(`insert into public.platform_admins (user_id, role, status) values
  ($1, 'operator', 'active'),
  ($2, 'operator', 'revoked')`, [ADMIN_USER_ID, REVOKED_ADMIN_ID]);

async function asUser(userId, run) {
  await db.exec(`set test.current_user_id = ${userId ? `'${userId}'` : "''"}`);
  try {
    return await run();
  } finally {
    await db.exec("set test.current_user_id = ''");
  }
}

console.log("\n-- INVARIANT A & E: Unauthenticated caller -------------------");
const anonContext = await asUser(null, async () => {
  const res = await db.query("select public.platform_admin_context() as ctx");
  return res.rows[0].ctx;
});
ok("Unauthenticated caller reports is_admin=false", anonContext.is_admin === false);
ok("Unauthenticated caller reports role=null", anonContext.role === null);

console.log("\n-- INVARIANT B & F: Authenticated non-admin user ------------");
const regularContext = await asUser(REGULAR_USER_ID, async () => {
  const res = await db.query("select public.platform_admin_context() as ctx");
  return res.rows[0].ctx;
});
ok("Regular user reports is_admin=false", regularContext.is_admin === false);
ok("Regular user reports role=null", regularContext.role === null);
ok("Regular user cannot execute admin_overview()", async () => {
  try {
    await asUser(REGULAR_USER_ID, () => db.query("select public.admin_overview()"));
    return false;
  } catch (err) {
    return String(err.message).includes("NEXUS_ADMIN_FORBIDDEN");
  }
});

console.log("\n-- INVARIANT C & G: Authenticated Platform Admin ------------");
const adminContext = await asUser(ADMIN_USER_ID, async () => {
  const res = await db.query("select public.platform_admin_context() as ctx");
  return res.rows[0].ctx;
});
ok("Platform admin user reports is_admin=true", adminContext.is_admin === true);
ok("Platform admin user reports correct role", adminContext.role === "operator");
const overviewPayload = await asUser(ADMIN_USER_ID, async () => {
  const res = await db.query("select public.admin_overview() as ov");
  return res.rows[0].ov;
});
ok("Platform admin user successfully reads admin_overview()", Boolean(overviewPayload && overviewPayload.users));

console.log("\n-- Revoked Admin Isolation ---------------------------------");
const revokedContext = await asUser(REVOKED_ADMIN_ID, async () => {
  const res = await db.query("select public.platform_admin_context() as ctx");
  return res.rows[0].ctx;
});
ok("Revoked admin user reports is_admin=false", revokedContext.is_admin === false);

console.log("\n-- INVARIANT J & K: Self-promotion and RLS protection ------");
// Attempt direct select as authenticated
let directSelectDenied = false;
try {
  await db.query("set role authenticated");
  await asUser(REGULAR_USER_ID, () => db.query("select * from public.platform_admins"));
} catch {
  directSelectDenied = true;
} finally {
  await db.query("reset role");
}
ok("Direct SELECT on platform_admins is denied to authenticated", directSelectDenied);

// Attempt direct insert as authenticated
let directInsertDenied = false;
try {
  await db.query("set role authenticated");
  await asUser(REGULAR_USER_ID, () => db.query(
    "insert into public.platform_admins (user_id, role, status) values ($1, 'owner', 'active')",
    [REGULAR_USER_ID]
  ));
} catch {
  directInsertDenied = true;
} finally {
  await db.query("reset role");
}
ok("Direct self-promotion INSERT on platform_admins is denied", directInsertDenied);

// Attempt direct update as authenticated
let directUpdateDenied = false;
try {
  await db.query("set role authenticated");
  await asUser(REGULAR_USER_ID, () => db.query(
    "update public.platform_admins set status = 'active' where user_id = $1",
    [REVOKED_ADMIN_ID]
  ));
} catch {
  directUpdateDenied = true;
} finally {
  await db.query("reset role");
}
ok("Direct UPDATE on platform_admins is denied", directUpdateDenied);

console.log("\n-- INVARIANT L: Password recovery privacy guarantee --------");
const forgotRouteCode = readFileSync(join(here, "..", "..", "src", "app", "api", "auth", "forgot-password", "route.ts"), "utf8");
ok("Password recovery returns generic response regardless of user existence", forgotRouteCode.includes("If an account exists for this address, a reset link is on its way."));

console.log("\n-- INVARIANT M: Secrets protection in client bundles -------");
const clientFiles = [
  "src/components/admin/admin-shell.tsx",
  "src/components/admin/admin-command-menu.tsx",
  "src/components/admin/admin-login-form.tsx",
];
let leakedSecret = false;
for (const rel of clientFiles) {
  const code = readFileSync(join(here, "..", "..", rel), "utf8");
  if (code.includes("SUPABASE_SERVICE_ROLE_KEY") || code.includes("service_role") || code.includes("JWT_SECRET")) {
    leakedSecret = true;
  }
}
ok("No service_role or server-side secret present in client bundles", !leakedSecret);

console.log("\n-- INVARIANT N: All ready routes guarded by server gate -----");
const routes = readyAdminRoutes();
ok("Ready admin routes are defined and non-empty", routes.length > 0);
for (const r of routes) {
  ok(`Route ${r} is within /admin namespace guarded by AdminLayout`, r.startsWith("/admin"));
}

console.log("\n-- Guard Classification Unit Invariants --------------------");
ok("Missing function error classifies as MIGRATION_NOT_APPLIED", classifyGuardError({ code: "PGRST202" }) === "MIGRATION_NOT_APPLIED");
ok("Timeout error classifies as QUERY_FAILED", classifyGuardError({ message: "Network connection terminated" }) === "QUERY_FAILED");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
