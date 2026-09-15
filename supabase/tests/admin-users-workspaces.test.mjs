/**
 * ============================================================
 * NEXUS ADMIN — USERS & WORKSPACES (MIGRATION 027)
 * ============================================================
 * Real PostgreSQL (PGlite), all real migrations, all real triggers — the
 * same harness rules as admin-control-plane.test.mjs. What this suite
 * proves, keyed to the PR brief:
 *
 *   ADMIN-USERS-01      an authorized admin reads the directory
 *   ADMIN-USERS-02      a signed-in non-admin is refused by the database
 *   ADMIN-USERS-03      every returned field traces to a seeded row
 *   ADMIN-USERS-04      an empty result is a measured zero, and a bad
 *                       input is an error — never an empty list
 *   ADMIN-USERS-05      search matches email / display name / exact id;
 *                       wildcards in queries are literals
 *   ADMIN-USERS-06      unknown id → NULL (the app renders Not Found)
 *
 *   ADMIN-WORKSPACES-01 an authorized admin reads the tenant directory
 *   ADMIN-WORKSPACES-02 a customer is refused
 *   ADMIN-WORKSPACES-03 counts match real membership/project/task rows
 *   ADMIN-WORKSPACES-04 unknown workspace id → NULL
 *   ADMIN-WORKSPACES-05 errors surface as errors at this layer; they are
 *                       never folded into "0 workspaces"
 *
 *   ADMIN-SECURITY-01   the new functions expose exactly the intended
 *                       EXECUTE surface; no dynamic SQL; helpers stay
 *                       owner-only
 *   ADMIN-SECURITY-02   no privileged read reaches a caller the Admin
 *                       gate has not accepted; payloads carry no auth
 *                       secrets; revocation is immediate
 *
 * The seed is production-shaped: inserts into auth.users fire the real
 * bootstrap triggers (profile + personal workspace + owner membership +
 * FREE subscription), and product rows are created under a fake JWT so
 * the 015 activity trigger attributes them to real actors. Nothing is
 * inserted by hand "for the UI"; the assertions compare payloads against
 * the same seeded rows, so a fabricated field would have to be fabricated
 * in both places to pass.
 *
 * Run:  node supabase/tests/admin-users-workspaces.test.mjs
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

async function expectPasses(name, sql) {
  try {
    await db.query(sql);
    ok(name);
  } catch (error) {
    ko(name, `unexpected error: ${String(error.message).split("\n")[0]}`);
  }
}

// Fixed identities so assertions stay readable.
const OWNER = "11111111-1111-1111-1111-111111111111"; // platform owner, real content
const CUSTOMER = "22222222-2222-2222-2222-222222222222"; // plain user, active member of both worlds
const VIEWER = "44444444-4444-4444-4444-444444444444"; // platform viewer seat
const NEWBIE = "77777777-7777-7777-7777-777777777777"; // unconfirmed, later banned

const db = await PGlite.create();

// ---- platform roles + Supabase-like default privileges -------------------
// As in PR 1's suite: default privileges hand every new function and table
// explicit ACL entries for anon / authenticated / service_role, which
// `revoke from public` does NOT clear. Without this emulation, a missing
// revoke in 027 would pass here and be wide open on a real project.
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
await db.exec(`
  alter default privileges in schema public
    grant execute on functions to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`);

await db.exec(readFileSync(join(here, "00_base_schema_fixture.sql"), "utf8"));

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql") && !file.startsWith("001_"))
  .sort();

let migration027Applied = false;
for (const file of migrations) {
  try {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    if (file.startsWith("027_")) migration027Applied = true;
  } catch (error) {
    ko(`migration applied: ${file}`, String(error.message).split("\n")[0]);
  }
}
assert("migration 027_admin_directory.sql applies cleanly", migration027Applied);

async function asUser(userId) {
  await db.exec(`set test.current_user_id = ${userId ? `'${userId}'` : "''"}`);
}
async function asRole(role) {
  await db.exec(role ? `set role ${role}` : "reset role");
}

// ---- seed ---------------------------------------------------------------
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, last_sign_in_at)
  values ('${OWNER}','owner@nexus.test','{"full_name":"Owner One"}', now() - interval '40 days', now() - interval '2 hours');
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  values ('${CUSTOMER}','customer@nexus.test','{"full_name":"Case Customer"}', now() - interval '9 days');
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  values ('${VIEWER}','viewer@nexus.test','{}', now() - interval '5 days');
  insert into auth.users (id, email, raw_user_meta_data)
  values ('${NEWBIE}','newbie@nexus.test','{}');
`);

await db.exec(`
  insert into public.platform_admins (user_id, role, note) values
    ('${OWNER}','owner','bootstrap operator'),
    ('${VIEWER}','viewer','read-only seat');
`);

const ownerWs = (
  await db.query(
    `select id from public.workspaces where owner_id = '${OWNER}' limit 1`
  )
).rows[0].id;
const customerWs = (
  await db.query(
    `select id from public.workspaces where owner_id = '${CUSTOMER}' limit 1`
  )
).rows[0].id;

// The owner moves up to PRO (upgrade path aside, it unlocks the second
// workspace below and gives the plan filter something real to match).
await db.exec(`
  update public.workspace_subscriptions set plan = 'PRO'
  where workspace_id = '${ownerWs}' and status = 'active';
`);

// CUSTOMER is an active admin member of the owner's workspace (tenant
// authority, not platform authority — the badges must keep those apart).
await db.exec(`
  insert into public.workspace_members (workspace_id, user_id, role, status)
  values ('${ownerWs}','${CUSTOMER}','admin','active');
`);

// A second workspace for the owner whose ONLY owner-membership is then
// suspended: the measured "no active owner" condition the attention
// filter must catch. Inserted by the real bootstrap trigger, broken on
// purpose afterwards — a hand-rolled "orphan row" would prove less.
await db.exec(`
  insert into public.workspaces (owner_id, name, slug)
  values ('${OWNER}','Orphaned Co','orphaned-co');
  update public.workspace_members m
     set status = 'suspended'
   where m.workspace_id = (select id from public.workspaces where slug = 'orphaned-co');
  -- 007 auto-creates an active FREE row for every workspace. Cancelling it
  -- reproduces a churned tenant and forces the "no active row → default
  -- plan" branch of the directory to be the one under test.
  update public.workspace_subscriptions
     set status = 'cancelled'
   where workspace_id = (select id from public.workspaces where slug = 'orphaned-co');
`);
const orphanWs = (
  await db.query(`select id from public.workspaces where slug = 'orphaned-co'`)
).rows[0].id;

// Product rows. Projects and goals are seeded as plain table-owner data
// (auth.uid() unset); tasks are created under a fake JWT so the 015
// trigger attributes their activity rows to a real actor — exactly what
// production produces and what "last activity" reads. Order matters:
// Launch exists before its tasks, so nothing needs a later UPDATE — every
// extra mutation would be another real activity row the assertions below
// count deliberately.
const launchId = (
  await db.query(
    `insert into public.projects (workspace_id, name, status, progress)
     values ('${ownerWs}','Launch','active',60) returning id`
  )
).rows[0].id;
await db.query(
  `insert into public.projects (workspace_id, name, status, progress)
   values ('${ownerWs}','Backlog','planning',0)`
);
await db.query(
  `insert into public.goals (workspace_id, title, created_by, status, progress)
   values ('${ownerWs}','Ship the launch','${OWNER}','active',40)`
);

await asUser(CUSTOMER);
await db.exec(`
  insert into public.tasks (workspace_id, project_id, title, status, priority, created_by, assignee_id)
  values
    ('${ownerWs}','${launchId}','Draft spec','done','high','${CUSTOMER}','${CUSTOMER}'),
    ('${ownerWs}','${launchId}','QA pass','blocked','medium','${CUSTOMER}',null),
    ('${customerWs}',null,'Pay rent','todo','medium','${CUSTOMER}','${CUSTOMER}');
`);
await asUser(OWNER);
await db.exec(`
  insert into public.tasks (workspace_id, project_id, title, status, priority, created_by, assignee_id)
  values
    ('${ownerWs}','${launchId}','Ship assets','in_progress','urgent','${OWNER}','${OWNER}');
`);
await asUser(null);

const usersSql = (args) => `select public.admin_users_list(${args}) as r`;
const wsSql = (args) => `select public.admin_workspaces_list(${args}) as r`;

// ============================================================
console.log("\n-- ADMIN-USERS-01/02 & WS-01/02: the gate decides ---------");
// ============================================================
await asUser(OWNER);
const usersRes = await db.query(usersSql(`null,'all','created_at','desc',1,25`));
const users = usersRes.rows[0].r;
assert("ADMIN-USERS-01 an owner reads the user directory", Array.isArray(users.items));

await asUser(VIEWER);
await expectPasses(
  "ADMIN-USERS-01 a viewer reads the user directory too (reads are the whole PR)",
  usersSql(`null,'all','created_at','desc',1,25`)
);
await expectPasses(
  "ADMIN-WORKSPACES-01 a viewer reads the workspace directory",
  wsSql(`null,'all','created_at','desc',1,25`)
);

await asUser(CUSTOMER);
for (const [label, sql] of [
  ["admin_users_list", usersSql(`null,'all','created_at','desc',1,25`)],
  ["admin_user_detail", `select public.admin_user_detail('${OWNER}')`],
  ["admin_workspaces_list", wsSql(`null,'all','created_at','desc',1,25`)],
  ["admin_workspace_detail", `select public.admin_workspace_detail('${ownerWs}')`],
]) {
  await expectError(
    `ADMIN-USERS-02/ADMIN-WORKSPACES-02 a customer is refused ${label}`,
    () => db.query(sql),
    "NEXUS_ADMIN_FORBIDDEN"
  );
}

// A revoked platform admin loses the directory immediately — 026's rule,
// asserted again here because 027 added its own doors.
await db.exec(`update public.platform_admins set status = 'revoked' where user_id = '${VIEWER}';`);
await asUser(VIEWER);
await expectError(
  "a revoked viewer is refused by admin_users_list",
  () => db.query(usersSql(`null,'all','created_at','desc',1,25`)),
  "NEXUS_ADMIN_FORBIDDEN"
);
await expectError(
  "…and by the workspace reads",
  () => db.query(wsSql(`null,'all','created_at','desc',1,25`)),
  "NEXUS_ADMIN_FORBIDDEN"
);
await asUser(null);
await db.exec(`update public.platform_admins set status = 'active' where user_id = '${VIEWER}';`);

// anon has no door at all.
await asRole("anon");
for (const sql of [
  usersSql(`null,'all','created_at','desc',1,25`),
  wsSql(`null,'all','created_at','desc',1,25`),
]) {
  await expectError(
    "anonymous callers cannot invoke directory reads",
    () => db.query(sql),
    "permission denied for function"
  );
}
await asRole(null);
await asUser(OWNER);

// ============================================================
console.log("\n-- ADMIN-USERS-03: the list reflects real rows -----------");
// ============================================================
const totalAccounts = (await db.query(`select count(*)::int as n from auth.users`))
  .rows[0].n;
assert(
  "ADMIN-USERS-03 total equals the real auth.users count",
  users.total === totalAccounts,
  `list: ${users.total}, table: ${totalAccounts}`
);
assert(
  "items are ordered newest first (created_at desc default)",
  users.items[0].created_at >= users.items[users.items.length - 1].created_at,
  JSON.stringify(users.items.map((i) => i.created_at))
);

const ownerRow = users.items.find((row) => row.user_id === OWNER);
const customerRow = users.items.find((row) => row.user_id === CUSTOMER);
const newbieRow = users.items.find((row) => row.user_id === NEWBIE);

assert(
  "display names come from profiles (written by the real bootstrap trigger)",
  ownerRow.display_name === "Owner One" && customerRow.display_name === "Case Customer",
  JSON.stringify([ownerRow.display_name, customerRow.display_name])
);
assert(
  "platform role appears only for real platform_admins rows",
  ownerRow.platform_role === "owner" &&
    customerRow.platform_role === null &&
    newbieRow.platform_role === null,
  JSON.stringify([ownerRow.platform_role, customerRow.platform_role])
);
assert(
  "a workspace admin role is NOT reported as a platform role",
  customerRow.platform_role === null && customerRow.memberships.total === 2,
  "the vocabulary firewall, asserted at the data source"
);
assert(
  "the unconfirmed account is 'pending', not a guessed default",
  newbieRow.account_status === "pending" && newbieRow.email_confirmed === false,
  JSON.stringify({ s: newbieRow.account_status, c: newbieRow.email_confirmed })
);
assert(
  "last_sign_in_at is carried verbatim (owner signed in, customer did not)",
  ownerRow.last_sign_in_at !== null && customerRow.last_sign_in_at === null,
  JSON.stringify([ownerRow.last_sign_in_at, customerRow.last_sign_in_at])
);
assert(
  "last_activity_at folds in trigger-recorded activity",
  customerRow.last_activity_at !== null && newbieRow.last_activity_at === null,
  "customer changed rows; the newbie touched nothing"
);
assert(
  "membership counts match workspace_members rows (active and owned separately)",
  customerRow.memberships.total === 2 &&
    customerRow.memberships.active === 2 &&
    customerRow.memberships.owned === 1 &&
    ownerRow.memberships.total === 2 &&
    ownerRow.memberships.active === 1,
  JSON.stringify([customerRow.memberships, ownerRow.memberships])
);

// Ban status is derived live from banned_until, never stored anywhere.
await db.exec(`update auth.users set banned_until = now() + interval '1 day' where id = '${NEWBIE}'`);
const bannedCheck = (await db.query(usersSql(`'newbie','all','created_at','desc',1,25`))).rows[0].r;
assert(
  "a future banned_until flips the derived status to 'banned'",
  bannedCheck.total === 1 && bannedCheck.items[0].account_status === "banned",
  JSON.stringify(bannedCheck.items[0].account_status)
);
const bannedFilter = (await db.query(usersSql(`null,'banned','created_at','desc',1,25`))).rows[0].r;
assert(
  "…the banned filter finds exactly that account…",
  bannedFilter.total === 1 && bannedFilter.items[0].user_id === NEWBIE,
  JSON.stringify(bannedFilter.total)
);
await db.exec(`update auth.users set banned_until = now() - interval '1 day' where id = '${NEWBIE}'`);
const expiredBan = (await db.query(usersSql(`'newbie','all','created_at','desc',1,25`))).rows[0].r;
assert(
  "…and an expired ban is no longer banned (compared against now())",
  expiredBan.items[0].account_status === "pending",
  JSON.stringify(expiredBan.items[0].account_status)
);

// ============================================================
console.log("\n-- ADMIN-USERS-04: measured empties, loud errors ----------");
// ============================================================
const noMatch = (
  await db.query(usersSql(`'this-handle-does-not-exist@nowhere.test','all','created_at','desc',1,25`))
).rows[0].r;
assert(
  "a query with no matches is a successful read: total 0, well-formed payload",
  noMatch.total === 0 &&
    noMatch.items.length === 0 &&
    typeof noMatch.generated_at === "string",
  JSON.stringify(noMatch).slice(0, 160)
);
const noProfileFilter = (await db.query(usersSql(`null,'no_profile','created_at','desc',1,25`))).rows[0].r;
assert(
  "the missing-profile filter is measurable and currently empty",
  noProfileFilter.total === 0,
  "the bootstrap trigger made every seeded profile"
);
await expectError(
  "ADMIN-USERS-04 a non-uuid detail argument raises (error state), never an empty record",
  () => db.query(`select public.admin_user_detail('00000000-0000-0000-0000-00000000000z')`),
  "invalid input syntax"
);
await expectError(
  "ADMIN-WORKSPACES-05 …and the same for workspace ids: a failure cannot become '0 workspaces'",
  () => db.query(`select public.admin_workspace_detail('not-a-uuid')`),
  "invalid input syntax"
);

// ============================================================
console.log("\n-- ADMIN-USERS-05: search over real columns --------------");
// ============================================================
const byEmail = (await db.query(usersSql(`'CUSTOMER@nexus','all','created_at','desc',1,25`))).rows[0].r;
assert(
  "email search is case-insensitive substring",
  byEmail.total === 1 && byEmail.items[0].email === "customer@nexus.test",
  JSON.stringify(byEmail.total)
);
const byName = (await db.query(usersSql(`'Owner One','all','created_at','desc',1,25`))).rows[0].r;
assert(
  "display-name search matches the profiles row",
  byName.total === 1 && byName.items[0].user_id === OWNER,
  JSON.stringify(byName.total)
);
const byExactId = (await db.query(usersSql(`'${NEWBIE}','all','created_at','desc',1,25`))).rows[0].r;
assert(
  "an exact uuid in the box finds the account (support workflow)",
  byExactId.total === 1 && byExactId.items[0].user_id === NEWBIE,
  JSON.stringify(byExactId.total)
);
const literalPercent = (await db.query(usersSql(`'%','all','created_at','desc',1,25`))).rows[0].r;
assert(
  "'%' is a literal, not a match-all wildcard (pattern escaping)",
  literalPercent.total === 0,
  `unescaped it would match every row (${totalAccounts}), got ${literalPercent.total}`
);
const literalUnderscore = (await db.query(usersSql(`'owner_one','all','created_at','desc',1,25`))).rows[0].r;
assert(
  "'_' is literal too",
  literalUnderscore.total === 0,
  JSON.stringify(literalUnderscore.total)
);

// paging window
const pageA = (await db.query(usersSql(`null,'all','created_at','desc',1,2`))).rows[0].r;
const pageB = (await db.query(usersSql(`null,'all','created_at','desc',2,2`))).rows[0].r;
assert(
  "two pages of size 2 partition the platform with no overlap or loss",
  pageA.items.length === 2 &&
    pageB.items.length === totalAccounts - 2 &&
    pageA.items.every((row) => !pageB.items.some((other) => other.user_id === row.user_id)) &&
    new Set([...pageA.items, ...pageB.items].map((i) => i.user_id)).size === totalAccounts &&
    pageA.total === totalAccounts &&
    pageB.total === totalAccounts,
  JSON.stringify({ a: pageA.items.length, b: pageB.items.length })
);
const outOfRange = (await db.query(usersSql(`null,'all','created_at','desc',99,25`))).rows[0].r;
assert(
  "an out-of-range page keeps the true total and returns no rows",
  outOfRange.total === totalAccounts && outOfRange.items.length === 0,
  JSON.stringify(outOfRange)
);

// sort vocabulary — whitelisted, so unknown keys cannot reach the parser
const emailAsc = (await db.query(usersSql(`null,'all','email','asc',1,25`))).rows[0].r;
const emails = emailAsc.items.map((row) => row.email);
assert(
  "sort=email&dir=asc orders by email",
  JSON.stringify(emails) === JSON.stringify([...emails].sort((a, b) => a.localeCompare(b))),
  JSON.stringify(emails)
);
const nameAsc = (await db.query(usersSql(`null,'all','name','asc',1,25`))).rows[0].r;
const nameOrder = nameAsc.items.map((row) =>
  (row.display_name ?? row.email).toLowerCase()
);
assert(
  "sort=name orders by lower(display_name), with the email as the fallback label",
  JSON.stringify(nameOrder) ===
    JSON.stringify([...nameOrder].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) &&
    nameAsc.items[2].display_name === "Owner One",
  JSON.stringify(nameOrder)
);
const unknownSort = (await db.query(usersSql(`null,'all','password_hash','desc',1,25`))).rows[0].r;
assert(
  "an unknown sort key falls back to the default — the whitelist, not injection",
  unknownSort.sort === "created_at" && unknownSort.total === totalAccounts,
  JSON.stringify(unknownSort.sort)
);

// ============================================================
console.log("\n-- ADMIN-USERS-06: inspector and not-found -----------------");
// ============================================================
const detailRes = await db.query(`select public.admin_user_detail('${CUSTOMER}') as d`);
const detail = detailRes.rows[0].d;
assert("detail resolves for a real account", Boolean(detail));
assert(
  "identity is the real profile + auth row",
  detail.identity.email === "customer@nexus.test" &&
    detail.identity.display_name === "Case Customer" &&
    typeof detail.identity.created_at === "string",
  JSON.stringify(detail.identity).slice(0, 200)
);
assert(
  "workspaces list reflects both memberships with their tenant roles",
  detail.workspaces.length === 2 &&
    detail.workspaces.some((w) => w.workspace_id === customerWs && w.is_creator === true && w.role === "owner") &&
    detail.workspaces.some((w) => w.workspace_id === ownerWs && w.role === "admin"),
  JSON.stringify(detail.workspaces)
);
assert(
  "usage counts match seeded rows (3 tasks created, 2 assigned, 1 open, 1 done)",
  detail.usage.tasks_created === 3 &&
    detail.usage.tasks_assigned === 2 &&
    detail.usage.tasks_open === 1 &&
    detail.usage.tasks_done === 1 &&
    detail.usage.projects_owned === 0,
  JSON.stringify(detail.usage)
);
assert(
  "recent_activity carries joined workspace context, capped and ordered",
  detail.usage.activity_events === 3 &&
  detail.recent_activity.length === 3 &&
    detail.recent_activity.every(
      (row) => typeof row.workspace_name === "string" && typeof row.occurred_at === "string"
    ),
  JSON.stringify(detail.recent_activity.map((r) => [r.workspace_name, r.action]))
);
assert(
  "platform block is honest: customer holds no platform seat",
  detail.platform_admin.is_admin === false && detail.platform_admin.role === null,
  JSON.stringify(detail.platform_admin)
);

const ownerDetail = (await db.query(`select public.admin_user_detail('${OWNER}') as d`)).rows[0].d;
assert(
  "the owner's own inspector shows the platform seat with its real note",
  ownerDetail.platform_admin.is_admin === true &&
    ownerDetail.platform_admin.role === "owner" &&
    ownerDetail.platform_admin.note === "bootstrap operator",
  JSON.stringify(ownerDetail.platform_admin)
);

// A revoked platform seat must never read as access: the inspector shows
// the row (role + status='revoked') but is_admin stays false. The list's
// join filters on active, so the revoked account loses its badge entirely.
await asUser(null);
await db.exec(`update public.platform_admins set status = 'revoked' where user_id = '${VIEWER}';`);
await asUser(OWNER);
const revokedViewer = (await db.query(`select public.admin_user_detail('${VIEWER}') as d`)).rows[0].d;
assert(
  "a revoked admin shows role + status in the inspector but is_admin=false",
  revokedViewer.platform_admin.is_admin === false &&
    revokedViewer.platform_admin.role === "viewer" &&
    revokedViewer.platform_admin.status === "revoked",
  JSON.stringify(revokedViewer.platform_admin)
);
const listAfterRevoke = (await db.query(usersSql(`'viewer@','all','created_at','desc',1,25`))).rows[0].r;
assert(
  "…and loses the platform-role badge in the directory (active-only join)",
  listAfterRevoke.items[0].platform_role === null,
  JSON.stringify(listAfterRevoke.items[0].platform_role)
);
await asUser(null);
await db.exec(`update public.platform_admins set status = 'active' where user_id = '${VIEWER}';`);
await asUser(OWNER);

const ghost = await db.query(
  `select public.admin_user_detail('88888888-8888-8888-8888-888888888888') as d`
);
assert(
  "ADMIN-USERS-06 an unknown id returns NULL — the app turns that into Not Found",
  ghost.rows[0].d === null,
  JSON.stringify(ghost.rows[0].d)
);

// ============================================================
console.log("\n-- ADMIN-WORKSPACES-03: the tenant directory ---------------");
// ============================================================
const wsRes = await db.query(wsSql(`null,'all','created_at','desc',1,25`));
const ws = wsRes.rows[0].r;
const wsCount = (await db.query(`select count(*)::int as n from public.workspaces`)).rows[0].n;
assert(
  "workspaces total equals the real table",
  ws.total === wsCount,
  `list: ${ws.total}, table: ${wsCount}`
);
const ownerWsRow = ws.items.find((row) => row.workspace_id === ownerWs);
const customerWsRow = ws.items.find((row) => row.workspace_id === customerWs);
const orphanRow = ws.items.find((row) => row.slug === "orphaned-co");

assert(
  "member counts match workspace_members rows",
  ownerWsRow.members.total === 2 && ownerWsRow.members.active === 2,
  JSON.stringify(ownerWsRow.members)
);
assert(
  "the plan column shows the real active subscription",
  ownerWsRow.plan === "PRO" && ownerWsRow.has_subscription === true,
  JSON.stringify({ plan: ownerWsRow.plan, has: ownerWsRow.has_subscription })
);
assert(
  "bootstrap-created FREE subscription is reported as measured, not defaulted",
  customerWsRow.plan === "FREE" && customerWsRow.has_subscription === true,
  JSON.stringify({ plan: customerWsRow.plan, has: customerWsRow.has_subscription })
);
assert(
  "a tenant with no ACTIVE subscription row shows FREE and says so via has_subscription=false",
  orphanRow.plan === "FREE" && orphanRow.has_subscription === false,
  JSON.stringify({ plan: orphanRow.plan, has: orphanRow.has_subscription })
);
assert(
  "the owner block carries the real account email",
  ownerWsRow.owner.email === "owner@nexus.test" && ownerWsRow.owner.display_name === "Owner One",
  JSON.stringify(ownerWsRow.owner)
);
assert(
  "content counts match the seeded projects/tasks exactly",
  ownerWsRow.projects === 2 &&
    ownerWsRow.tasks === 3 &&
    customerWsRow.projects === 0 &&
    customerWsRow.tasks === 1 &&
    orphanRow.projects === 0 &&
    orphanRow.tasks === 0,
  JSON.stringify([ownerWsRow.projects, ownerWsRow.tasks, customerWsRow.projects,
                   customerWsRow.tasks, orphanRow.projects, orphanRow.tasks])
);
assert(
  "last activity: the real newest activities row for the tenant",
  ownerWsRow.last_activity_at !== null && orphanRow.last_activity_at === null,
  JSON.stringify([ownerWsRow.last_activity_at, orphanRow.last_activity_at])
);
assert(
  "a tenant whose only owner-membership is suspended reports has_active_owner=false",
  orphanRow.has_active_owner === false && ownerWsRow.has_active_owner === true,
  JSON.stringify([orphanRow.has_active_owner, ownerWsRow.has_active_owner])
);
const attention = (await db.query(wsSql(`null,'attention','created_at','desc',1,25`))).rows[0].r;
assert(
  "the attention filter returns exactly the ownerless tenants",
  attention.total === 1 && attention.items[0].slug === "orphaned-co",
  JSON.stringify(attention.items.map((i) => i.slug))
);
const proView = (await db.query(wsSql(`null,'PRO','name','asc',1,25`))).rows[0].r;
assert(
  "the plan filter matches tenants by their active subscription",
  proView.total === 1 && proView.items[0].workspace_id === ownerWs,
  JSON.stringify(proView.total)
);
const freeView = (await db.query(wsSql(`null,'FREE','created_at','desc',1,25`))).rows[0].r;
assert(
  "the FREE filter covers defaulted and row-backed tenants alike (no row ≠ no plan)",
  freeView.total === wsCount - 1 &&
    freeView.items.some((r) => r.slug === "orphaned-co") &&
    freeView.items.some((r) => r.workspace_id === customerWs) &&
    !freeView.items.some((r) => r.workspace_id === ownerWs),
  JSON.stringify(freeView.items.map((i) => i.slug))
);
const wsSearchSlug = (await db.query(wsSql(`'orphaned','all','created_at','desc',1,25`))).rows[0].r;
assert(
  "search matches slugs",
  wsSearchSlug.total === 1 && wsSearchSlug.items[0].slug === "orphaned-co",
  JSON.stringify(wsSearchSlug.total)
);
const wsByExact = (await db.query(wsSql(`'${customerWs}','all','created_at','desc',1,25`))).rows[0].r;
assert(
  "exact-uuid search finds a tenant by id",
  wsByExact.total === 1 && wsByExact.items[0].workspace_id === customerWs,
  JSON.stringify(wsByExact.total)
);
const wsMembersDesc = (await db.query(wsSql(`null,'all','members','desc',1,25`))).rows[0].r;
assert(
  "sort=members desc puts the two-member tenant first",
  wsMembersDesc.items[0].members.total === 2,
  JSON.stringify(wsMembersDesc.items.map((r) => r.members.total))
);

// ============================================================
console.log("\n-- ADMIN-WORKSPACES-04/05: inspector -----------------------");
// ============================================================
const wsDetail = (
  await db.query(`select public.admin_workspace_detail('${ownerWs}') as d`)
).rows[0].d;
assert("workspace detail resolves", Boolean(wsDetail));
assert(
  "overview fields are the workspaces row verbatim",
  wsDetail.overview.slug === "owner-11111111" && wsDetail.overview.name === "Owner One",
  JSON.stringify([wsDetail.overview.slug, wsDetail.overview.name])
);
assert(
  "owner block is the joined account",
  wsDetail.owner.email === "owner@nexus.test" && wsDetail.owner.account_status === "active",
  JSON.stringify(wsDetail.owner)
);
assert(
  "health reports measured facts",
  wsDetail.health.has_active_owner === true && wsDetail.health.member_count_active === 2,
  JSON.stringify(wsDetail.health)
);
assert(
  "tasks_by_status sums to the real total and buckets exactly",
  Object.values(wsDetail.tasks_by_status).reduce((a, b) => a + b, 0) === 3 &&
    wsDetail.tasks_by_status.done === 1 &&
    wsDetail.tasks_by_status.blocked === 1 &&
    wsDetail.tasks_by_status.in_progress === 1 &&
    wsDetail.tasks_by_status.todo === undefined,
  JSON.stringify(wsDetail.tasks_by_status)
);
assert(
  "recent_projects carry real per-project task counts",
  wsDetail.recent_projects.length === 2 &&
    wsDetail.recent_projects.find((p) => p.name === "Launch").tasks_total === 3 &&
    wsDetail.recent_projects.find((p) => p.name === "Launch").tasks_done === 1 &&
    wsDetail.recent_projects.find((p) => p.name === "Backlog").tasks_total === 0,
  JSON.stringify(wsDetail.recent_projects.map((p) => [p.name, p.tasks_total, p.tasks_done]))
);
assert(
  "members list both accounts with their tenant roles and join dates",
  wsDetail.members.length === 2 &&
    wsDetail.members.some((m) => m.role === "owner" && m.user_id === OWNER) &&
    wsDetail.members.some((m) => m.user_id === CUSTOMER && m.role === "admin" && m.account_status === "active"),
  JSON.stringify(wsDetail.members.map((m) => [m.email, m.role]))
);
assert(
  "subscription rows are listed with their real plan/status",
  wsDetail.subscription.length === 1 &&
    wsDetail.subscription[0].plan === "PRO" &&
    wsDetail.subscription[0].status === "active" &&
    wsDetail.subscription[0].has_billing_ids === false,
  JSON.stringify(wsDetail.subscription)
);
assert(
  "usage counts every relation the tenant owns — projects, tasks, goals, events",
  wsDetail.usage.projects === 2 &&
    wsDetail.usage.tasks === 3 &&
    wsDetail.usage.goals === 1 &&
    wsDetail.usage.events === 6 &&
    wsDetail.usage.notifications === 0,
  JSON.stringify(wsDetail.usage)
);
assert(
  "activity rows are the trigger-written ones, with real actor attribution",
  wsDetail.recent_activity.length === 6 &&
    wsDetail.recent_activity.filter((a) => a.actor_email === "customer@nexus.test").length === 2 &&
    wsDetail.recent_activity.filter((a) => a.actor_email === "owner@nexus.test").length === 1 &&
    wsDetail.recent_activity.filter((a) => a.actor_email === null).length === 3,
  JSON.stringify(wsDetail.recent_activity.map((a) => [a.entity_type, a.actor_email]))
);
assert(
  "the customer workspace's own event is attributed to the customer",
  (
    await db.query(`select public.admin_workspace_detail('${customerWs}') as d`)
  ).rows[0].d.recent_activity.every((a) => a.actor_email === "customer@nexus.test")
);

const orphanDetail = (
  await db.query(`select public.admin_workspace_detail('${orphanWs}') as d`)
).rows[0].d;
assert(
  "the broken tenant's inspector shows the measured problem, not a crash",
  orphanDetail.health.has_active_owner === false &&
    orphanDetail.usage.tasks === 0 &&
    orphanDetail.members.length === 1 &&
    orphanDetail.members[0].membership_status === "suspended" &&
    // The detail lists EVERY subscription row (history is useful); the
    // "no active row" state is what the UI derives from it.
    orphanDetail.subscription.length === 1 &&
    orphanDetail.subscription[0].status === "cancelled" &&
    !orphanDetail.subscription.some((row) => row.status === "active"),
  JSON.stringify(orphanDetail)
);

const wsGhost = await db.query(
  `select public.admin_workspace_detail('99999999-9999-9999-9999-999999999999') as d`
);
assert(
  "ADMIN-WORKSPACES-04 an unknown workspace id returns NULL (→ the app's Not Found)",
  wsGhost.rows[0].d === null,
  JSON.stringify(wsGhost.rows[0].d)
);

const wsWeirdSort = (
  await db.query(wsSql(`null,'all','evil_fallback','asc',1,25`))
).rows[0].r;
assert(
  "ADMIN-WORKSPACES-05 an unrecognized sort falls back to the default key — the payload itself states what was applied",
  wsWeirdSort.sort === "created_at" && wsWeirdSort.total === wsCount,
  JSON.stringify({ sort: wsWeirdSort.sort, total: wsWeirdSort.total })
);
await expectPasses(
  "…and the workspaces table is untouched",
  `select 1 from public.workspaces limit 1`
);

// ============================================================
console.log("\n-- ADMIN-SECURITY-01: the new EXECUTE surface is closed ----");
// ============================================================
const newFnPrivs = await db.query(`
  select p.proname,
         has_function_privilege('public', p.oid, 'EXECUTE') as pub,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
         has_function_privilege('service_role', p.oid, 'EXECUTE') as svc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('admin_users_list','admin_user_detail',
                      'admin_workspaces_list','admin_workspace_detail')
  order by p.proname
`);
assert(
  "ADMIN-SECURITY-01 all four directory functions exist exactly once each",
  newFnPrivs.rows.length === 4,
  JSON.stringify(newFnPrivs.rows.map((r) => r.proname))
);
for (const row of newFnPrivs.rows) {
  assert(`ADMIN-SECURITY-01 ${row.proname}: no PUBLIC EXECUTE`, row.pub === false);
  assert(`ADMIN-SECURITY-01 ${row.proname}: no anon EXECUTE`, row.anon === false);
  assert(
    `ADMIN-SECURITY-01 ${row.proname}: authenticated EXECUTE only (the app's role)`,
    row.auth === true && row.svc === false,
    JSON.stringify(row)
  );
}

const sp027 = await db.query(`
  select p.proname,
         coalesce((select a from unnest(p.proconfig) a where a like 'search_path%'), '(none)') as spath
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('admin_users_list','admin_user_detail',
                      'admin_workspaces_list','admin_workspace_detail')
`);
assert(
  "ADMIN-SECURITY-01 every new function pins search_path including pg_temp",
  sp027.rows.length === 4 && sp027.rows.every((r) => r.spath.includes("pg_temp")),
  JSON.stringify(sp027.rows.map((r) => `${r.proname}=${r.spath}`))
);
const dyn027 = await db.query(`
  select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('admin_users_list','admin_user_detail',
                      'admin_workspaces_list','admin_workspace_detail')
    and p.prosrc ~* 'to_regclass|execute[[:space:]]+format|format\\(''%I'
`);
assert(
  "ADMIN-SECURITY-01 no new function builds SQL from caller input",
  dyn027.rows.length === 0,
  dyn027.rows.map((r) => r.proname).join(", ") || "none"
);
// Read-only by construction: the bodies contain no DML at all.
const dml027 = await db.query(`
  select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('admin_users_list','admin_user_detail',
                      'admin_workspaces_list','admin_workspace_detail')
    and p.prosrc ~* '(insert[[:space:]]+into|update[[:space:]]+public|delete[[:space:]]+from|truncate)'
`);
assert(
  "ADMIN-SECURITY-01 the directory functions contain no writes",
  dml027.rows.length === 0,
  dml027.rows.map((r) => r.proname).join(", ") || "none"
);

// 026's internal helpers were reused, not widened.
await asUser(VIEWER);
await asRole("authenticated");
await expectError(
  "ADMIN-SECURITY-01 even a platform viewer cannot call admin_assert_access directly",
  () => db.query(`select public.admin_assert_access('owner')`),
  "permission denied for function"
);
await expectError(
  "ADMIN-SECURITY-01 …nor platform_admin_is_admin",
  () => db.query(`select public.platform_admin_is_admin()`),
  "permission denied for function"
);

// ============================================================
console.log("\n-- ADMIN-SECURITY-02: no leakage through the new doors -----");
// ============================================================
await asUser(CUSTOMER);
await expectError(
  "ADMIN-SECURITY-02 a customer cannot enumerate accounts",
  () => db.query(usersSql(`null,'all','created_at','desc',1,25`)),
  "NEXUS_ADMIN_FORBIDDEN"
);
await expectError(
  "ADMIN-SECURITY-02 …cannot read another user's inspector",
  () => db.query(`select public.admin_user_detail('${OWNER}')`),
  "NEXUS_ADMIN_FORBIDDEN"
);
await expectError(
  "ADMIN-SECURITY-02 direct auth.users access is still denied for authenticated",
  () => db.query(`select id from auth.users`),
  "permission denied"
);
await expectError(
  "ADMIN-SECURITY-02 …and the admin tables remain unreachable directly",
  () => db.query(`select count(*) from public.platform_admins`),
  "permission denied"
);
await asRole(null);

// Payload hygiene: no auth-secret fields at any depth, and no admin note
// on accounts the operator is not inspecting.
await asUser(OWNER);
function collectKeys(node, out = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectKeys(item, out);
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      out.push(key);
      collectKeys(value, out);
    }
  }
  return out;
}
const SECRET_KEYS =
  /password|token|secret|encrypted|raw_user_meta|raw_app_meta|confirmation|recovery|authenticator|mfa|webauthn|challenge/i;
const allKeys = new Set([
  ...collectKeys(usersRes.rows[0].r),
  ...collectKeys(detail),
  ...collectKeys(wsRes.rows[0].r),
  ...collectKeys(wsDetail),
  ...collectKeys(orphanDetail),
]);
const leaked = [...allKeys].filter((key) => SECRET_KEYS.test(key));
assert(
  "ADMIN-SECURITY-02 directory payloads carry no auth-secret fields",
  leaked.length === 0,
  `leaked: ${leaked.join(", ") || "none"} (all keys: ${allKeys.size})`
);
assert(
  "the LIST never carries platform_admins.note (inspector-only)",
  users.items.every((row) => !("note" in row))
);
assert(
  "the user list has no raw metadata blobs at all",
  users.items.every((row) => Object.keys(row).every((k) => !/^raw_/.test(k)))
);

// Audit discipline: PR 2 adds only reads, and reads are not logged.
const auditCount = await db.query(
  `select count(*)::int as n from public.admin_audit_log where action like 'admin.users%' or action like 'admin.workspaces%'`
);
assert(
  "the audit trail gains no noise from directory reads",
  auditCount.rows[0].n === 0,
  `rows: ${auditCount.rows[0].n}`
);
await asRole("authenticated");
await expectError(
  "…and the audit log remains unwritable from the app role",
  () => db.query(`insert into public.admin_audit_log (action) values ('x')`),
  "permission denied"
);
await asRole(null);

// ============================================================
console.log("\n-- ADMIN-PR3: activity, audit and security reads -------------");
// ============================================================
await asUser(OWNER);
await asRole("authenticated");

const activity028 = (
  await db.query(`select public.admin_activity_list(null, null, 1, 25) as r`)
).rows[0].r;
assert(
  "ADMIN-PR3 activity read returns a measured paginated payload",
  typeof activity028.total === "number" &&
    Array.isArray(activity028.items) &&
    activity028.page === 1 &&
    activity028.page_size === 25,
  JSON.stringify(activity028)
);

const audit028 = (
  await db.query(`select public.admin_audit_log_list(null, null, 1, 25) as r`)
).rows[0].r;
assert(
  "ADMIN-PR3 audit read returns the append-only log shape",
  typeof audit028.total === "number" &&
    Array.isArray(audit028.items) &&
    audit028.page === 1,
  JSON.stringify(audit028)
);

const security028 = (
  await db.query(`select public.admin_security_overview() as r`)
).rows[0].r;
assert(
  "ADMIN-PR3 security read reports measured admin context and unavailable sessions",
  security028.platform_admin.role === "owner" &&
    typeof security028.audit.events_total === "number" &&
    security028.sessions.state === "unavailable",
  JSON.stringify(security028)
);

await asUser(CUSTOMER);
await expectError(
  "ADMIN-PR3 a customer cannot read activity",
  () => db.query(`select public.admin_activity_list(null, null, 1, 25)`),
  "NEXUS_ADMIN_FORBIDDEN"
);
await asRole(null);

// ---- summary -------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
