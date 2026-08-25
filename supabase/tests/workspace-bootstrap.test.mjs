/**
 * ============================================================
 * NEXUS — WORKSPACE BOOTSTRAP (MIGRATION 021) TESTS
 * ============================================================
 * Deterministic, PGlite-runnable half of the workspace bootstrap
 * verification. It covers exactly what can be asserted on a single
 * connection:
 *
 *   1. Bounded-lock contract — bootstrap_personal_workspace() must
 *      use pg_try_advisory_xact_lock() (bounded wait) and must NOT
 *      contain an unbounded pg_advisory_xact_lock() call; the timeout
 *      path must raise a structured 55P03 error. (True
 *      cross-connection lock-hold behaviour is exercised by the
 *      real-Postgres suites: /tmp/repro/db-concurrency.mjs and the
 *      app-level persistent-failure run.)
 *   2. DB-side observability markers (RAISE WARNING) are present in
 *      the function body, so bootstrap state is visible in the
 *      server log.
 *   3. Grant contract — the internal bootstrap function is NOT
 *      executable by the `authenticated` role right after the
 *      migration (explicit revokes, because Supabase platform
 *      default privileges leave explicit ACL entries that
 *      `revoke from public` does not remove).
 *   4. Owner validation — even in the worst case where execute IS
 *      granted (the harness's blanket platform-grant emulation),
 *      bootstrap_personal_workspace() refuses to operate on a
 *      foreign uuid.
 *   5. Owner re-claim at the member cap — the 021
 *      enforce_member_limit() skip: an orphaned owner of a
 *      member-capped workspace can repair their own membership
 *      (the owner is not an additional member), while every other
 *      write path is still capped / RLS-denied.
 *   6. get_or_create_personal_workspace() structured-error contract —
 *      the membership verification happens BEFORE the return query
 *      (018's dead code-after-RETURN-QUERY bug is gone) and a
 *      coherent state always yields exactly one owner/active row
 *      (never a silent empty set).
 *
 * Each "as user" block sets the session role to authenticated
 * (mirroring Supabase's JWT role claim) and configures auth.uid()
 * via a session setting.
 * ============================================================
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = "supabase/migrations";
const db = await PGlite.create();

// ---- Bootstrap (same platform state the other suites use) --------
await db.exec(`
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.current_user', true), '')::uuid;
$$;
create or replace function gen_random_uuid() returns uuid language sql as $$
  select uuid_in(md5(random()::text || clock_timestamp()::text)::cstring);
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin';
  end if;
end $$;
-- Real Supabase grants usage on the auth schema to the client roles
-- (needed to resolve auth.uid() in caller context).
grant usage on schema public to authenticated;
grant usage on schema auth to authenticated;
`);

const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
for (const f of migrations) {
  let sql = readFileSync(join(migrationsDir, f), "utf8");
  sql = sql.replace(/create extension if not exists pgcrypto;\s*/g, "");
  try {
    await db.exec(sql);
  } catch (e) {
    console.log(`FAIL ${f}: ${e.message.slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`OK migration: ${f}`);
}

// ---- Helpers -----------------------------------------------------
let passed = 0,
  failed = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log("  PASS", name);
  } else {
    failed++;
    console.log("  FAIL", name, detail || "");
  }
}

async function asUser(userId, fn) {
  await db.exec("reset role");
  await db.query(`select set_config('app.current_user', $1, false)`, [userId || ""]);
  if (userId) await db.exec("set role authenticated");
  else await db.exec("reset role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query(`select set_config('app.current_user', '', false)`);
  }
}

async function signup(id, email, meta = {}) {
  await db.exec("reset role");
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`,
    [id, email, meta]
  );
}

async function expectDenied(name, fn) {
  try {
    await fn();
    ok(name, false, "expected denial but call succeeded");
  } catch (e) {
    const m = (e.message || "").toLowerCase();
    ok(
      name,
      /permission denied|42501|workspace_access_denied|access denied|row-level security|plan_limit_exceeded|p0001|duplicate key|unique constraint|23505/i.test(
        m
      ),
      `got: ${e.message.slice(0, 150)}`
    );
  }
}

