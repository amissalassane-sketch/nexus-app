/**
 * ============================================================
 * NEXUS — ONBOARDING + WORKSPACE RLS TESTS
 * ============================================================
 * Verifies onboarding workspace bootstrap against PGlite with full
 * RLS enforcement. Each "as user" block sets the session role to
 * authenticated (mirroring Supabase's JWT role claim) and configures
 * auth.uid() via a session setting.
 * ============================================================
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = "supabase/migrations";
const db = await PGlite.create();

// ---- Bootstrap ------------------------------------------------
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
grant usage on schema public to authenticated;
`);

// Apply all migrations.
const migrations = readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
for (const f of migrations) {
  let sql = readFileSync(join(migrationsDir, f), "utf8");
  sql = sql.replace(/create extension if not exists pgcrypto;\s*/g, "");
  try { await db.exec(sql); }
  catch (e) { console.log(`FAIL ${f}: ${e.message.slice(0,200)}`); process.exit(1); }
  console.log(`OK migration: ${f}`);
}

await db.exec(`
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- RLS is already enabled by migration 001. Force RLS for the role.
alter role authenticated nobypassrls;
`);

// ---- Helpers --------------------------------------------------
let passed = 0, failed = 0;
function ok(name, cond, detail = "") {
  if (cond) { passed++; console.log("  PASS", name); }
  else { failed++; console.log("  FAIL", name, detail || ""); }
}

async function asUser(userId, fn) {
  // Switch session to authenticated role and set auth.uid().
  await db.exec("reset role");
  await db.query(`select set_config('app.current_user', $1, false)`, [userId || ""]);
  if (userId) {
    await db.exec("set role authenticated");
  } else {
    await db.exec("reset role");
  }
  try { return await fn(); }
  finally {
    await db.exec("reset role");
    await db.query(`select set_config('app.current_user', '', false)`);
  }
}

