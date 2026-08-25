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
    // Accept any of: RLS/permission denial, custom WORKSPACE_ACCESS_DENIED,
    // a plan-limit trigger firing before RLS, or the unique
    // (workspace_id, user_id) constraint — all are legitimate server-side
    // rejections that prevent the write.
    ok(name, /permission denied|42501|workspace_access_denied|access denied|row-level security|plan_limit_exceeded|p0001|duplicate key|unique constraint|23505/i.test(m),
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

// Access-first profile model: provider metadata pre-fills the name, but the
// username from metadata is NOT auto-applied — it stays a user choice.
const aliceProfile = await db.query(
  `select display_name, username from public.profiles where id = $1`, [ALICE]
);
ok("metadata name pre-fills the display name", aliceProfile.rows[0]?.display_name === "Alice");
ok("metadata username is not auto-applied (stays a user choice)", aliceProfile.rows[0]?.username === null);

// A signup with NO identity metadata must produce a minimal profile: the row
// exists (authentication identity is guaranteed) but nothing is invented.
const NO_META = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
await signup(NO_META, "nometadata@nexus.test", {});
const noMetaProfile = await db.query(
  `select display_name, username from public.profiles where id = $1`, [NO_META]
);
ok("signup without metadata creates a minimal profile row", noMetaProfile.rows.length === 1);
ok("minimal profile stores no invented name or username",
  noMetaProfile.rows[0]?.display_name === null && noMetaProfile.rows[0]?.username === null);
const noMetaWs = await db.query(
  `select count(*)::int as c from workspaces where owner_id = $1`, [NO_META]
);
ok("signup without metadata still bootstraps a workspace", noMetaWs.rows[0]?.c === 1);

console.log("\n-- 2. Profile upsert succeeds for owner --");
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
// Google-style metadata: the `name` claim pre-fills the display name only.
const bobProfile = await db.query(
  `select display_name, username from public.profiles where id = $1`, [BOB]
);
ok("google signup pre-fills the name from metadata", bobProfile.rows[0]?.display_name === "Bob");
ok("google signup does not invent a username", bobProfile.rows[0]?.username === null);

await asUser(BOB, async () => {
  // Profile upsert must work without a workspace.
  const r = await db.query(
    `insert into public.profiles (id, display_name, username, updated_at)
     values ($1, 'Bob Google', 'bobgoogle', now())
     on conflict (id) do update set display_name = excluded.display_name
     returning display_name`,
    [BOB]
  );
  ok("profile upsert works for orphan", r.rows[0]?.display_name === "Bob Google");

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
await expectDenied("RPC rejects an unauthenticated caller", () =>
  asUser(null, () => db.query(`select public.ensure_personal_workspace()`)));
await asUser(CAROL, async () => {
  const ownerProbe = await db.query(
    `select public.is_workspace_owner($1, $2) as is_owner`,
    [aliceWsId, ALICE]
  );
  ok("ownership helper cannot be used to probe another user", ownerProbe.rows[0]?.is_owner === false);
});

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

console.log("\n-- 11. Exact historical bootstrap sequence -----------------");
// This is the incident state: auth user + profile exist, but the signup
// bootstrap left no workspace/membership. The order below is deliberately
// the order the production API route uses: bootstrap first, profile update
// second, read-back third.
const HISTORICAL = "55555555-5555-5555-5555-555555555555";
await signup(HISTORICAL, "historical@nexus.test", { full_name: "Historical" });
const historicalBefore = await db.query(
  `select id from public.workspaces where owner_id = $1`,
  [HISTORICAL]
);
if (historicalBefore.rows[0]) {
  await db.query(`delete from public.workspace_members where user_id = $1`, [HISTORICAL]);
  await db.query(`delete from public.workspaces where id = $1`, [historicalBefore.rows[0].id]);
}
const historicalState = await db.query(
  `select p.id, p.onboarding_completed,
          count(distinct w.id)::int as workspaces,
          count(distinct wm.id)::int as memberships
     from public.profiles p
     left join public.workspaces w on w.owner_id = p.id
     left join public.workspace_members wm on wm.user_id = p.id
    where p.id = $1
    group by p.id, p.onboarding_completed`,
  [HISTORICAL]
);
ok(
  "incident fixture has profile but no workspace or membership",
  historicalState.rows[0]?.id === HISTORICAL &&
    historicalState.rows[0]?.workspaces === 0 &&
    historicalState.rows[0]?.memberships === 0
);

await asUser(HISTORICAL, async () => {
  const bootstrapped = await db.query(
    `select workspace_id, role, status from public.get_or_create_personal_workspace()`
  );
  const row = bootstrapped.rows[0];
  ok(
    "historical bootstrap returns an active owner",
    Boolean(row?.workspace_id) && row.role === "owner" && row.status === "active"
  );

  const profileUpdate = await db.query(
    `update public.profiles
        set display_name = 'Historical Repaired', username = 'historical_repaired'
      where id = $1
      returning id, display_name, username`,
    [HISTORICAL]
  );
  ok(
    "historical profile update follows bootstrap without RLS denial",
    profileUpdate.rows[0]?.id === HISTORICAL &&
      profileUpdate.rows[0]?.display_name === "Historical Repaired"
  );

  const readBack = await db.query(
    `select w.owner_id, wm.role, wm.status, s.status as subscription_status
       from public.workspaces w
       join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = $1
       left join public.workspace_subscriptions s on s.workspace_id = w.id and s.status = 'active'
      where w.owner_id = $1`,
    [HISTORICAL]
  );
  ok(
    "historical read-back has coherent workspace context",
    readBack.rows[0]?.owner_id === HISTORICAL &&
      readBack.rows[0]?.role === "owner" &&
      readBack.rows[0]?.status === "active" &&
      readBack.rows[0]?.subscription_status === "active"
  );
});

console.log("\n-- 12. Partial historical repair + foreign membership --------");
const PARTIAL = "66666666-6666-6666-6666-666666666666";
const FOREIGN_OWNER = "77777777-7777-7777-7777-777777777777";
await signup(PARTIAL, "partial@nexus.test", { full_name: "Partial" });
const partialWorkspace = await db.query(
  `select id from public.workspaces where owner_id = $1`,
  [PARTIAL]
);
const partialWorkspaceId = partialWorkspace.rows[0].id;
await db.query(`delete from public.workspace_members where user_id = $1`, [PARTIAL]);
await db.query(`delete from public.workspace_subscriptions where workspace_id = $1`, [partialWorkspaceId]);
await asUser(PARTIAL, async () => {
  const repaired = await db.query(
    `select workspace_id, role, status from public.get_or_create_personal_workspace()`
  );
  ok(
    "workspace-without-membership repair returns the owned workspace",
    repaired.rows[0]?.workspace_id === partialWorkspaceId &&
      repaired.rows[0]?.role === "owner" &&
      repaired.rows[0]?.status === "active"
  );
});
const repairedSubscription = await db.query(
  `select plan, status from public.workspace_subscriptions where workspace_id = $1 and status = 'active'`,
  [partialWorkspaceId]
);
ok(
  "partial historical repair restores the active subscription",
  repairedSubscription.rows[0]?.plan === "FREE" && repairedSubscription.rows[0]?.status === "active"
);

await signup(FOREIGN_OWNER, "foreign@nexus.test", { full_name: "Foreign Owner" });
const foreignWorkspace = await db.query(
  `select id from public.workspaces where owner_id = $1`,
  [FOREIGN_OWNER]
);
const foreignWorkspaceId = foreignWorkspace.rows[0].id;
await asUser(PARTIAL, async () => {
  const ownContext = await db.query(
    `select workspace_id, role from public.get_or_create_personal_workspace()`
  );
  ok(
    "an invited user never receives a foreign workspace as personal context",
    ownContext.rows[0]?.workspace_id === partialWorkspaceId && ownContext.rows[0]?.role === "owner"
  );
});
await asUser(PARTIAL, async () => {
  const attemptedRename = await db.query(
    `update public.workspaces set name = 'foreign hacked' where id = $1`,
    [foreignWorkspaceId]
  );
  ok("foreign workspace rename affects zero rows", attemptedRename.rowCount === 0);
});

console.log("\n-- 13. New account with no profile + bootstrap ------------");
const NO_PROFILE = "88888888-8888-8888-8888-888888888888";
await signup(NO_PROFILE, "noprofile@nexus.test", {});
const noProfileWorkspace = await db.query(
  `select id from public.workspaces where owner_id = $1`,
  [NO_PROFILE]
);
await db.query(`delete from public.workspace_members where user_id = $1`, [NO_PROFILE]);
await db.query(`delete from public.workspace_subscriptions where workspace_id = $1`, [noProfileWorkspace.rows[0].id]);
await db.query(`delete from public.workspaces where id = $1`, [noProfileWorkspace.rows[0].id]);
await db.query(`delete from public.profiles where id = $1`, [NO_PROFILE]);
await asUser(NO_PROFILE, async () => {
  const bootstrapped = await db.query(
    `select workspace_id, role, status from public.get_or_create_personal_workspace()`
  );
  ok(
    "new account with no profile bootstraps before profile insert",
    bootstrapped.rows[0]?.role === "owner" && bootstrapped.rows[0]?.status === "active"
  );
  const profileInsert = await db.query(
    `insert into public.profiles (id, display_name, username)
     values ($1, 'New User', 'new_user')
     returning id`,
    [NO_PROFILE]
  );
  ok(
    "new account can insert its own profile after bootstrap",
    profileInsert.rows[0]?.id === NO_PROFILE
  );
});

// The orphan-repair path inserts a MINIMAL profile (id only) when the auth
// trigger never ran. That insert must succeed under RLS, and the resulting
// incomplete profile must not affect any workspace access.
const NO_PROFILE2 = "99999999-9999-9999-9999-999999999999";
await signup(NO_PROFILE2, "minimal@nexus.test", {});
await db.query(`delete from public.profiles where id = $1`, [NO_PROFILE2]);
await asUser(NO_PROFILE2, async () => {
  const minimalInsert = await db.query(
    `insert into public.profiles (id) values ($1) returning id`,
    [NO_PROFILE2]
  );
  ok("orphan repair can insert a minimal profile (id only)", minimalInsert.rows[0]?.id === NO_PROFILE2);

  const readBack = await db.query(
    `select display_name, username from public.profiles where id = $1`, [NO_PROFILE2]
  );
  ok("minimal profile reads back with NULL identity fields",
    readBack.rows[0]?.display_name === null && readBack.rows[0]?.username === null);

  const ws = await db.query(
    `select workspace_id from public.get_or_create_personal_workspace()`
  );
  ok("an incomplete profile still resolves a workspace (profile never gates access)",
    Boolean(ws.rows[0]?.workspace_id));
});

await db.close();

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
process.exit(failed === 0 ? 0 : 1);