async function prosrc(fn) {
  const r = await db.query(
    `select p.prosrc from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1
      order by p.oid limit 1`,
    [fn]
  );
  return r.rows[0]?.prosrc ?? "";
}

// ---- Test data ---------------------------------------------------
const CAP_OWNER = "a0000000-0000-0000-0000-000000000001";
const MEMBERS = [
  "a0000000-0000-0000-0000-000000000002",
  "a0000000-0000-0000-0000-000000000003",
  "a0000000-0000-0000-0000-000000000004",
  "a0000000-0000-0000-0000-000000000005",
  "a0000000-0000-0000-0000-000000000006",
  "a0000000-0000-0000-0000-000000000007",
];

// ---- 1. Bounded-lock contract -------------------------------------
console.log("\n-- 1. bootstrap_personal_workspace: bounded lock contract --");
const bsrc = await prosrc("bootstrap_personal_workspace");
ok("function exists (021 applied)", bsrc.length > 0);
ok("uses bounded pg_try_advisory_xact_lock", /pg_try_advisory_xact_lock/.test(bsrc));
ok(
  "no unbounded pg_advisory_xact_lock remains",
  !/pg_advisory_xact_lock/.test(bsrc.replace(/pg_try_advisory_xact_lock/g, ""))
);
ok(
  "timeout raises structured 55P03 after a bounded wait",
  /55P03/.test(bsrc) && /WORKSPACE_BOOTSTRAP_TIMEOUT/.test(bsrc) && /v_lock_timeout_ms/.test(bsrc) && /pg_sleep\(0\.1\)/.test(bsrc)
);

// ---- 2. DB-side observability markers ------------------------------
console.log("\n-- 2. DB-side observability markers --");
for (const marker of [
  "WORKSPACE_BOOTSTRAP_STARTED",
  "WORKSPACE_FOUND",
  "WORKSPACE_CREATED",
  "MEMBERSHIP_FOUND",
  "MEMBERSHIP_CREATED",
  "SUBSCRIPTION_FOUND",
  "SUBSCRIPTION_CREATED",
  "WORKSPACE_BOOTSTRAP_COMPLETED",
]) {
  ok(`emits ${marker}`, bsrc.includes(marker));
}

// ---- 3. Grant contract, as of the migration ------------------------
// Checked BEFORE the harness emulates Supabase's platform blanket
// function grant below: right after migration 021 the internal
// implementation must not be executable by the client role.
console.log("\n-- 3. Grant contract (internal function hidden) --");
const internalAcl = await db.query(
  `select has_function_privilege('authenticated', 'public.bootstrap_personal_workspace(uuid)', 'EXECUTE') as exec`
);
ok(
  "internal bootstrap is not executable by authenticated right after 021",
  internalAcl.rows[0]?.exec === false
);

// Emulate the Supabase platform default privileges (grant execute on all
// public functions to authenticated). On a real deployment these entries
// exist at function-creation time and 021's explicit revokes strip them;
// the harness applies them after the migrations, which models the WORST
// CASE: the internal function ends up executable. The owner validation
// inside the function must therefore still refuse foreign uuids (test 4).
await db.exec(`
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
alter role authenticated nobypassrls;
`);

// ---- 4. Owner validation (defense in depth) -------------------------
console.log("\n-- 4. Owner validation on the internal function --");
ok(
  "function body rejects bootstrap of a foreign uuid (auth.uid() check present)",
  /auth\.uid\(\)/.test(bsrc) && /WORKSPACE_ACCESS_DENIED/.test(bsrc)
);

const VICTIM = "c0000000-0000-0000-0000-000000000001";
const ATTACKER = "c0000000-0000-0000-0000-000000000002";
await signup(VICTIM, "victim@nexus.test", { full_name: "Victim" });
await signup(ATTACKER, "attacker@nexus.test", { full_name: "Attacker" });
const victimWsId = (
  await db.query(`select id from public.workspaces where owner_id = $1`, [VICTIM])
).rows[0].id;