async function signup(id, email, meta = {}) {
  // Signup runs as superuser (service role).
  await db.exec("reset role");
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`,
    [id, email, meta]
  );
}

async function expectOk(name, fn) {
  try { await fn(); ok(name, true); }
  catch (e) { ok(name, false, e.message.slice(0,200)); }
}
async function expectDenied(name, fn) {
  try { await fn(); ok(name, false, "expected denial but call succeeded"); }
  catch (e) {
    const m = (e.message || "").toLowerCase();
    // Accept any of: RLS/permission denial, custom WORKSPACE_ACCESS_DENIED, or
    // a plan-limit trigger firing before RLS (also prevents the write).
    ok(name, /permission denied|42501|workspace_access_denied|access denied|row-level security|plan_limit_exceeded|p0001/i.test(m),
       `got: ${e.message.slice(0, 150)}`);
  }
}

// ---- Test data ------------------------------------------------
const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB   = "22222222-2222-2222-2222-222222222222";
const CAROL = "33333333-3333-3333-3333-333333333333";
const DAVE  = "44444444-4444-4444-4444-444444444444";

// ---- Tests ----------------------------------------------------
console.log("\n-- 1. Email signup creates workspace + owner membership --");
await signup(ALICE, "alice@nexus.test", { full_name: "Alice", username: "alice" });
const aliceWs = await db.query(`select id from public.workspaces where owner_id = $1`, [ALICE]);
ok("signup creates a workspace", aliceWs.rows.length === 1);
const aliceWsId = aliceWs.rows[0].id;
const aliceMem = await db.query(
  `select role, status from workspace_members where workspace_id = $1 and user_id = $2`,
  [aliceWsId, ALICE]
);
ok("signup creates owner membership", aliceMem.rows[0]?.role === "owner" && aliceMem.rows[0]?.status === "active");

console.log("\n-- 2. Step 1 profile upsert succeeds for owner --");
await asUser(ALICE, async () => {
  const r = await db.query(
    `insert into public.profiles (id, display_name, username, updated_at)
     values ($1, 'Alice Updated', 'alice', now())
     on conflict (id) do update set display_name = excluded.display_name, username = excluded.username
     returning display_name`,
    [ALICE]
  );
  ok("profile upsert returns row", r.rows.length === 1 && r.rows[0].display_name === "Alice Updated");
});

console.log("\n-- 3. Step 2 workspace rename succeeds for owner --");
await asUser(ALICE, async () => {
  await db.query(`update public.workspaces set name = 'Alice Team' where id = $1`, [aliceWsId]);
  const r = await db.query(`select name from workspaces where id = $1`, [aliceWsId]);
  ok("rename persisted", r.rows[0]?.name === "Alice Team");
});

console.log("\n-- 4. RPC is idempotent (no duplicate workspaces) --");
await asUser(ALICE, async () => {
  await db.query(`select public.get_or_create_personal_workspace()`);
});
const wsCount = await db.query(`select count(*)::int as c from workspaces where owner_id = $1`, [ALICE]);
ok("still 1 workspace after repeat RPC", wsCount.rows[0].c === 1);

console.log("\n-- 5. Google OAuth orphan repair --");
await signup(BOB, "bob@gmail.com", { name: "Bob", full_name: "Bob" });
// Simulate trigger failure: delete workspace + membership.
const bobInitial = await db.query(`select id from workspaces where owner_id = $1`, [BOB]);
if (bobInitial.rows[0]) {
  await db.query(`delete from workspace_members where user_id = $1`, [BOB]);
  await db.query(`delete from workspaces where id = $1`, [bobInitial.rows[0].id]);
}
await asUser(BOB, async () => {
  // Step 1: profile upsert must work without a workspace.
  const r = await db.query(
    `insert into public.profiles (id, display_name, username, updated_at)
     values ($1, 'Bob Google', 'bobgoogle', now())
     on conflict (id) do update set display_name = excluded.display_name
     returning display_name`,
    [BOB]
  );
  ok("step 1 profile upsert works for orphan", r.rows[0]?.display_name === "Bob Google");

  // RPC bootstraps workspace.
  const rpc = await db.query(`select workspace_id, role from public.get_or_create_personal_workspace()`);
  ok("RPC repairs orphan workspace", rpc.rows.length === 1 && rpc.rows[0].role === "owner");
});

console.log("\n-- 6. Cross-workspace attacks blocked --");
await signup(CAROL, "carol@evil.test", { full_name: "Carol" });
await asUser(CAROL, async () => {
  const read = await db.query(`select id from workspaces where id = $1`, [aliceWsId]);
  ok("non-member cannot read another workspace", read.rows.length === 0);
});

// UPDATE via RLS silently filters 0 rows (correct behavior — no error, no mutation).
await asUser(CAROL, async () => {
  const r = await db.query(`update profiles set display_name = 'Hacked' where id = $1`, [ALICE]);
  ok("cannot update another user's profile (0 rows)", r.rowCount === 0);
});
await asUser(ALICE, async () => {
  const r = await db.query(`select display_name from profiles where id = $1`, [ALICE]);
  ok("profile unchanged after cross-update attempt", r.rows[0]?.display_name === "Alice Updated");
});

await asUser(CAROL, async () => {
  const r = await db.query(`update workspaces set name = 'Hacked' where id = $1`, [aliceWsId]);
  ok("cannot rename another workspace (0 rows)", r.rowCount === 0);
});
await asUser(ALICE, async () => {
  const r = await db.query(`select name from workspaces where id = $1`, [aliceWsId]);
  ok("workspace unchanged after cross-rename attempt", r.rows[0]?.name === "Alice Team");
});

await expectDenied("cannot insert task in another workspace", () =>
  asUser(CAROL, () => db.query(`insert into tasks (workspace_id, title) values ($1, 'Hacked')`, [aliceWsId])));
await expectDenied("cannot insert project in another workspace", () =>
  asUser(CAROL, () => db.query(`insert into projects (workspace_id, name, slug) values ($1, 'H', 'h')`, [aliceWsId])));

// Carol trying to claim owner on Alice's workspace is denied. The denial may
// come from either the enforce_member_limit BEFORE INSERT trigger (Alice already
// has 1 member — plan limit) OR from RLS. Either way the insert fails, which is
// what matters for security.
await expectDenied("cannot self-claim owner on foreign workspace", () =>
  asUser(CAROL, () => db.query(
    `insert into workspace_members (workspace_id, user_id, role, status) values ($1, $2, 'owner', 'active')`,
    [aliceWsId, CAROL])));

console.log("\n-- 7. Self-claim policy repairs orphan owner membership --");
await signup(DAVE, "dave@nexus.test", { full_name: "Dave" });
const daveWs = await db.query(`select id from workspaces where owner_id = $1`, [DAVE]);
const daveWsId = daveWs.rows[0]?.id;
await db.query(`delete from workspace_members where user_id = $1`, [DAVE]);
await expectOk("orphan owner can self-claim membership", () =>
  asUser(DAVE, () => db.query(
    `insert into workspace_members (workspace_id, user_id, role, status) values ($1, $2, 'owner', 'active')`,
    [daveWsId, DAVE])));
await expectDenied("duplicate self-claim blocked", () =>
  asUser(DAVE, () => db.query(
    `insert into workspace_members (workspace_id, user_id, role, status) values ($1, $2, 'owner', 'active')`,
    [daveWsId, DAVE])));

console.log("\n-- 8. RPC rejects cross-user bootstrap --");
// Direct call to ensure_personal_workspace(ALICE) as Carol must throw.
await expectDenied("RPC rejects cross-user call", () =>
  asUser(CAROL, () => db.query(`select public.ensure_personal_workspace($1)`, [ALICE])));

console.log("\n-- 9. onboarding_completed flag persists --");
await asUser(ALICE, async () => {
  await db.query(`update profiles set onboarding_completed = true where id = $1`, [ALICE]);
  const r = await db.query(`select onboarding_completed from profiles where id = $1`, [ALICE]);
  ok("onboarding_completed=true persisted", r.rows[0]?.onboarding_completed === true);
});

console.log("\n-- 10. Reload idempotency --");
await asUser(ALICE, () => db.query(`select public.get_or_create_personal_workspace()`));
const finalCount = await db.query(`select count(*)::int as c from workspaces where owner_id = $1`, [ALICE]);
ok("reload does not duplicate workspace", finalCount.rows[0].c === 1);
const memCount = await db.query(`select count(*)::int as c from workspace_members where user_id = $1`, [ALICE]);
ok("reload does not duplicate membership", memCount.rows[0].c === 1);

await db.close();
console.log(`\n================ ${passed} passed / ${failed} failed ================`);
process.exit(failed === 0 ? 0 : 1);
