/**
 * ============================================================
 * NEXUS ADMIN — SUBSCRIPTIONS (029 + EFFECTIVE PLAN CONTRACT) — SQL TESTS
 * ============================================================
 * Runs the real migrations against a real PostgreSQL engine (PGlite)
 * and asserts the properties /admin/subscriptions depends on:
 *
 *   - the gate: owner and viewer read, customers are refused with
 *     NEXUS_ADMIN_FORBIDDEN, revoked admins lose access immediately,
 *     anon cannot even invoke the function;
 *   - every row branch the UI renders: paid live, churned (cancelled
 *     live row, default FREE plan), dunning (past_due), lapsed (an
 *     active PRO row past its period → expired, FREE plan and limits),
 *     expired, trialing (tracked, grants nothing), and implicit free
 *     (no rows at all);
 *   - the filters are whitelists (unknown values → no filter, never
 *     an error), the search matches name/slug/uuid, the sorts are the
 *     seven documented keys, pagination clamps instead of exploding;
 *   - the summary describes the FILTERED set and the attention count
 *     is exactly {past_due, cancelled, expired} ∪ {no active owner};
 *   - the 027-agreement invariant: for every workspace, 029's plan
 *     and has_subscription equal admin_workspaces_list's. The two
 *     screens share the predicate verbatim; if either drifts, the
 *     counts stop agreeing and this suite notices;
 *   - the security posture: one function, authenticated-only EXECUTE,
 *     pinned search_path, no caller-built SQL, no writes.
 *
 * Nothing here mocks NEXUS logic. Only the database engine is
 * substituted, exactly as in the other PGlite suites in this folder.
 *
 * Run:  node supabase/tests/admin-subscriptions.test.mjs
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

async function expectPasses(name, sql) {
  try {
    await db.query(sql);
    ok(name);
  } catch (error) {
    ko(name, String(error.message).split("\n")[0]);
  }
}

// The three identities used throughout: one customer, one operator, one
// viewer. Their uuids never change, so the assertions stay readable.
const OWNER = "11111111-1111-1111-1111-111111111111";
const CUSTOMER = "22222222-2222-2222-2222-222222222222";
const VIEWER = "44444444-4444-4444-4444-444444444444";

const db = await PGlite.create();

// ---- platform roles + Supabase-like default privileges -------------------
// As in the PR 1 / PR 2 suites: default privileges hand every new function
// and table explicit ACL entries for anon / authenticated / service_role,
// which `revoke from public` does NOT clear. Without this emulation, a
// missing revoke in 029 would pass here and be wide open on a real project.
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

// 002–005 are skipped exactly like in the freemium and subscription
// suites: 002 inserts into storage.buckets (a Supabase-platform schema
// PGlite does not provide — 42P01), 003 needs the pgvector extension,
// and 004/005 build on the 003 AI tables. They apply on a real
// provisioned project; none of those four is owned by this test.
const SKIPPED = new Set([
  "002_nexus_storage.sql",
  "003_nexus_ai.sql",
  "004_nexus_automations.sql",
  "005_nexus_worker.sql",
]);

const migrations = readdirSync(migrationsDir)
  .filter(
    (file) =>
      file.endsWith(".sql") &&
      !file.startsWith("001_") &&
      !SKIPPED.has(file)
  )
  .sort();

let migration029Applied = false;
for (const file of migrations) {
  try {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    if (file.startsWith("029_")) migration029Applied = true;
  } catch (error) {
    ko(`migration applied: ${file}`, String(error.message).split("\n")[0]);
  }
}
await db.exec(readFileSync(join(migrationsDir, "20260921190000_admin_effective_plans.sql"), "utf8"));
assert("migration 029_admin_subscriptions.sql applies cleanly", migration029Applied);

async function asUser(userId) {
  await db.exec(`set test.current_user_id = ${userId ? `'${userId}'` : "''"}`);
}
async function asRole(role) {
  await db.exec(role ? `set role ${role}` : "reset role");
}

// ---- seed ---------------------------------------------------------------
// Inserting into auth.users fires the real bootstrap trigger, which creates
// each account's personal workspace AND (via 007) its active FREE row.
// Workspaces are therefore never hand-given subscriptions: the seed mutates
// what production creates, so every branch under test is reachable in
// production too.
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  values ('${OWNER}','owner@nexus.test','{"full_name":"Owner One"}', now() - interval '40 days');
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  values ('${CUSTOMER}','customer@nexus.test','{"full_name":"Case Customer"}', now() - interval '9 days');
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  values ('${VIEWER}','viewer@nexus.test','{}', now() - interval '5 days');
`);

await db.exec(`
  insert into public.platform_admins (user_id, role, note) values
    ('${OWNER}','owner','bootstrap operator'),
    ('${VIEWER}','viewer','read-only seat');
`);

const ownerWs = (
  await db.query(`select id from public.workspaces where owner_id = '${OWNER}' limit 1`)
).rows[0].id;
const customerWs = (
  await db.query(`select id from public.workspaces where owner_id = '${CUSTOMER}' limit 1`)
).rows[0].id;
const viewerWs = (
  await db.query(`select id from public.workspaces where owner_id = '${VIEWER}' limit 1`)
).rows[0].id;

// The owner moves up to PRO with a live period: the paid-live branch.
await db.exec(`
  update public.workspace_subscriptions
     set plan = 'PRO', current_period_end = now() + interval '30 days',
         updated_at = now()
   where workspace_id = '${ownerWs}' and status = 'active';
`);

// The customer churned: their live row is cancelled (back to the default
// FREE plan), with one older cancelled row behind it for previous_rows.
// updated_at is set explicitly — no trigger bumps it, and "latest" is
// defined by updated_at.
await db.exec(`
  update public.workspace_subscriptions
     set status = 'cancelled', updated_at = now() - interval '2 days'
   where workspace_id = '${customerWs}' and status = 'active';
  insert into public.workspace_subscriptions
         (workspace_id, plan, status, current_period_end, created_at, updated_at)
  values ('${customerWs}', 'PRO', 'cancelled', now() - interval '60 days',
          now() - interval '90 days', now() - interval '60 days');
`);

// The viewer's personal tenant is dunning: a past_due PRO row grants
// nothing, so the plan badge falls back to FREE while the live state
// stays visible as past_due.
await db.exec(`
  update public.workspace_subscriptions
     set plan = 'PRO', status = 'past_due', updated_at = now() - interval '1 day'
   where workspace_id = '${viewerWs}' and status = 'active';
`);

// A second workspace for the owner whose ONLY owner-membership is then
// suspended: the measured "no active owner" condition. Its active PRO row
// is past its period — the guards fail closed (FREE limits) while the
// plan badge still reads the row (PRO), exactly the mismatch the UI's
// "over" flags exist to surface.
await db.exec(`
  insert into public.workspaces (owner_id, name, slug)
  values ('${OWNER}','Orphaned Co','orphaned-co');
  update public.workspace_members m
     set status = 'suspended'
   where m.workspace_id = (select id from public.workspaces where slug = 'orphaned-co');
  update public.workspace_subscriptions
     set plan = 'PRO', current_period_end = now() - interval '1 day',
         updated_at = now() - interval '1 day'
   where workspace_id = (select id from public.workspaces where slug = 'orphaned-co');
`);
const orphanWs = (
  await db.query(`select id from public.workspaces where slug = 'orphaned-co'`)
).rows[0].id;

// An expired tenant: the lapse sweep ran and materialized 'expired'.
await db.exec(`
  insert into public.workspaces (owner_id, name, slug)
  values ('${OWNER}','Expired Ltd','expired-ltd');
  update public.workspace_subscriptions
     set plan = 'PRO', status = 'expired', updated_at = now() - interval '3 days'
   where workspace_id = (select id from public.workspaces where slug = 'expired-ltd');
`);
const expiredWs = (
  await db.query(`select id from public.workspaces where slug = 'expired-ltd'`)
).rows[0].id;

// A trial tenant: tracked as trialing, grants nothing (the contract only
// honors 'active'), and is NOT attention — mid-funnel is not a problem.
await db.exec(`
  insert into public.workspaces (owner_id, name, slug)
  values ('${OWNER}','Trial Inc','trial-inc');
  update public.workspace_subscriptions
     set plan = 'PRO', status = 'trialing',
         trial_ends_at = now() + interval '7 days',
         updated_at = now() - interval '1 hour'
   where workspace_id = (select id from public.workspaces where slug = 'trial-inc');
`);
const trialWs = (
  await db.query(`select id from public.workspaces where slug = 'trial-inc'`)
).rows[0].id;

// A tenant with no subscription rows at all: the implicit-free branch.
// Reached by deleting the auto-created row — the ONLY branch the seed
// cannot reach by mutation, because production always inserts the row.
await db.exec(`
  insert into public.workspaces (owner_id, name, slug)
  values ('${OWNER}','Bare Shop','bare-shop');
  delete from public.workspace_subscriptions
   where workspace_id = (select id from public.workspaces where slug = 'bare-shop');
`);
const bareWs = (
  await db.query(`select id from public.workspaces where slug = 'bare-shop'`)
).rows[0].id;

// Product rows on the paid-live workspace: 2 projects, 3 tasks (one done,
// so active_tasks = 2), 1 goal. CUSTOMER joins as an active admin, so
// members = 2 (owner + admin) while has_active_owner stays true.
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
await db.exec(`
  insert into public.tasks (workspace_id, project_id, title, status, created_by)
  values
    ('${ownerWs}','${launchId}','Draft spec','done','${OWNER}'),
    ('${ownerWs}','${launchId}','QA pass','blocked','${OWNER}'),
    ('${ownerWs}',null,'Pay rent','todo','${OWNER}');
  insert into public.workspace_members (workspace_id, user_id, role, status)
  values ('${ownerWs}','${CUSTOMER}','admin','active');
`);

const subsSql = (args) => `select public.admin_subscriptions_list(${args}) as r`;
async function readSubs(args) {
  return (await db.query(subsSql(args))).rows[0].r;
}

// The enforced limits, read from the same function the UI compares
// against — hardcoded numbers here would couple this suite to pricing.
const proLimits = (
  await db.query(
    `select public.get_plan_limit('PRO','projects') as p,
            public.get_plan_limit('PRO','active_tasks') as t,
            public.get_plan_limit('PRO','goals') as g`
  )
).rows[0];
const freeLimits = (
  await db.query(
    `select public.get_plan_limit('FREE','projects') as p,
            public.get_plan_limit('FREE','active_tasks') as t,
            public.get_plan_limit('FREE','goals') as g`
  )
).rows[0];

// ============================================================
console.log("\n-- ADMIN-SUBS-01/02: the gate decides --------------------");
// ============================================================
await asUser(OWNER);
const firstRead = await readSubs(`null,'all','all','plan','desc',1,25`);
assert(
  "ADMIN-SUBS-01 an owner reads the subscriptions list",
  Array.isArray(firstRead.items) && firstRead.total === 7,
  `total: ${firstRead.total} (3 bootstrap + 4 hand-made)`
);

await asUser(VIEWER);
await expectPasses(
  "ADMIN-SUBS-01 a viewer reads the subscriptions list too (reads are the whole PR)",
  subsSql(`null,'all','all','plan','desc',1,25`)
);

await asUser(CUSTOMER);
await expectError(
  "ADMIN-SUBS-02 a customer is refused admin_subscriptions_list",
  () => db.query(subsSql(`null,'all','all','plan','desc',1,25`)),
  "NEXUS_ADMIN_FORBIDDEN"
);

// A revoked platform admin loses the list immediately — 026's rule,
// asserted again here because 029 added its own door.
await db.exec(
  `update public.platform_admins set status = 'revoked' where user_id = '${VIEWER}';`
);
await asUser(VIEWER);
await expectError(
  "a revoked viewer is refused by admin_subscriptions_list",
  () => db.query(subsSql(`null,'all','all','plan','desc',1,25`)),
  "NEXUS_ADMIN_FORBIDDEN"
);
await asUser(null);
await db.exec(
  `update public.platform_admins set status = 'active' where user_id = '${VIEWER}';`
);

// anon has no door at all.
await asRole("anon");
await expectError(
  "anonymous callers cannot invoke admin_subscriptions_list",
  () => db.query(subsSql(`null,'all','all','plan','desc',1,25`)),
  "permission denied for function"
);
await asRole(null);
await asUser(OWNER);

// ============================================================
console.log("\n-- ADMIN-SUBS-03: the envelope and the item shape --------");
// ============================================================
const envelopeKeys = [
  "generated_at",
  "page",
  "page_size",
  "sort",
  "direction",
  "search",
  "plan",
  "status",
  "summary",
  "total",
  "items",
];
assert(
  "the envelope carries exactly the documented keys",
  envelopeKeys.every((k) => k in firstRead),
  `keys: ${Object.keys(firstRead).join(",")}`
);
assert(
  "echoed query state matches the call (sort plan desc, no filters)",
  firstRead.sort === "plan" &&
    firstRead.direction === "desc" &&
    firstRead.search === null &&
    firstRead.plan === "all" &&
    firstRead.status === "all" &&
    firstRead.page === 1 &&
    firstRead.page_size === 25,
  JSON.stringify({
    sort: firstRead.sort,
    direction: firstRead.direction,
    search: firstRead.search,
    plan: firstRead.plan,
    status: firstRead.status,
    page: firstRead.page,
    page_size: firstRead.page_size,
  })
);

const byId = Object.fromEntries(firstRead.items.map((i) => [i.workspace_id, i]));
const itemKeys = [
  "workspace_id",
  "name",
  "slug",
  "plan",
  "has_subscription",
  "subscription_status",
  "current_period_end",
  "trial_ends_at",
  "subscription_updated_at",
  "billing_wired",
  "previous_rows",
  "owner",
  "usage",
  "limits",
  "has_active_owner",
];
assert(
  "every item carries exactly the documented keys",
  firstRead.items.every((i) => itemKeys.every((k) => k in i)),
  `keys: ${Object.keys(firstRead.items[0] ?? {}).join(",")}`
);

// ============================================================
console.log("\n-- ADMIN-SUBS-04: every row branch the UI renders -------");
// ============================================================
const paid = byId[ownerWs];
assert(
  "paid-live: PRO badge on an active row with a live period",
  paid.plan === "PRO" &&
    paid.has_subscription === true &&
    paid.subscription_status === "active",
  JSON.stringify({ plan: paid.plan, sub: paid.has_subscription, status: paid.subscription_status })
);
assert(
  "paid-live: no provider ever wrote here",
  paid.billing_wired === false && paid.previous_rows === 0,
  JSON.stringify({ wired: paid.billing_wired, prev: paid.previous_rows })
);
assert(
  "paid-live: usage counts are live (2 projects, 2 active tasks, 1 goal, 2 members)",
  paid.usage.projects === 2 &&
    paid.usage.active_tasks === 2 &&
    paid.usage.goals === 1 &&
    paid.usage.members === 2,
  JSON.stringify(paid.usage)
);
assert(
  "paid-live: limits are the PRO limits (same function the guards use)",
  paid.limits.projects === proLimits.p &&
    paid.limits.active_tasks === proLimits.t &&
    paid.limits.goals === proLimits.g,
  JSON.stringify(paid.limits)
);
assert(
  "paid-live: the owner contact resolves to a real account",
  paid.owner.user_id === OWNER && paid.owner.email === "owner@nexus.test",
  JSON.stringify(paid.owner)
);
assert(
  "paid-live: an active owner exists",
  paid.has_active_owner === true
);

const effectiveOverview = (await db.query("select public.admin_overview() as r")).rows[0].r;
assert("overview and subscriptions share effective plan counts", effectiveOverview.plans.pro === firstRead.summary.plans.pro && effectiveOverview.plans.free === firstRead.summary.plans.free);

const churned = byId[customerWs];
assert(
  "churned: default FREE plan, but the cancelled live row stays visible",
  churned.plan === "FREE" &&
    churned.has_subscription === false &&
    churned.subscription_status === "cancelled",
  JSON.stringify({
    plan: churned.plan,
    sub: churned.has_subscription,
    status: churned.subscription_status,
  })
);
assert(
  "churned: the older cancelled row counts as history, not as state",
  churned.previous_rows === 1,
  `previous_rows: ${churned.previous_rows}`
);
assert(
  "churned: limits are the FREE limits the guards enforce",
  churned.limits.projects === freeLimits.p &&
    churned.limits.active_tasks === freeLimits.t &&
    churned.limits.goals === freeLimits.g,
  JSON.stringify(churned.limits)
);

const dunning = byId[viewerWs];
assert(
  "dunning: past_due grants nothing (FREE badge) but stays visible",
  dunning.plan === "FREE" &&
    dunning.has_subscription === false &&
    dunning.subscription_status === "past_due",
  JSON.stringify({
    plan: dunning.plan,
    sub: dunning.has_subscription,
    status: dunning.subscription_status,
  })
);

const orphan = byId[orphanWs];
assert(
  "lapsed: expired status and FREE effective plan agree with enforcement",
  orphan.plan === "FREE" &&
    orphan.has_subscription === false &&
    orphan.subscription_status === "expired",
  JSON.stringify({
    plan: orphan.plan,
    sub: orphan.has_subscription,
    status: orphan.subscription_status,
  })
);
assert(
  "lapsed limits also resolve to FREE",
  orphan.limits.projects === freeLimits.p &&
    orphan.limits.active_tasks === freeLimits.t &&
    orphan.limits.goals === freeLimits.g,
  JSON.stringify(orphan.limits)
);
assert(
  "lapsed: the suspended owner-membership reads as no active owner",
  orphan.has_active_owner === false
);

const expired = byId[expiredWs];
assert(
  "expired: the sweep's 'expired' state is a live status, not implicit free",
  expired.plan === "FREE" &&
    expired.has_subscription === false &&
    expired.subscription_status === "expired",
  JSON.stringify({
    plan: expired.plan,
    sub: expired.has_subscription,
    status: expired.subscription_status,
  })
);

const trial = byId[trialWs];
assert(
  "trialing: tracked with its trial end, but grants nothing",
  trial.plan === "FREE" &&
    trial.has_subscription === false &&
    trial.subscription_status === "trialing" &&
    typeof trial.trial_ends_at === "string",
  JSON.stringify({
    plan: trial.plan,
    sub: trial.has_subscription,
    status: trial.subscription_status,
    trial_ends_at: trial.trial_ends_at,
  })
);

const bare = byId[bareWs];
assert(
  "implicit free: no rows at all reads NULL status on the FREE default",
  bare.plan === "FREE" &&
    bare.has_subscription === false &&
    bare.subscription_status === null &&
    bare.previous_rows === 0,
  JSON.stringify({
    plan: bare.plan,
    sub: bare.has_subscription,
    status: bare.subscription_status,
    prev: bare.previous_rows,
  })
);

// ============================================================
console.log("\n-- ADMIN-SUBS-05: filters, search, sort, pagination -----");
// ============================================================
const proOnly = await readSubs(`null,'PRO','all','plan','desc',1,25`);
assert(
  "plan filter PRO matches only the effective paid row",
  proOnly.total === 1 &&
    proOnly.items.every((i) => i.plan === "PRO") &&
    proOnly.summary.plans.pro === 1 &&
    proOnly.summary.plans.free === 0,
  `total: ${proOnly.total}`
);

for (const [status, expectedId] of [
  ["cancelled", customerWs],
  ["past_due", viewerWs],
  ["trialing", trialWs],
]) {
  const res = await readSubs(`null,'all','${status}','plan','desc',1,25`);
  assert(
    `status filter ${status} matches exactly its tenant`,
    res.total === 1 && res.items[0].workspace_id === expectedId,
    `total: ${res.total}`
  );
}

const expiredOnly = await readSubs(`null,'all','expired','plan','desc',1,25`);
assert("expired filter includes materialized and unswept expiration", expiredOnly.total === 2 && [expiredWs, orphanWs].every(id => expiredOnly.items.some(i => i.workspace_id === id)));

const implicitOnly = await readSubs(`null,'all','implicit_free','plan','desc',1,25`);
assert(
  "status filter implicit_free matches ONLY the row-less tenant (churned/expired/trialing/dunning are states, not defaults)",
  implicitOnly.total === 1 && implicitOnly.items[0].workspace_id === bareWs,
  `total: ${implicitOnly.total}`
);

const activeOnly = await readSubs(`null,'all','active','plan','desc',1,25`);
assert(
  "status filter active excludes lapsed periods",
  activeOnly.total === 1 &&
    activeOnly.items.every((i) => i.subscription_status === "active"),
  `total: ${activeOnly.total}`
);

const unknownPlan = await readSubs(`null,'ULTRA','all','plan','desc',1,25`);
assert(
  "an unknown plan filter falls back to no filter, never an error page",
  unknownPlan.total === firstRead.total && unknownPlan.plan === "all",
  `total: ${unknownPlan.total}, plan: ${unknownPlan.plan}`
);
const unknownStatus = await readSubs(`null,'all','subscribing','plan','desc',1,25`);
assert(
  "an unknown status filter falls back to no filter, never an error page",
  unknownStatus.total === firstRead.total && unknownStatus.status === "all",
  `total: ${unknownStatus.total}, status: ${unknownStatus.status}`
);

const searched = await readSubs(`'orphaned','all','all','plan','desc',1,25`);
assert(
  "search matches the workspace slug",
  searched.total === 1 && searched.items[0].workspace_id === orphanWs,
  `total: ${searched.total}`
);
const searchedUuid = await readSubs(`'${bareWs}','all','all','plan','desc',1,25`);
assert(
  "search matches the full workspace uuid",
  searchedUuid.total === 1 && searchedUuid.items[0].workspace_id === bareWs,
  `total: ${searchedUuid.total}`
);

const byName = await readSubs(`null,'all','all','name','asc',1,25`);
const names = byName.items.map((i) => i.name);
assert(
  "sort name asc orders alphabetically (case-insensitive)",
  names.every(
    (n, idx) =>
      idx === 0 || (n ?? "").toLowerCase() >= (names[idx - 1] ?? "").toLowerCase()
  ),
  names.join(" | ")
);
const byPlan = await readSubs(`null,'all','all','plan','desc',1,25`);
assert(
  "default sort (plan desc) puts paid plans first",
  byPlan.items[0].plan === "PRO" && byPlan.items[1].plan === "FREE",
  byPlan.items.map((i) => i.plan).join(",")
);
const unknownSort = await readSubs(`null,'all','all','mrr','desc',1,25`);
assert(
  "an unknown sort key falls back to plan, a garbage direction to desc",
  unknownSort.sort === "plan" && unknownSort.direction === "desc",
  `sort: ${unknownSort.sort}, direction: ${unknownSort.direction}`
);

const clamped = await readSubs(`null,'all','all','plan','desc',1,200`);
assert(
  "page_size clamps to 100 instead of an unbounded scan",
  clamped.page_size === 100,
  `page_size: ${clamped.page_size}`
);
const beyond = await readSubs(`null,'all','all','plan','desc',999,25`);
assert(
  "a page past the end is empty but keeps the total (out-of-range, not zero)",
  beyond.items.length === 0 && beyond.total === firstRead.total,
  `items: ${beyond.items.length}, total: ${beyond.total}`
);

// ============================================================
console.log("\n-- ADMIN-SUBS-06: the summary describes the query -------");
// ============================================================
const summary = firstRead.summary;
assert(
  "summary.workspaces equals the unfiltered total",
  summary.workspaces === firstRead.total,
  `workspaces: ${summary.workspaces}, total: ${firstRead.total}`
);
assert(
  "summary plans reflect effective entitlements (1 PRO, 0 TEAM, rest FREE)",
  summary.plans.pro === 1 &&
    summary.plans.team === 0 &&
    summary.plans.free === firstRead.total - 1,
  JSON.stringify(summary.plans)
);
assert(
  "summary statuses count live states, including expired and implicit free",
  summary.statuses.active === 1 &&
    summary.statuses.cancelled === 1 &&
    summary.statuses.past_due === 1 &&
    summary.statuses.expired === 2 &&
    summary.statuses.trialing === 1 &&
    summary.statuses.implicit_free === 1,
  JSON.stringify(summary.statuses)
);
assert(
  "attention is exactly {past_due, cancelled, expired} ∪ {no active owner} — trialing is mid-funnel, not a problem",
  summary.attention === 4,
  `attention: ${summary.attention}`
);
assert(
  "the summary follows the filter, not the page (PRO query, page of 1)",
  proOnly.summary.workspaces === 1 && proOnly.items.length === 1,
  `workspaces: ${proOnly.summary.workspaces}, items: ${proOnly.items.length}`
);

// ============================================================
console.log("\n-- ADMIN-SUBS-07: the 027-agreement invariant ------------");
// ============================================================
// 029's plan/has_subscription use 027's predicate verbatim. This reads
// both lists and compares per workspace: if either function drifts, the
// two screens contradict each other and this fails loudly.
const wsList = (
  await db.query(
    `select public.admin_workspaces_list(null,'all','created_at','desc',1,100) as r`
  )
).rows[0].r;
const wsById = Object.fromEntries(wsList.items.map((i) => [i.workspace_id, i]));
const full = await readSubs(`null,'all','all','plan','desc',1,100`);
const disagreements = full.items
  .filter((i) => wsById[i.workspace_id])
  .filter(
    (i) =>
      wsById[i.workspace_id].plan !== i.plan ||
      wsById[i.workspace_id].has_subscription !== i.has_subscription
  )
  .map((i) => i.workspace_id);
assert(
  "029 agrees with 027 on every workspace's plan and has_subscription",
  disagreements.length === 0,
  disagreements.join(", ") || `${full.items.length} workspaces compared`
);

// ============================================================
console.log("\n-- ADMIN-SUBS-08: the security posture ------------------");
// ============================================================
const privs = await db.query(`
  select p.proname,
         has_function_privilege('public', p.oid, 'EXECUTE') as pub,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
         has_function_privilege('service_role', p.oid, 'EXECUTE') as svc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_subscriptions_list'
`);
assert(
  "admin_subscriptions_list exists exactly once",
  privs.rows.length === 1,
  `rows: ${privs.rows.length}`
);
if (privs.rows.length === 1) {
  const row = privs.rows[0];
  assert("no PUBLIC EXECUTE", row.pub === false, JSON.stringify(row));
  assert("no anon EXECUTE", row.anon === false, JSON.stringify(row));
  assert(
    "authenticated EXECUTE only (the app's role, service_role gets nothing)",
    row.auth === true && row.svc === false,
    JSON.stringify(row)
  );
}

const spath = await db.query(`
  select coalesce((select a from unnest(p.proconfig) a where a like 'search_path%'), '(none)') as sp
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_subscriptions_list'
`);
assert(
  "the function pins search_path including pg_temp",
  spath.rows.length === 1 && spath.rows[0].sp.includes("pg_temp"),
  spath.rows.map((r) => r.sp).join(",")
);

const dyn = await db.query(`
  select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_subscriptions_list'
    and p.prosrc ~* 'to_regclass|execute[[:space:]]+format|format[(]''%I'
`);
assert(
  "the function builds no SQL from caller input (CASE whitelists only)",
  dyn.rows.length === 0,
  dyn.rows.map((r) => r.proname).join(", ") || "none"
);

const dml = await db.query(`
  select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_subscriptions_list'
    and p.prosrc ~* '(insert[[:space:]]+into|update[[:space:]]+public|delete[[:space:]]+from|truncate)'
`);
assert(
  "the subscriptions reader contains no writes",
  dml.rows.length === 0,
  dml.rows.map((r) => r.proname).join(", ") || "none"
);

await asUser(null);
await asRole(null);

// ---- summary -------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