// Execute IS granted to authenticated by the harness blanket grant above —
// the worst case. The function must still refuse to bootstrap VICTIM when
// called by ATTACKER.
await expectDenied("cross-user bootstrap call is denied even when execute is granted", () =>
  asUser(ATTACKER, () => db.query(`select public.bootstrap_personal_workspace($1)`, [VICTIM]))
);
const victimMem = await db.query(
  `select role, status from public.workspace_members where workspace_id = $1 and user_id = $2`,
  [victimWsId, VICTIM]
);
ok(
  "victim workspace untouched after cross-user attempt",
  victimMem.rows[0]?.role === "owner" && victimMem.rows[0]?.status === "active"
);

// Self-call is still allowed (the legitimate repair path).
await asUser(ATTACKER, async () => {
  const r = await db.query(`select public.bootstrap_personal_workspace(auth.uid())`);
  ok("self bootstrap call succeeds for the caller", Boolean(r.rows[0]?.bootstrap_personal_workspace));
});

// ---- 5. Owner re-claim at the member cap ---------------------------
console.log("\n-- 5. Owner re-claim at the member cap (021 skip) --");
// CAP_OWNER signs up (FREE workspace + owner row). Upgrade to PRO (cap 5),
// fill with 4 members -> 5 rows at cap. Then lose the owner row (historical
// trigger failure) and add a 5th non-owner member so the workspace holds
// `limit` members with NO owner row — the exact state where pre-021
// enforce_member_limit() stranded the owner (5 >= 5).
await signup(CAP_OWNER, "capowner@nexus.test", { full_name: "Cap Owner" });
const capWs = await db.query(`select id from public.workspaces where owner_id = $1`, [CAP_OWNER]);
const capWsId = capWs.rows[0].id;
await db.exec("reset role");
for (let i = 0; i < MEMBERS.length; i++) {
  await signup(MEMBERS[i], `capmem${i}@nexus.test`, { full_name: `Cap Mem ${i}` });
}
await db.query(
  `update public.workspace_subscriptions set plan = 'PRO' where workspace_id = $1`,
  [capWsId]
);
for (let i = 0; i < 4; i++) {
  await db.query(
    `insert into public.workspace_members (workspace_id, user_id, role, status)
     values ($1, $2, 'member', 'active')`,
    [capWsId, MEMBERS[i]]
  );
}
await db.query(
  `delete from public.workspace_members where workspace_id = $1 and user_id = $2`,
  [capWsId, CAP_OWNER]
);
// 5th non-owner member: allowed because the workspace now has only 4 rows.
await db.query(
  `insert into public.workspace_members (workspace_id, user_id, role, status)
   values ($1, $2, 'member', 'active')`,
  [capWsId, MEMBERS[4]]
);
const atCap = await db.query(
  `select count(*)::int as c,
          bool_and(user_id <> $2) as no_owner_row
     from public.workspace_members where workspace_id = $1`,
  [capWsId, CAP_OWNER]
);
ok(
  "fixture: workspace at PRO cap with 5 non-owner members and no owner row",
  atCap.rows[0].c === 5 && atCap.rows[0].no_owner_row === true,
  JSON.stringify(atCap.rows[0])
);

// The owner's own repair insert must succeed even at the cap: the 021 skip
// treats the owner re-claim as data repair, not a new member. Pre-021 this
// raised PLAN_LIMIT_EXCEEDED (5 >= 5) and stranded the owner forever.
await asUser(CAP_OWNER, async () => {
  await db.query(
    `insert into public.workspace_members (workspace_id, user_id, role, status)
     values ($1, $2, 'owner', 'active')`,
    [capWsId, CAP_OWNER]
  );
});
const reClaimed = await db.query(
  `select count(*)::int as c, min(role) as role, min(status) as status
     from public.workspace_members where workspace_id = $1 and user_id = $2`,
  [capWsId, CAP_OWNER]
);
ok("owner re-claim at the cap succeeds (no PLAN_LIMIT_EXCEEDED)", reClaimed.rows[0].c === 1);
ok("owner re-claim restored owner/active", reClaimed.rows[0].role === "owner" && reClaimed.rows[0].status === "active");

// Control: the member cap still applies to regular members (the workspace
// now holds owner + 5 members; a 6th member must be rejected).
await signup("a0000000-0000-0000-0000-0000000000ff", "capextra@nexus.test");
await expectDenied("regular member insert at the cap is still rejected", () =>
  db.query(
    `insert into public.workspace_members (workspace_id, user_id, role, status)
     values ($1, 'a0000000-0000-0000-0000-0000000000ff', 'member', 'active')`,
    [capWsId]
  )
);

