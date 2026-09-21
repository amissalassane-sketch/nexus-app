/**
 * ============================================================
 * NEXUS — SUBSCRIPTION & BILLING CONTRACT TESTS (PR #71)
 * ============================================================
 * Local PGlite behaviour suite for
 *   supabase/migrations/20260915220000_nexus_subscription_contract.sql
 * It applies the same lineage as freemium-contract.test.mjs (fixture +
 * post-base migrations, admin suites and the three earlier 2026 contract
 * files omitted — their own suites own those contracts), plus the
 * Supabase-style roles/default-privileges emulation the admin suites use,
 * so EXECUTE assertions are meaningful.
 *
 * Covered, per the PR brief:
 *   1  contract objects installed (status vocabulary incl. 'expired',
 *      unique partial index, definer posture, ACLs)
 *   2  bootstrap: creation, repetition, idempotence, no duplicate active
 *   3  plans FREE / PRO / TEAM and every transition
 *      (FREE->PRO, PRO->TEAM, TEAM->PRO, PRO->FREE, cancel, expire)
 *   4  periods: paid activation requires a future current_period_end,
 *      lapsed periods stop granting the plan everywhere
 *   5  abnormal cases: absent / inactive / cancelled / expired /
 *      incoherent subscriptions, historical rows, second-active attempt
 *   6  coherence: get_workspace_plan / get_owner_plan === the frontend
 *      mirror (src/lib/billing/subscription-state.ts) === what the
 *      PR #70 write guards enforce
 *   7  concurrency mechanisms available locally (advisory lock usage +
 *      the unique partial index). PGlite runs on ONE backend, so a true
 *      multi-session race is a deployment-level integration test and is
 *      deliberately NOT claimed as proven here.
 *   8  security: user-JWT context is refused, client roles hold no
 *      EXECUTE, service_role is the only backend caller.
 *
 * No payment provider is involved anywhere; no remote project is touched.
 *
 * Run:  npm run test:subscription
 * ============================================================
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const { PLAN_LIMITS, highestPlan } = await import("../../src/lib/plan-limits.ts");
const {
  SUBSCRIPTION_STATUSES,
  isPeriodCurrent,
  isSubscriptionCurrent,
  effectivePlanOf,
  displayStatusOf,
} = await import("../../src/lib/billing/subscription-state.ts");

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const CONTRACT_MIGRATION = "20260915220000_nexus_subscription_contract.sql";
// Same omission rule as freemium-contract.test.mjs: the admin suites and
// the earlier 2026 contracts are owned by their own suites.
//
// 002–005 are skipped exactly like in the freemium suite: 002 inserts into
// storage.buckets (a Supabase-platform schema PGlite does not provide —
// 42P01), 003 needs the pgvector extension, and 004/005 build on the 003
// AI tables. Without the skips the whole suite aborts before the contract
// under test is ever applied; none of those four is owned by this test.
const SKIPPED = new Set([
  "002_nexus_storage.sql",
  "003_nexus_ai.sql",
  "004_nexus_automations.sql",
  "005_nexus_worker.sql",
  "026_admin_control_plane.sql",
  "027_admin_directory.sql",
  "028_admin_activity_security.sql",
  "029_admin_subscriptions.sql",
  "20260915130000_nexus_core_contract.sql",
  "20260915130500_nexus_lineage_reconciliation.sql",
  "20260915131000_nexus_auth_workspace_bootstrap.sql",
]);

const db = await PGlite.create();
let passed = 0;
let failed = 0;
let userSequence = 1;
let workspaceSequence = 1;

function ok(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

async function expectOk(label, run) {
  try {
    const value = await run();
    ok(label, true);
    return value;
  } catch (error) {
    ok(label, false, String(error.message).split("\n")[0]);
    return undefined;
  }
}

async function expectError(label, run, needle) {
  try {
    await run();
    ok(label, false, "expected an error, the statement succeeded");
  } catch (error) {
    const message = String(error.message);
    ok(label, message.includes(needle), `got: ${message.split("\n")[0]}`);
  }
}

async function expectLimit(label, run, resource) {
  try {
    await run();
    ok(label, false, "the write succeeded above the plan limit");
  } catch (error) {
    const message = String(error.message);
    ok(
      label,
      message.includes("PLAN_LIMIT_EXCEEDED") && message.includes(resource),
      `got: ${message.split("\n")[0]}`
    );
  }
}

async function asUser(userId, run) {
  await db.query("select set_config('test.current_user_id', $1, false)", [userId ?? ""]);
  try {
    return await run();
  } finally {
    await db.query("select set_config('test.current_user_id', '', false)", []);
  }
}

function nextUser() {
  const head = userSequence.toString(16).padStart(8, "0");
  const suffix = userSequence.toString(16).padStart(12, "0");
  userSequence += 1;
  return `${head}-0000-4000-8000-${suffix}`;
}

async function createUser(id = nextUser()) {
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, '{}'::jsonb)
     on conflict (id) do nothing`,
    [id, `${id.slice(0, 8)}@nexus.test`]
  );
  return id;
}

/** A fresh owner with exactly one bootstrapped personal workspace. */
async function bootstrappedOwner() {
  const ownerId = await createUser();
  const ws = await db.query(
    `select id from public.workspaces where owner_id = $1 order by created_at, id limit 1`,
    [ownerId]
  );
  return { ownerId, workspaceId: ws.rows[0]?.id ?? null };
}

