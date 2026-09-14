/**
 * ============================================================
 * NEXUS ADMIN — CONTROL PLANE TESTS (MIGRATION 026)
 * ============================================================
 * Runs the real migrations against a real PostgreSQL engine (PGlite) and
 * asserts the properties the admin surface depends on.
 *
 * What this suite proves, in the order the brief lists them:
 *
 *   ADMIN-01  a standard user is refused
 *   ADMIN-02  a platform admin is allowed
 *   ADMIN-03  the protection lives in the database, not in the app:
 *               - the admin tables are unreadable directly (RLS, no
 *                 policies, grants revoked)
 *               - a revoked admin loses access immediately
 *               - the role ladder is enforced below the data functions
 *   ADMIN-04  the overview aggregate reports what is actually in the
 *             tables — and nothing else
 *   ADMIN-08  the audit log is append-only at the storage engine level,
 *             and refused access is recorded
 *   ADMIN-12  no fabricated business metrics: the monetary fields the
 *             overview returns are NULL, not invented numbers
 *
 * Nothing here mocks NEXUS logic. Only the database engine is
 * substituted, exactly as in the other PGlite suites in this folder.
 *
 * Run:  node supabase/tests/admin-control-plane.test.mjs
 * ============================================================
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  console.log(`  PASS  ${name}`);
}

function ko(name, detail) {
  failed += 1;
  console.log(`  FAIL  ${name}\n        ${detail}`);
}

function assert(name, condition, detail = "") {
  if (condition) ok(name);
  else ko(name, detail);
}

async function expectError(name, run, needle) {
  try {
    await run();
    ko(name, `expected an error containing "${needle}", statement succeeded`);
  } catch (error) {
    assert(
      name,
      String(error.message).includes(needle),
      `got: ${String(error.message).split("\n")[0]}`
    );
  }
}

// The three identities used throughout: one customer, one operator, one
// viewer. Their uuids never change, so the assertions stay readable.
const CUSTOMER = "22222222-2222-2222-2222-222222222222";
const OPERATOR = "33333333-3333-3333-3333-333333333333";
const VIEWER = "44444444-4444-4444-4444-444444444444";

const db = await PGlite.create();

// ---- platform roles --------------------------------------------------
// A provisioned Supabase project has anon / authenticated / service_role.
// Creating them here means the guarded revoke/grant blocks in 026 execute
// for real instead of being skipped.
await db.exec(`
  do $do$
  declare r text;
  begin
    foreach r in array array['authenticated','anon','service_role'] loop
      if not exists (select 1 from pg_roles where rolname = r) then
        execute format('create role %I nologin', r);
      end if;
    end loop;
  end $do$;
`);

// ---- schema + migrations ---------------------------------------------
await db.exec(readFileSync(join(here, "00_base_schema_fixture.sql"), "utf8"));

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql") && !file.startsWith("001_"))
  .sort();

let adminMigrationApplied = false;
for (const file of migrations) {
  try {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    if (file.startsWith("026_")) adminMigrationApplied = true;
  } catch (error) {
    ko(`migration applied: ${file}`, String(error.message).split("\n")[0]);
  }
}
assert("migration 026_admin_control_plane.sql applies cleanly", adminMigrationApplied);

// ---- seed ------------------------------------------------------------
// Inserting into auth.users fires the real bootstrap trigger, which
// creates each account's personal workspace. Workspaces are therefore
// never inserted by hand: the seed has to look like production.
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  values ('11111111-1111-1111-1111-111111111111','owner@nexus.test','{}', now());
`);
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data)
  values ('${CUSTOMER}','customer@nexus.test','{}');
`);
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data)
  values ('${OPERATOR}','operator@nexus.test','{}');
`);
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data)
  values ('${VIEWER}','viewer@nexus.test','{}');
`);

const ownerWorkspace = await db.query(
  `select id from public.workspaces
   where owner_id = '11111111-1111-1111-1111-111111111111' limit 1`
);
const wsId = ownerWorkspace.rows[0].id;

await db.exec(`
  insert into public.tasks (workspace_id, title, status) values
    ('${wsId}','alpha','todo'),
    ('${wsId}','beta','blocked'),
    ('${wsId}','gamma','done');
  insert into public.projects (workspace_id, name) values ('${wsId}','Project one');
  insert into public.goals (workspace_id, title) values ('${wsId}','Goal one');
`);

async function asUser(userId) {
  await db.exec(`set test.current_user_id = ${userId ? `'${userId}'` : "''"}`);
}

async function asRole(role) {
  await db.exec(role ? `set role ${role}` : "reset role");
}

const adminRows = await db.query(
  `select count(*)::int as n from public.platform_admins`
);
assert(
  "platform_admins starts empty — nobody is an admin by default",
  adminRows.rows[0].n === 0,
  `rows: ${adminRows.rows[0].n}`
);

// ============================================================
console.log("\n-- ADMIN-01: a standard user is refused ------------------");
// ============================================================
await asUser(CUSTOMER);

const customerContext = await db.query(`select public.platform_admin_context() as c`);
assert(
  "platform_admin_context() reports is_admin=false for a customer",
  customerContext.rows[0].c.is_admin === false,
  JSON.stringify(customerContext.rows[0].c)
);
assert(
  "…and returns no role",
  customerContext.rows[0].c.role === null,
  JSON.stringify(customerContext.rows[0].c)
);

await expectError(
  "admin_overview() refuses a customer with NEXUS_ADMIN_FORBIDDEN",
  () => db.query(`select public.admin_overview()`),
  "NEXUS_ADMIN_FORBIDDEN"
);

await expectError(
  "admin_recent_activity() refuses a customer",
  () => db.query(`select public.admin_recent_activity(5)`),
  "NEXUS_ADMIN_FORBIDDEN"
);

await expectError(
  "admin_audit_record() refuses a customer",
  () =>
    db.query(
      `select public.admin_audit_record('admin.test','success',null,null,'{}'::jsonb,null,null)`
    ),
  "NEXUS_ADMIN_FORBIDDEN"
);

// ============================================================
console.log("\n-- ADMIN-03: the gate is the database, not the app -------");
// ============================================================

// 1. Direct table access. RLS is enabled with no policies, so a query as
//    `authenticated` must see zero rows even though rows exist.
await db.exec(
  `insert into public.platform_admins (user_id, role) values ('${OPERATOR}','operator');`
);

// Two independent locks, and the test asserts both:
//   * table privileges are revoked, so the query never reaches RLS;
//   * RLS is enabled with no policies, so even a role that somehow held
//     privileges would still see zero rows.
await asRole("authenticated");
await expectError(
  "platform_admins is unreadable directly as authenticated (no table grant)",
  () => db.query(`select count(*)::int as n from public.platform_admins`),
  "permission denied"
);
await expectError(
  "admin_audit_log is unreadable directly as authenticated (no table grant)",
  () => db.query(`select count(*)::int as n from public.admin_audit_log`),
  "permission denied"
);
await expectError(
  "a customer cannot grant themselves admin (insert denied)",
  () =>
    db.query(
      `insert into public.platform_admins (user_id, role) values ('${CUSTOMER}','owner')`
    ),
  "permission denied"
);

const rlsEnabled = await db.query(`
  select c.relname, c.relrowsecurity,
         (select count(*) from pg_policies p
           where p.schemaname = 'public' and p.tablename = c.relname)::int as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('platform_admins','admin_audit_log')
  order by 1
`);
assert(
  "both admin tables have RLS enabled and zero policies (deny by default)",
  rlsEnabled.rows.length === 2 &&
    rlsEnabled.rows.every((r) => r.relrowsecurity === true && r.policies === 0),
  JSON.stringify(rlsEnabled.rows)
);

const grantedFunctions = await db.query(`
  select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'platform_admin_context','admin_overview','admin_recent_activity',
      'admin_audit_record','admin_audit_record_denied',
      'platform_admin_is_admin','admin_assert_access','admin_safe_count'
    )
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  order by 1
`);
const granted = grantedFunctions.rows.map((r) => r.proname);
assert(
  "only the four intended functions are executable by authenticated",
  JSON.stringify(granted) ===
    JSON.stringify([
      "admin_audit_record",
      "admin_audit_record_denied",
      "admin_overview",
      "admin_recent_activity",
      "platform_admin_context",
    ]),
  `granted: ${JSON.stringify(granted)}`
);
await asRole(null);

// 2. A revoked admin loses access immediately — the check reads status.
await db.exec(
  `insert into public.platform_admins (user_id, role) values ('${VIEWER}','viewer');`
);
await asUser(VIEWER);
const viewerBefore = await db.query(`select public.platform_admin_context() as c`);
assert(
  "a viewer is recognised as an admin before revocation",
  viewerBefore.rows[0].c.is_admin === true && viewerBefore.rows[0].c.role === "viewer",
  JSON.stringify(viewerBefore.rows[0].c)
);
await asUser(null);
await db.exec(
  `update public.platform_admins set status = 'revoked' where user_id = '${VIEWER}';`
);
await asUser(VIEWER);
await expectError(
  "a revoked admin is refused by admin_overview()",
  () => db.query(`select public.admin_overview()`),
  "NEXUS_ADMIN_FORBIDDEN"
);
await asUser(null);
await db.exec(
  `update public.platform_admins set status = 'active' where user_id = '${VIEWER}';`
);

// 3. The role ladder. admin_assert_access() is owner-only, so it is called
//    here the way the definer functions call it.
await asUser(VIEWER);
await expectError(
  "a viewer cannot perform an owner-level operation",
  () => db.query(`select public.admin_assert_access('owner')`),
  "NEXUS_ADMIN_INSUFFICIENT_ROLE"
);
// admin_assert_access() returns void; a void result is not SQL NULL, so
// success is "it did not raise" rather than a value to compare.
async function expectPasses(name, sql) {
  try {
    await db.query(sql);
    ok(name);
  } catch (error) {
    ko(name, `unexpected error: ${String(error.message).split("\n")[0]}`);
  }
}

await expectPasses(
  "a viewer passes a viewer-level assertion",
  `select public.admin_assert_access('viewer')`
);

await asUser(OPERATOR);
await expectPasses(
  "an operator passes an operator-level assertion",
  `select public.admin_assert_access('operator')`
);
await expectError(
  "an operator cannot perform an owner-level operation",
  () => db.query(`select public.admin_assert_access('owner')`),
  "NEXUS_ADMIN_INSUFFICIENT_ROLE"
);

// ============================================================
console.log("\n-- ADMIN-02: a platform admin is allowed -----------------");
// ============================================================
const operatorContext = await db.query(`select public.platform_admin_context() as c`);
assert(
  "platform_admin_context() reports the operator's role",
  operatorContext.rows[0].c.is_admin === true &&
    operatorContext.rows[0].c.role === "operator",
  JSON.stringify(operatorContext.rows[0].c)
);

const overviewResult = await db.query(`select public.admin_overview() as o`);
const overview = overviewResult.rows[0].o;
assert("admin_overview() returns a payload to an admin", Boolean(overview));

// ============================================================
console.log("\n-- ADMIN-04: the aggregate reports what is really there --");
// ============================================================
const userCount = await db.query(`select count(*)::int as n from auth.users`);
assert(
  "users.total equals the real auth.users count",
  overview.users.total === userCount.rows[0].n,
  `overview: ${overview.users.total}, table: ${userCount.rows[0].n}`
);

assert(
  "users.email_confirmed counts only confirmed accounts",
  overview.users.email_confirmed === 1,
  `got: ${overview.users.email_confirmed}`
);

const wsCount = await db.query(`select count(*)::int as n from public.workspaces`);
assert(
  "workspaces.total equals the real workspaces count",
  overview.workspaces.total === wsCount.rows[0].n,
  `overview: ${overview.workspaces.total}, table: ${wsCount.rows[0].n}`
);

assert(
  "usage.tasks / tasks_blocked / tasks_done match the seeded rows",
  overview.usage.tasks === 3 &&
    overview.usage.tasks_blocked === 1 &&
    overview.usage.tasks_done === 1,
  JSON.stringify(overview.usage)
);

assert(
  "usage.projects and usage.goals match the seeded rows",
  overview.usage.projects === 1 && overview.usage.goals === 1,
  JSON.stringify(overview.usage)
);

assert(
  "workspaces.without_active_owner is 0 when every workspace has an owner",
  overview.workspaces.without_active_owner === 0,
  `got: ${overview.workspaces.without_active_owner}`
);

// A broken workspace must actually surface — this is the condition the
// "Needs Attention" panel exists for. The plan-limit trigger forbids
// handing the owner a second workspace, so the customer's own workspace
// is orphaned instead: same condition, no schema fighting.
const customerWs = await db.query(
  `select workspace_id from public.workspace_members
   where user_id = '${CUSTOMER}' and role = 'owner' limit 1`
);
assert("the customer has an owner membership to orphan", customerWs.rows.length === 1);

await db.exec(
  `update public.workspace_members set status = 'suspended'
   where workspace_id = '${customerWs.rows[0].workspace_id}';`
);
const afterOrphan = await db.query(`select public.admin_overview() as o`);
assert(
  "a workspace with no active owner appears in needs_attention",
  afterOrphan.rows[0].o.needs_attention.some(
    (item) => item.id === "workspaces_without_owner" && item.count === 1
  ),
  JSON.stringify(afterOrphan.rows[0].o.needs_attention)
);
assert(
  "…and the count feeds workspaces.without_active_owner too",
  afterOrphan.rows[0].o.workspaces.without_active_owner === 1,
  `got: ${afterOrphan.rows[0].o.workspaces.without_active_owner}`
);
await db.exec(
  `update public.workspace_members set status = 'active'
   where workspace_id = '${customerWs.rows[0].workspace_id}';`
);

// ============================================================
console.log("\n-- ADMIN-12: no fabricated business metrics --------------");
// ============================================================
assert(
  "plans.mrr is NULL — no payment provider, no invented revenue",
  overview.plans.mrr === null,
  `mrr: ${JSON.stringify(overview.plans.mrr)}`
);
assert("plans.currency is NULL", overview.plans.currency === null);
assert("plans.provider is NULL", overview.plans.provider === null);
assert(
  "the payload contains no uptime percentage field to fake",
  !("uptime" in overview) && !("uptime_pct" in overview),
  Object.keys(overview).join(",")
);

// A NULL and a 0 must stay distinguishable all the way to the UI.
const nullProbe = await db.query(`select public.admin_safe_count('public.does_not_exist') as n`);
assert(
  "admin_safe_count() returns NULL (not 0) for a missing table",
  nullProbe.rows[0].n === null,
  `got: ${JSON.stringify(nullProbe.rows[0].n)}`
);

// ============================================================
console.log("\n-- ADMIN-08: the audit log is append-only ----------------");
// ============================================================
const auditId = await db.query(
  `select public.admin_audit_record(
     'admin.overview.viewed','success','platform',null,
     '{"screen":"overview"}'::jsonb,'203.0.113.9','nexus-test') as id`
);
assert("admin_audit_record() writes a row and returns its id", Boolean(auditId.rows[0].id));

const auditRow = await db.query(
  // host() strips the /32 that inet appends for a bare IPv4 address.
  `select actor_id, actor_email, actor_role, action, outcome, host(ip_address) as ip
   from public.admin_audit_log where id = '${auditId.rows[0].id}'`
);
assert(
  "the audit row attributes the action to the caller from the JWT",
  auditRow.rows[0].actor_id === OPERATOR &&
    auditRow.rows[0].actor_email === "operator@nexus.test" &&
    auditRow.rows[0].actor_role === "operator" &&
    auditRow.rows[0].action === "admin.overview.viewed" &&
    auditRow.rows[0].outcome === "success" &&
    auditRow.rows[0].ip === "203.0.113.9",
  JSON.stringify(auditRow.rows[0])
);

await expectError(
  "UPDATE on admin_audit_log is rejected",
  () => db.exec(`update public.admin_audit_log set action = 'tampered'`),
  "NEXUS_ADMIN_AUDIT_IMMUTABLE"
);
await expectError(
  "DELETE on admin_audit_log is rejected",
  () => db.exec(`delete from public.admin_audit_log`),
  "NEXUS_ADMIN_AUDIT_IMMUTABLE"
);
await expectError(
  "TRUNCATE on admin_audit_log is rejected",
  () => db.exec(`truncate public.admin_audit_log`),
  "NEXUS_ADMIN_AUDIT_IMMUTABLE"
);

const stillThere = await db.query(
  `select count(*)::int as n from public.admin_audit_log where action = 'admin.overview.viewed'`
);
assert(
  "the audit row survived every tampering attempt",
  stillThere.rows[0].n === 1,
  `rows: ${stillThere.rows[0].n}`
);

// Refused access is recorded, and only once per actor per 5 minutes.
await asUser(CUSTOMER);
const deniedId = await db.query(
  `select public.admin_audit_record_denied('NOT_A_PLATFORM_ADMIN','/admin','198.51.100.7','nexus-test') as id`
);
assert("a refused customer attempt is recorded", Boolean(deniedId.rows[0].id));

const deniedRow = await db.query(
  `select actor_id, action, outcome, metadata from public.admin_audit_log
   where id = '${deniedId.rows[0].id}'`
);
assert(
  "the refusal row is attributed, action-fixed and outcome-fixed",
  deniedRow.rows[0].actor_id === CUSTOMER &&
    deniedRow.rows[0].action === "admin.access.denied" &&
    deniedRow.rows[0].outcome === "denied" &&
    deniedRow.rows[0].metadata.path === "/admin",
  JSON.stringify(deniedRow.rows[0])
);

const deniedAgain = await db.query(
  `select public.admin_audit_record_denied('NOT_A_PLATFORM_ADMIN','/admin',null,null) as id`
);
assert(
  "the flood guard keeps one refusal per actor per 5 minutes",
  deniedAgain.rows[0].id === null,
  `got: ${JSON.stringify(deniedAgain.rows[0].id)}`
);

const operatorDenied = await db.query(
  `select public.admin_audit_record_denied('SHOULD_NOT_WRITE','/admin',null,null) as id`
);
await asUser(OPERATOR);
const operatorDenied2 = await db.query(
  `select public.admin_audit_record_denied('SHOULD_NOT_WRITE','/admin',null,null) as id`
);
assert(
  "an admin produces no misleading 'denied' row",
  operatorDenied2.rows[0].id === null,
  `got: ${JSON.stringify(operatorDenied2.rows[0].id)}`
);
assert(
  "…and the earlier non-admin call for the operator wrote nothing either",
  operatorDenied.rows[0].id === null,
  `got: ${JSON.stringify(operatorDenied.rows[0].id)}`
);

// Anonymous: the function returns NULL rather than raising, because there
// is no attributable actor. What matters is that no row appears.
await asUser(null);
const beforeAnon = await db.query(`select count(*)::int as n from public.admin_audit_log`);
const anonResult = await db.query(
  `select public.admin_audit_record_denied('x','/admin',null,null) as id`
);
const afterAnon = await db.query(`select count(*)::int as n from public.admin_audit_log`);
assert(
  "an anonymous caller writes nothing to the audit log",
  anonResult.rows[0].id === null &&
    afterAnon.rows[0].n === beforeAnon.rows[0].n,
  `id: ${JSON.stringify(anonResult.rows[0].id)}, rows ${beforeAnon.rows[0].n} -> ${afterAnon.rows[0].n}`
);

// ---- summary ---------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