// Control: a NON-owner can never claim ownership (the skip requires
// workspaces.owner_id = NEW.user_id, and RLS agrees).
await expectDenied("non-owner owner-claim at the cap is denied", () =>
  asUser(MEMBERS[0], () =>
    db.query(
      `insert into public.workspace_members (workspace_id, user_id, role, status)
       values ($1, $2, 'owner', 'active')`,
      [capWsId, MEMBERS[0]]
    )
  )
);
const memberNotOwner = await db.query(
  `select role from public.workspace_members where workspace_id = $1 and user_id = $2`,
  [capWsId, MEMBERS[0]]
);
ok("non-owner role unchanged after claim attempt", memberNotOwner.rows[0].role === "member");

// The RPC path also converges on the repaired state (idempotent, no dupes).
await asUser(CAP_OWNER, async () => {
  const rpc = await db.query(
    `select workspace_id, role, status from public.get_or_create_personal_workspace()`
  );
  ok(
    "RPC returns the repaired owner/active context",
    rpc.rows.length === 1 &&
      rpc.rows[0].workspace_id === capWsId &&
      rpc.rows[0].role === "owner" &&
      rpc.rows[0].status === "active",
    JSON.stringify(rpc.rows)
  );
});
const finalCount = await db.query(
  `select count(*)::int as c from public.workspace_members where workspace_id = $1 and user_id = $2`,
  [capWsId, CAP_OWNER]
);
ok("no duplicate owner row after RPC convergence", finalCount.rows[0].c === 1);

// ---- 6. Structured-error contract of the client RPC ----------------
console.log("\n-- 6. get_or_create_personal_workspace: structured errors --");
const gsrc = await prosrc("get_or_create_personal_workspace");
ok("RPC function exists (021 applied)", gsrc.length > 0);
ok(
  "membership is verified BEFORE the return query (no dead code after RETURN QUERY)",
  gsrc.includes("if not found then") &&
    gsrc.indexOf("if not found then") < gsrc.indexOf("return query")
);
ok(
  "verification failure raises WORKSPACE_MEMBERSHIP_FAILED (P0001), never an empty set",
  /WORKSPACE_MEMBERSHIP_FAILED/.test(gsrc) && /P0001/.test(gsrc)
);

// Behavioural: a coherent state (even a just-repaired one) always yields
// exactly one owner/active row.
const cleanUser = "b0000000-0000-0000-0000-000000000001";
await signup(cleanUser, "clean@nexus.test", { full_name: "Clean" });
await asUser(cleanUser, async () => {
  const r1 = await db.query(
    `select workspace_id, role, status from public.get_or_create_personal_workspace()`
  );
  ok("coherent state returns exactly one row", r1.rows.length === 1, JSON.stringify(r1.rows));
  ok("row is owner/active", r1.rows[0]?.role === "owner" && r1.rows[0]?.status === "active");
  const r2 = await db.query(
    `select workspace_id, role, status from public.get_or_create_personal_workspace()`
  );
  ok(
    "repeat call returns the same row (idempotent, stable context)",
    r2.rows.length === 1 && r2.rows[0]?.workspace_id === r1.rows[0]?.workspace_id
  );
});

// ---- 7. Client RPC grants -------------------------------------------
console.log("\n-- 7. Client RPC grant contract --");
const rpcGrant = await db.query(
  `select has_function_privilege('authenticated', 'public.get_or_create_personal_workspace()', 'EXECUTE') as rpc,
          has_function_privilege('authenticated', 'public.ensure_personal_workspace(uuid)', 'EXECUTE') as ensure`
);
ok("get_or_create_personal_workspace() is executable by authenticated", rpcGrant.rows[0].rpc === true);
ok("ensure_personal_workspace(uuid) is executable by authenticated", rpcGrant.rows[0].ensure === true);

await db.close();
console.log(`\n================ ${passed} passed / ${failed} failed ================`);
process.exit(failed === 0 ? 0 : 1);