async function activeRows(workspaceId) {
  const result = await db.query(
    `select id, plan, status, current_period_end
       from public.workspace_subscriptions
      where workspace_id = $1 and status = 'active'`,
    [workspaceId]
  );
  return result.rows;
}

async function allRows(workspaceId) {
  const result = await db.query(
    `select id, plan, status, current_period_end
       from public.workspace_subscriptions
      where workspace_id = $1
      order by created_at, id`,
    [workspaceId]
  );
  return result.rows;
}

async function dbPlan(workspaceId) {
  const result = await db.query("select public.get_workspace_plan($1) as plan", [workspaceId]);
  return result.rows[0]?.plan;
}

async function dbOwnerPlan(ownerId) {
  const result = await db.query("select public.get_owner_plan($1) as plan", [ownerId]);
  return result.rows[0]?.plan;
}

async function disableTriggers(table, run) {
  await db.exec(`alter table public.${table} disable trigger user`);
  try {
    return await run();
  } finally {
    await db.exec(`alter table public.${table} enable trigger user`);
  }
}

async function seedProjects(workspaceId, count) {
  if (count <= 0) return;
  await disableTriggers("projects", () =>
    db.query(
      `insert into public.projects (workspace_id, name, slug)
       select $1, 'sub-project-' || g, 'sub-project-${workspaceSequence}-' || g
         from generate_series(1, $2) g`,
      [workspaceId, count]
    )
  );
}

const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

// ------------------------------------------------------------
// Local lineage setup (freemium harness + Supabase role emulation)
// ------------------------------------------------------------
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

alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
`);
await db.exec(readFileSync(join(here, "00_base_schema_fixture.sql"), "utf8"));
await db.exec("grant usage on schema auth to anon, authenticated, service_role;");

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql") && !file.startsWith("001_"))
  .filter((file) => !SKIPPED.has(file))
  .sort();
let contractApplied = false;
for (const file of migrations) {
  const sql = readFileSync(join(migrationsDir, file), "utf8").replace(
    /create extension if not exists pgcrypto;\s*/gi,
    ""
  );
  await db.exec(sql);
  if (file === CONTRACT_MIGRATION) contractApplied = true;
}
ok("the subscription contract migration applies on the local lineage", contractApplied);

// ------------------------------------------------------------
console.log("\n-- 1. contract objects are installed ---------------------");
// ------------------------------------------------------------
const statusConstraint = await db.query(`
  select pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.conrelid = 'public.workspace_subscriptions'::regclass
     and c.contype = 'c' and a.attname = 'status'`);
const constraintDef = statusConstraint.rows[0]?.def ?? "";
ok(
  "the status check constraint allows exactly the contract vocabulary",
  statusConstraint.rows.length === 1 &&
    SUBSCRIPTION_STATUSES.every((status) => constraintDef.includes(`'${status}'`)) &&
    !constraintDef.includes("'retired'"),
  constraintDef
);
ok(
  "the vocabulary is active|cancelled|expired|past_due|trialing",
  JSON.stringify(SUBSCRIPTION_STATUSES) ===
    JSON.stringify(["active", "cancelled", "expired", "past_due", "trialing"])
);

const activeIndex = await db.query(`
  select indexdef from pg_indexes
   where schemaname = 'public'
     and tablename = 'workspace_subscriptions'
     and indexname = 'workspace_subscriptions_active_workspace_idx'`);
ok(
  "the one-active-per-workspace unique partial index is installed",
  activeIndex.rows.length === 1 &&
    activeIndex.rows[0].indexdef.includes("UNIQUE") &&
    activeIndex.rows[0].indexdef.includes("status = 'active'"),
  activeIndex.rows[0]?.indexdef ?? "(missing)"
);

const noPeriodStart = await db.query(`
  select count(*)::int as n from information_schema.columns
   where table_schema = 'public' and table_name = 'workspace_subscriptions'
     and column_name = 'current_period_start'`);
ok(
  "no current_period_start column was invented (audit pinned: only current_period_end exists)",
  noPeriodStart.rows[0]?.n === 0
);

const contractFunctions = [
  "public.get_workspace_plan(uuid)",
  "public.get_owner_plan(uuid)",
  "public.set_workspace_plan(uuid, text, timestamp with time zone)",
  "public.upgrade_workspace_plan(uuid, text, timestamp with time zone)",
  "public.downgrade_workspace_plan(uuid, text, timestamp with time zone)",
  "public.cancel_workspace_subscription(uuid)",
  "public.expire_workspace_subscription(uuid)",
  "public.expire_lapsed_subscriptions()",
];
const helperSignatures = contractFunctions.slice(2);
for (const signature of contractFunctions) {
  const result = await db.query(
    `select p.prosecdef, p.proconfig,
            has_function_privilege('public', $1::regprocedure, 'EXECUTE') as pub_exec,
            has_function_privilege('anon', $1::regprocedure, 'EXECUTE') as anon_exec,
            has_function_privilege('authenticated', $1::regprocedure, 'EXECUTE') as auth_exec,
            has_function_privilege('service_role', $1::regprocedure, 'EXECUTE') as svc_exec
       from pg_proc p where p.oid = $1::regprocedure`,
    [signature]
  );
  const row = result.rows[0];
  ok(
    `${signature} is SECURITY DEFINER with pinned search_path`,
    row?.prosecdef === true && row?.proconfig?.includes("search_path=public, pg_temp")
  );
  ok(
    `${signature} is not executable by public/anon/authenticated`,
    row?.pub_exec === false && row?.anon_exec === false && row?.auth_exec === false
  );
  if (helperSignatures.includes(signature)) {
    ok(`${signature} is executable by service_role only (backend)`, row?.svc_exec === true);
  }
}
const usageAcl = await db.query(
  `select has_function_privilege('authenticated', 'public.get_workspace_usage(uuid)', 'EXECUTE') as exec`
);
ok("get_workspace_usage stays the one client-facing read (PR #70 posture)", usageAcl.rows[0]?.exec === true);

// ------------------------------------------------------------
console.log("\n-- 2. bootstrap: creation, repetition, idempotence -------");
// ------------------------------------------------------------
const boot = await bootstrappedOwner();
ok("signup created exactly one personal workspace", Boolean(boot.workspaceId));
const bootRows = await allRows(boot.workspaceId);
ok(
  "signup created exactly one subscription row: FREE active",
  bootRows.length === 1 && bootRows[0].plan === "FREE" && bootRows[0].status === "active"
);

const firstSubId = bootRows[0]?.id;
for (let i = 0; i < 3; i += 1) {
  await db.query("select public.bootstrap_personal_workspace($1)", [boot.ownerId]);
}
const repeatedRows = await allRows(boot.workspaceId);
const wsCount = await db.query(
  `select count(*)::int as n from public.workspaces where owner_id = $1`,
  [boot.ownerId]
);
ok(
  "bootstrap x3 still yields 1 workspace / 1 subscription / 1 active (idempotent, no duplicates)",
  wsCount.rows[0]?.n === 1 &&
    repeatedRows.length === 1 &&
    repeatedRows[0].id === firstSubId &&
    (await activeRows(boot.workspaceId)).length === 1
);

await db.query(`delete from public.workspace_subscriptions where workspace_id = $1`, [
  boot.workspaceId,
]);
await db.query("select public.bootstrap_personal_workspace($1)", [boot.ownerId]);
const repaired = await allRows(boot.workspaceId);
ok(
  "bootstrap repairs a deleted subscription to exactly one FREE active row",
  repaired.length === 1 && repaired[0].plan === "FREE" && repaired[0].status === "active"
);

// trg_default_subscription stays installed and gives every directly
// inserted workspace its own FREE active row (kept per the PR brief).
const triggerInfo = await db.query(`
  select count(*)::int as n from pg_trigger t
   where t.tgname = 'trg_default_subscription'
     and t.tgrelid = 'public.workspaces'::regclass and not t.tgisinternal`);
ok("trg_default_subscription is preserved on public.workspaces", triggerInfo.rows[0]?.n === 1);
await db.query("select public.set_workspace_plan($1, 'PRO', $2::timestamptz)", [
  boot.workspaceId,
  inDays(30),
]);
const extraWs = (
  await db.query(
    `insert into public.workspaces (owner_id, name, slug)
     values ($1, 'Second workspace', 'second-workspace-${workspaceSequence++}') returning id`,
    [boot.ownerId]
  )
).rows[0].id;
const extraRows = await activeRows(extraWs);
ok(
  "a directly inserted workspace gets its own FREE active row from the trigger",
  extraRows.length === 1 && extraRows[0].plan === "FREE" && extraRows[0].status === "active"
);
ok("owner plan is the highest current plan across workspaces (PRO)", (await dbOwnerPlan(boot.ownerId)) === "PRO");

// ------------------------------------------------------------
console.log("\n-- 3. plans and transitions ------------------------------");
// ------------------------------------------------------------
const t = await bootstrappedOwner();
ok("new workspace resolves FREE in DB", (await dbPlan(t.workspaceId)) === "FREE");

const subIdFree = (await activeRows(t.workspaceId))[0]?.id;
const upPro = await expectOk("FREE -> PRO via upgrade_workspace_plan", () =>
  db.query("select public.upgrade_workspace_plan($1, 'PRO', $2::timestamptz) as id", [
    t.workspaceId,
    inDays(30),
  ])
);
let rows = await activeRows(t.workspaceId);
ok(
  "FREE -> PRO leaves exactly one active row on PRO with a future period",
  rows.length === 1 &&
    rows[0].plan === "PRO" &&
    rows[0].status === "active" &&
    new Date(rows[0].current_period_end) > new Date() &&
    rows[0].id === subIdFree &&
    upPro?.rows[0]?.id === subIdFree
);
ok("get_workspace_plan follows the transition (PRO)", (await dbPlan(t.workspaceId)) === "PRO");
ok("get_owner_plan follows the transition (PRO)", (await dbOwnerPlan(t.ownerId)) === "PRO");

await expectOk("PRO -> TEAM via upgrade_workspace_plan", () =>
  db.query("select public.upgrade_workspace_plan($1, 'TEAM', $2::timestamptz)", [
    t.workspaceId,
    inDays(30),
  ])
);
rows = await activeRows(t.workspaceId);
ok("PRO -> TEAM: one active TEAM row", rows.length === 1 && rows[0].plan === "TEAM");
ok("get_workspace_plan === TEAM", (await dbPlan(t.workspaceId)) === "TEAM");

await expectOk("TEAM -> PRO via downgrade_workspace_plan", () =>
  db.query("select public.downgrade_workspace_plan($1, 'PRO', $2::timestamptz)", [
    t.workspaceId,
    inDays(30),
  ])
);
rows = await activeRows(t.workspaceId);
ok("TEAM -> PRO: one active PRO row", rows.length === 1 && rows[0].plan === "PRO");

await expectOk("PRO -> FREE via downgrade_workspace_plan (default FREE)", () =>
  db.query("select public.downgrade_workspace_plan($1)", [t.workspaceId])
);
rows = await activeRows(t.workspaceId);
ok(
  "PRO -> FREE: one active FREE row with no billing period (FREE never lapses)",
  rows.length === 1 && rows[0].plan === "FREE" && rows[0].current_period_end === null
);
ok("get_workspace_plan === FREE after downgrade", (await dbPlan(t.workspaceId)) === "FREE");

// Direction guards — an "upgrade" never moves sideways or down.
await expectError(
  "upgrade FREE -> FREE is refused (BILLING_TRANSITION_INVALID)",
  () => db.query("select public.upgrade_workspace_plan($1, 'FREE', $2::timestamptz)", [t.workspaceId, inDays(30)]),
  "BILLING_TRANSITION_INVALID"
);
await db.query("select public.set_workspace_plan($1, 'PRO', $2::timestamptz)", [t.workspaceId, inDays(30)]);
await expectError(
  "upgrade PRO -> PRO (renewal) is refused by the direction check",
  () => db.query("select public.upgrade_workspace_plan($1, 'PRO', $2::timestamptz)", [t.workspaceId, inDays(60)]),
  "BILLING_TRANSITION_INVALID"
);
await expectError(
  "upgrade PRO -> FREE is refused by the direction check",
  () => db.query("select public.upgrade_workspace_plan($1, 'FREE', $2::timestamptz)", [t.workspaceId, inDays(30)]),
  "BILLING_TRANSITION_INVALID"
);
await expectError(
  "downgrade PRO -> TEAM is refused by the direction check",
  () => db.query("select public.downgrade_workspace_plan($1, 'TEAM', $2::timestamptz)", [t.workspaceId, inDays(30)]),
  "BILLING_TRANSITION_INVALID"
);
await expectError(
  "an arbitrary plan name is refused (BILLING_PLAN_INVALID)",
  () => db.query("select public.set_workspace_plan($1, 'PLATINUM', $2::timestamptz)", [t.workspaceId, inDays(30)]),
  "BILLING_PLAN_INVALID"
);
await expectError(
  "a NULL plan is refused (BILLING_PLAN_INVALID)",
  () => db.query("select public.set_workspace_plan($1, null, null)", [t.workspaceId]),
  "BILLING_PLAN_INVALID"
);
await expectError(
  "an unknown workspace is refused (WORKSPACE_NOT_FOUND)",
  () => db.query("select public.set_workspace_plan($1, 'PRO', $2::timestamptz)", [nextUser(), inDays(30)]),
  "WORKSPACE_NOT_FOUND"
);
rows = await activeRows(t.workspaceId);
ok("refused transitions left the single active PRO row untouched", rows.length === 1 && rows[0].plan === "PRO");

// Renewal through the core helper: same plan, new period, same row.
const renewed = await expectOk("set_workspace_plan renews PRO with a new period", () =>
  db.query("select public.set_workspace_plan($1, 'PRO', $2::timestamptz) as id", [t.workspaceId, inDays(60)])
);
rows = await activeRows(t.workspaceId);
ok(
  "renewal is an in-place update: one active PRO row, period moved, same id",
  rows.length === 1 &&
    rows[0].plan === "PRO" &&
    rows[0].id === renewed?.rows[0]?.id
);

// FREE normalizes any passed period to NULL.
await db.query("select public.set_workspace_plan($1, 'FREE', $2::timestamptz)", [t.workspaceId, inDays(-5)]);
rows = await activeRows(t.workspaceId);
ok(
  "FREE activation normalizes an incoherent period to NULL and stays current",
  rows.length === 1 && rows[0].plan === "FREE" && rows[0].current_period_end === null &&
    (await dbPlan(t.workspaceId)) === "FREE"
);

// ------------------------------------------------------------
console.log("\n-- 4. cancel ---------------------------------------------");
// ------------------------------------------------------------
const c = await bootstrappedOwner();
await db.query("select public.set_workspace_plan($1, 'PRO', $2::timestamptz)", [c.workspaceId, inDays(30)]);
const cancelledId = await expectOk("cancel an active PRO subscription", () =>
  db.query("select public.cancel_workspace_subscription($1) as id", [c.workspaceId])
);
let cRows = await allRows(c.workspaceId);
ok(
  "PRO active -> PRO cancelled: the row keeps its history, nothing active remains",
  cRows.length === 1 &&
    cRows[0].id === cancelledId?.rows[0]?.id &&
    cRows[0].status === "cancelled" &&
    cRows[0].plan === "PRO" &&
    (await activeRows(c.workspaceId)).length === 0
);
ok("cancelled != active: get_workspace_plan falls back to FREE", (await dbPlan(c.workspaceId)) === "FREE");
ok("cancelled != active: get_owner_plan falls back to FREE", (await dbOwnerPlan(c.ownerId)) === "FREE");
const cancelAgain = await db.query("select public.cancel_workspace_subscription($1) as id", [c.workspaceId]);
ok("cancel is idempotent (NULL when nothing active remains)", cancelAgain.rows[0]?.id === null);

// The write guards immediately enforce FREE after cancellation.
await seedProjects(c.workspaceId, PLAN_LIMITS.FREE.projects);
await expectLimit(
  "write guards enforce FREE limits right after cancellation",
  () => db.query(`insert into public.projects (workspace_id, name, slug) values ($1, 'over', 'cancel-over')`, [c.workspaceId]),
  "projects"
);

// Bootstrap repairs a cancelled workspace with a fresh FREE active row;
// the cancelled PRO row is preserved as history (never deleted).
await db.query("select public.bootstrap_personal_workspace($1)", [c.ownerId]);
cRows = await allRows(c.workspaceId);
ok(
  "bootstrap after cancel: history preserved, exactly one new FREE active row",
  cRows.length === 2 &&
    cRows.some((r) => r.status === "cancelled" && r.plan === "PRO") &&
    cRows.some((r) => r.status === "active" && r.plan === "FREE") &&
    (await activeRows(c.workspaceId)).length === 1
);

// Re-subscribing after cancel goes through the same one-active guarantee.
await db.query("select public.upgrade_workspace_plan($1, 'PRO', $2::timestamptz)", [c.workspaceId, inDays(30)]);
cRows = await allRows(c.workspaceId);
ok(
  "re-subscribe after cancel: PRO active again, still exactly one active row",
  cRows.length === 2 &&
    cRows.filter((r) => r.status === "active").length === 1 &&
    cRows.find((r) => r.status === "active")?.plan === "PRO" &&
    (await dbPlan(c.workspaceId)) === "PRO"
);

// ------------------------------------------------------------
console.log("\n-- 5. expiry and periods ----------------------------------");
// ------------------------------------------------------------
const e = await bootstrappedOwner();
await db.query("select public.set_workspace_plan($1, 'PRO', $2::timestamptz)", [e.workspaceId, inDays(30)]);
// Simulate time passing: the period lapses while the row still says active.
await db.query(
  `update public.workspace_subscriptions
      set current_period_end = now() - interval '1 day'
    where workspace_id = $1 and status = 'active'`,
  [e.workspaceId]
);
ok(
  "a lapsed 'active' row stops granting its plan immediately (no sweeper needed)",
  (await dbPlan(e.workspaceId)) === "FREE"
);
ok(
  "the owner plan is deterministic while the period is lapsed",
  (await dbOwnerPlan(e.ownerId)) === "FREE"
);
await seedProjects(e.workspaceId, PLAN_LIMITS.FREE.projects);
await expectLimit(
  "write guards enforce FREE while an 'active' PRO row is lapsed",
  () => db.query(`insert into public.projects (workspace_id, name, slug) values ($1, 'over', 'lapsed-over')`, [e.workspaceId]),
  "projects"
);
const lapsedRow = (await activeRows(e.workspaceId))[0];
ok(
  "the frontend mirror resolves the same lapsed row to FREE and displays expired",
  effectivePlanOf(lapsedRow) === "FREE" && displayStatusOf(lapsedRow) === "expired"
);

const expiredId = await expectOk("expire_workspace_subscription materializes status='expired'", () =>
  db.query("select public.expire_workspace_subscription($1) as id", [e.workspaceId])
);
let eRows = await allRows(e.workspaceId);
ok(
  "PRO active -> PRO expired: stored status now matches reality, history kept",
  eRows.length === 1 &&
    eRows[0].id === expiredId?.rows[0]?.id &&
    eRows[0].status === "expired" &&
    eRows[0].plan === "PRO"
);
ok("expired != active: plan stays FREE", (await dbPlan(e.workspaceId)) === "FREE");
const expireAgain = await db.query("select public.expire_workspace_subscription($1) as id", [e.workspaceId]);
ok("expire is idempotent (NULL when the row is already closed)", expireAgain.rows[0]?.id === null);

// Expiry must not fire inside a running period (that would be a cancel).
const live = await bootstrappedOwner();
await db.query("select public.set_workspace_plan($1, 'PRO', $2::timestamptz)", [live.workspaceId, inDays(30)]);
const notExpired = await db.query("select public.expire_workspace_subscription($1) as id", [live.workspaceId]);
ok(
  "a PRO row inside its period is NOT expired by the helper (still active)",
  notExpired.rows[0]?.id === null && (await activeRows(live.workspaceId))[0]?.status === "active"
);

// Maintenance sweep across workspaces.
const sweepA = await bootstrappedOwner();
const sweepB = await bootstrappedOwner();
const sweepC = await bootstrappedOwner();
for (const [w, plan] of [[sweepA.workspaceId, "PRO"], [sweepB.workspaceId, "TEAM"], [sweepC.workspaceId, "PRO"]]) {
  await db.query("select public.set_workspace_plan($1, $2, $3::timestamptz)", [w, plan, inDays(30)]);
}
for (const w of [sweepA.workspaceId, sweepB.workspaceId]) {
  await db.query(
    `update public.workspace_subscriptions set current_period_end = now() - interval '2 days'
      where workspace_id = $1 and status = 'active'`,
    [w]
  );
}
const swept = await db.query("select public.expire_lapsed_subscriptions() as n");
ok("the sweep expires exactly the two lapsed rows", Number(swept.rows[0]?.n) === 2, JSON.stringify(swept.rows[0]));
const sweepStates = await db.query(
  `select workspace_id::text as ws, status from public.workspace_subscriptions
    where workspace_id = any($1::uuid[]) and plan <> 'FREE'`,
  [[sweepA.workspaceId, sweepB.workspaceId, sweepC.workspaceId]]
);
const statusOf = (ws) => sweepStates.rows.find((r) => r.ws === ws)?.status;
ok(
  "sweep result: lapsed rows expired, the current row untouched",
  statusOf(sweepA.workspaceId) === "expired" &&
    statusOf(sweepB.workspaceId) === "expired" &&
    statusOf(sweepC.workspaceId) === "active"
);
const sweptAgain = await db.query("select public.expire_lapsed_subscriptions() as n");
ok("the sweep is idempotent (0 on the second run)", Number(sweptAgain.rows[0]?.n) === 0);

// Period activation rules.
const p = await bootstrappedOwner();
await expectError(
  "activating PRO without a period end is refused (BILLING_PERIOD_INVALID)",
  () => db.query("select public.set_workspace_plan($1, 'PRO', null)", [p.workspaceId]),
  "BILLING_PERIOD_INVALID"
);
await expectError(
  "activating PRO with a past period end is refused (never activate already lapsed)",
  () => db.query("select public.set_workspace_plan($1, 'PRO', $2::timestamptz)", [p.workspaceId, inDays(-1)]),
  "BILLING_PERIOD_INVALID"
);
await expectError(
  "upgrading to TEAM without a period end is refused",
  () => db.query("select public.upgrade_workspace_plan($1, 'TEAM', null)", [p.workspaceId]),
  "BILLING_PERIOD_INVALID"
);
ok(
  "refused activations left the workspace on its bootstrapped FREE row",
  (await dbPlan(p.workspaceId)) === "FREE" && (await activeRows(p.workspaceId)).length === 1
);
ok(
  "pure mirror: isPeriodCurrent fails closed on garbage and past, open on NULL/future",
  isPeriodCurrent(null) === true &&
    isPeriodCurrent("") === true &&
    isPeriodCurrent(inDays(1)) === true &&
    isPeriodCurrent(inDays(-1)) === false &&
    isPeriodCurrent("not-a-date") === false
);

// ------------------------------------------------------------
console.log("\n-- 6. abnormal cases --------------------------------------");
// ------------------------------------------------------------
const none = await bootstrappedOwner();
await db.query(`delete from public.workspace_subscriptions where workspace_id = $1`, [none.workspaceId]);
ok("absent subscription: get_workspace_plan FREE", (await dbPlan(none.workspaceId)) === "FREE");
ok("absent subscription: get_owner_plan FREE", (await dbOwnerPlan(none.ownerId)) === "FREE");
ok("absent subscription: frontend mirror FREE", effectivePlanOf(null) === "FREE" && displayStatusOf(null) === null);
await seedProjects(none.workspaceId, PLAN_LIMITS.FREE.projects);
await expectLimit(
  "absent subscription: guards enforce FREE",
  () => db.query(`insert into public.projects (workspace_id, name, slug) values ($1, 'over', 'none-over')`, [none.workspaceId]),
  "projects"
);

// Every non-active status fails closed, in DB and in the mirror.
for (const status of ["cancelled", "expired", "past_due", "trialing"]) {
  const w = await bootstrappedOwner();
  await db.query(
    `update public.workspace_subscriptions set status = $1, plan = 'TEAM' where workspace_id = $2`,
    [status, w.workspaceId]
  );
  const row = (await allRows(w.workspaceId))[0];
  ok(
    `status '${status}' never grants capacity (DB FREE, mirror FREE, not current)`,
    (await dbPlan(w.workspaceId)) === "FREE" &&
      effectivePlanOf(row) === "FREE" &&
      isSubscriptionCurrent(row) === false
  );
}

const incoherent = await bootstrappedOwner();
await db.query(
  `update public.workspace_subscriptions set plan = 'INVALID' where workspace_id = $1`,
  [incoherent.workspaceId]
);
const incoherentRow = (await allRows(incoherent.workspaceId))[0];
ok(
  "an incoherent active plan fails closed to FREE in DB and mirror",
  (await dbPlan(incoherent.workspaceId)) === "FREE" && effectivePlanOf(incoherentRow) === "FREE"
);
await expectError(
  "the helpers can never store an incoherent plan",
  () => db.query("select public.set_workspace_plan($1, 'ENTERPRISE', $2::timestamptz)", [incoherent.workspaceId, inDays(30)]),
  "BILLING_PLAN_INVALID"
);

// A second active row is impossible, even by direct write.
const dup = await bootstrappedOwner();
await expectError(
  "a direct second active INSERT violates the unique partial index",
  () =>
    db.query(
      `insert into public.workspace_subscriptions (workspace_id, plan, status)
       values ($1, 'PRO', 'active')`,
      [dup.workspaceId]
    ),
  "duplicate key"
);
ok("the workspace still has exactly one active row", (await activeRows(dup.workspaceId)).length === 1);

// History: several closed rows + exactly one current row is acceptable.
const hist = await bootstrappedOwner();
const histRow = (await activeRows(hist.workspaceId))[0].id;
await db.query(
  `update public.workspace_subscriptions set status = 'expired' where id = $1`,
  [histRow]
);
await db.query(
  `insert into public.workspace_subscriptions (workspace_id, plan, status)
   values ($1, 'PRO', 'cancelled')`,
  [hist.workspaceId]
);
await db.query("select public.set_workspace_plan($1, 'PRO', $2::timestamptz)", [hist.workspaceId, inDays(30)]);
const histRows = await allRows(hist.workspaceId);
ok(
  "history FREE expired / PRO cancelled / PRO active resolves deterministically to PRO",
  histRows.length === 3 &&
    (await activeRows(hist.workspaceId)).length === 1 &&
    (await dbPlan(hist.workspaceId)) === "PRO"
);

// ------------------------------------------------------------
console.log("\n-- 7. DB <-> frontend coherence ---------------------------");
// ------------------------------------------------------------
// For every state built above, the plan the DB grants must equal what the
// frontend mirror computes from the same row, and what the write guards
// consume (they call the same get_workspace_plan).
const coherence = await db.query(
  `select s.workspace_id::text as ws, s.plan, s.status, s.current_period_end,
          public.get_workspace_plan(s.workspace_id) as db_plan
     from public.workspace_subscriptions s
     where s.status = 'active'`
);
let coherent = true;
for (const row of coherence.rows) {
  if (effectivePlanOf(row) !== row.db_plan) {
    coherent = false;
    console.log(`        divergence: ${JSON.stringify(row)}`);
  }
}
ok(
  `every active row (${coherence.rows.length}) resolves identically in DB and frontend mirror`,
  coherent
);
const ownerCoherence = await db.query(`
  select w.owner_id::text as owner,
         public.get_owner_plan(w.owner_id) as db_plan
    from public.workspaces w
   group by w.owner_id`);
let ownersCoherent = true;
for (const { owner, db_plan: dbPlanValue } of ownerCoherence.rows) {
  const subRows = await db.query(
    `select s.plan, s.status, s.current_period_end
       from public.workspace_subscriptions s
       join public.workspaces w2 on w2.id = s.workspace_id
      where w2.owner_id = $1::uuid and s.status = 'active'`,
    [owner]
  );
  const mirror = highestPlan(
    subRows.rows.filter((r) => isSubscriptionCurrent(r)).map((r) => r.plan)
  );
  if (mirror !== dbPlanValue) {
    ownersCoherent = false;
    console.log(`        divergence for ${owner}: db=${dbPlanValue} mirror=${mirror}`);
  }
}
ok(
  `get_owner_plan matches the frontend highest-current-plan rule for all ${ownerCoherence.rows.length} owners`,
  ownersCoherent
);

// ------------------------------------------------------------
console.log("\n-- 8. concurrency mechanisms (single-backend scope) -------");
// ------------------------------------------------------------
// PGlite runs this suite on ONE backend: a true two-session race cannot be
// reproduced here and is NOT claimed. What is proven locally: every
// mutating helper serializes on the same transaction-scoped advisory lock
// primitive the PR #70 guards use (directly, or by delegating to the
// locked core set_workspace_plan), the lock key is released at commit, and
// the unique partial index (section 1) is the hard one-active guarantee
// that holds even if two sessions race past the lock.
for (const signature of helperSignatures) {
  const body = await db.query("select pg_get_functiondef($1::regprocedure) as src", [signature]);
  const src = body.rows[0]?.src ?? "";
  const serialized =
    signature === "public.expire_lapsed_subscriptions()" || // single atomic UPDATE
    src.includes("pg_advisory_xact_lock") || // locks directly
    src.includes("public.set_workspace_plan("); // delegates to the locked core
  ok(
    `${signature} serializes per workspace (advisory xact lock, locked core delegation, or a single atomic UPDATE)`,
    Boolean(serialized)
  );
}
const lockKey = `subscription-test:${nextUser()}`;
const lockInTx = await db.transaction(async (tx) => {
  const r = await tx.query(
    `select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as acquired`,
    [lockKey]
  );
  const inner = await tx.query(
    `select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as reacquired`,
    [lockKey]
  );
  return r.rows[0]?.acquired === true && inner.rows[0]?.reacquired === true;
});
const lockAfter = await db.query(
  `select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as acquired`,
  [lockKey]
);
ok(
  "the transaction-scoped lock primitive is held inside the tx and free after commit",
  lockInTx && lockAfter.rows[0]?.acquired === true
);

// ------------------------------------------------------------
console.log("\n-- 9. security boundary -----------------------------------");
// ------------------------------------------------------------
const victim = await bootstrappedOwner();
await asUser(victim.ownerId, async () => {
  const period = inDays(30);
  for (const [name, sql, params] of [
    ["set_workspace_plan", `select public.set_workspace_plan($1, 'TEAM', $2::timestamptz)`, [victim.workspaceId, period]],
    ["upgrade_workspace_plan", `select public.upgrade_workspace_plan($1, 'TEAM', $2::timestamptz)`, [victim.workspaceId, period]],
    ["downgrade_workspace_plan", `select public.downgrade_workspace_plan($1)`, [victim.workspaceId]],
    ["cancel_workspace_subscription", `select public.cancel_workspace_subscription($1)`, [victim.workspaceId]],
    ["expire_workspace_subscription", `select public.expire_workspace_subscription($1)`, [victim.workspaceId]],
  ]) {
    await expectError(
      `a signed-in user context is refused by ${name} (BILLING_ACCESS_DENIED)`,
      () => db.query(sql, params),
      "BILLING_ACCESS_DENIED"
    );
  }
  await expectError(
    "a signed-in user context is refused by expire_lapsed_subscriptions",
    () => db.query("select public.expire_lapsed_subscriptions()"),
    "BILLING_ACCESS_DENIED"
  );
});
ok(
  "the refused user-context calls changed nothing",
  (await activeRows(victim.workspaceId)).length === 1 &&
    (await activeRows(victim.workspaceId))[0].plan === "FREE"
);

// Role-level ACL: with the Supabase default-privileges emulation active,
// the explicit revokes are what keep client roles out.
await db.exec("set role authenticated");
await expectError(
  "the authenticated role cannot execute set_workspace_plan (permission denied)",
  () => db.query("select public.set_workspace_plan($1, 'PRO', $2::timestamptz)", [victim.workspaceId, inDays(30)]),
  "permission denied"
);
await db.exec("reset role");
await db.exec("set role anon");
await expectError(
  "the anon role cannot execute cancel_workspace_subscription (permission denied)",
  () => db.query("select public.cancel_workspace_subscription($1)", [victim.workspaceId]),
  "permission denied"
);
await db.exec("reset role");
ok(
  "after both refusals the subscription is still the untouched FREE active row",
  (await activeRows(victim.workspaceId)).length === 1
);

// The DB stays the authority: the plan the guards enforce for every plan
// value equals the plan-limits table the frontend ships.
for (const plan of ["FREE", "PRO", "TEAM"]) {
  const w = await bootstrappedOwner();
  if (plan === "FREE") {
    ok("FREE needs no activation call", (await dbPlan(w.workspaceId)) === "FREE");
    continue;
  }
  await db.query("select public.set_workspace_plan($1, $2, $3::timestamptz)", [w.workspaceId, plan, inDays(30)]);
  const resolved = await dbPlan(w.workspaceId);
  const limit = await db.query("select public.get_plan_limit($1, 'projects') as limit", [resolved]);
  ok(
    `${plan}: resolved plan feeds get_plan_limit with the plan-limits.ts value`,
    resolved === plan && Number(limit.rows[0]?.limit) === PLAN_LIMITS[plan].projects
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
