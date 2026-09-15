/**
 * ============================================================
 * NEXUS — AUTH + PERSONAL WORKSPACE BOOTSTRAP TESTS
 * Migration 20260915131000_nexus_auth_workspace_bootstrap.sql
 * ============================================================
 * Runs the REAL migration lineage (001 -> 027 + this migration) inside
 * PGlite, then asserts the canonical contract:
 *
 *   auth.users -> profile -> personal workspace -> owner membership
 *              -> FREE subscription (public.workspace_subscriptions, 007)
 *
 * Coverage, mapped to the migration brief:
 *   1-3   bootstrap_profile creates a profile and is idempotent
 *   4-5   exactly one auth.users trigger; no concurrent profile trigger
 *   6-7   bootstrap_personal_workspace creates one workspace, idempotently
 *   8-9   slug is valid and never contains the full email address
 *   10-11 exactly one owner membership, stable across repeated calls
 *   12    every SECURITY DEFINER function pins search_path = public, pg_temp
 *   13    EXECUTE is limited (trigger-only functions are not client callable)
 *   14    the real schema's NOT NULL / CHECK constraints are respected
 *   15    the FREE subscription exists and is created idempotently (CAS A)
 *   16    no fake `public.subscriptions` structure is introduced
 *
 * NOTE ON THE SKIPPED MIGRATION
 * 20260915130000_nexus_core_contract.sql (PR #68) cannot be applied on this
 * repository's lineage: it starts with
 * `alter function public.is_workspace_member(uuid) ...`, and that function —
 * together with the enum type public.workspace_member_role — has never
 * existed in any commit of this repository. Applying it aborts with
 * "function public.is_workspace_member(uuid) does not exist", which is
 * already reproducible on clean master (npm run test:admin -> admin-control-plane
 * reports exactly this one failure). It is skipped here so the migration
 * under test can be verified; the break is pre-existing and untouched.
 * ============================================================
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const MIGRATION_UNDER_TEST = "20260915131000_nexus_auth_workspace_bootstrap.sql";
const SKIPPED_MIGRATIONS = ["20260915130000_nexus_core_contract.sql"];

let passed = 0;
let failed = 0;

function ok(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

async function expectDenied(name, run, needle = /denied|42501|permission|unauthorized/i) {
  try {
    await run();
    ok(name, false, "expected denial, the call succeeded");
  } catch (error) {
    const message = String(error.message).split("\n")[0];
    ok(name, needle.test(message), `got: ${message}`);
  }
}

const db = await PGlite.create();

// ---- Platform emulation -------------------------------------------
// A provisioned Supabase project has anon / authenticated / service_role,
// and platform default privileges hand every newly created public function
// an explicit EXECUTE entry for those roles that `revoke ... from public`
// does NOT clear. Emulating that BEFORE the migrations run is what makes
// the privilege assertions meaningful: without it they would only prove
// that plain PostgreSQL defaults were revoked.
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

// auth schema + auth.uid() stub driven by a session GUC, so SECURITY
// DEFINER functions that branch on auth.uid() can be exercised.
await db.exec(`
  create schema if not exists auth;

  create table if not exists auth.users (
    id                 uuid primary key default gen_random_uuid(),
    email              text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    email_confirmed_at timestamptz,
    last_sign_in_at    timestamptz,
    created_at         timestamptz not null default now()
  );

  create or replace function auth.uid()
  returns uuid language sql stable as $$
    select nullif(current_setting('app.current_user', true), '')::uuid;
  $$;

  grant usage on schema auth to anon, authenticated, service_role;
`);

// ---- Apply the real lineage ---------------------------------------
const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .filter((file) => !SKIPPED_MIGRATIONS.includes(file))
  .sort();

let appliedUnderTest = false;
for (const file of migrations) {
  // PGlite has no pgcrypto; gen_random_uuid() is built into PG13+.
  const sql = readFileSync(join(migrationsDir, file), "utf8").replace(
    /create extension if not exists pgcrypto;\s*/gi,
    ""
  );
  try {
    await db.exec(sql);
  } catch (error) {
    console.log(`  FAIL  migration applied: ${file}`);
    console.log(`        ${String(error.message).split("\n")[0]}`);
    failed += 1;
    continue;
  }
  if (file === MIGRATION_UNDER_TEST) appliedUnderTest = true;
}

ok(
  `migration applied: ${MIGRATION_UNDER_TEST}`,
  appliedUnderTest,
  "the migration under test did not apply cleanly"
);

// ---- Helpers -------------------------------------------------------
async function asUser(userId, fn) {
  await db.exec("reset role");
  await db.query("select set_config('app.current_user', $1, false)", [userId ?? ""]);
  if (userId) await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('app.current_user', '', false)");
  }
}

/** Insert into auth.users as the platform would: the trigger chain fires. */
async function signup(id, email, meta = {}) {
  await db.exec("reset role");
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)",
    [id, email, meta]
  );
}

async function scalar(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows[0];
}

const one = (value) => value === 1 || value === "1";

// ---- Test identities -----------------------------------------------
const ABDOUL = "a1b2c3d4-0000-4000-8000-000000000001";
const NO_META = "b2c3d4e5-0000-4000-8000-000000000002";
const NO_EMAIL = "c3d4e5f6-0000-4000-8000-000000000003";
const ATTACKER = "d4e5f6a7-0000-4000-8000-000000000004";
const REPAIRED = "e5f6a7b8-0000-4000-8000-000000000005";

// ============================================================
console.log("\n-- 1/2/3. bootstrap_profile creates a profile, idempotently --");
// ============================================================
await signup(ABDOUL, "Abdoul.Karim@Nexus.Test", {
  full_name: "Abdoul Karim",
  username: "AbdoulK",
});

const profileRow = await scalar(
  "select id, display_name, username, onboarding_completed from public.profiles where id = $1",
  [ABDOUL]
);
ok("bootstrap_profile created the profile row via the signup trigger", Boolean(profileRow?.id));
ok(
  "display_name comes from the asserted provider identity",
  profileRow?.display_name === "Abdoul Karim",
  JSON.stringify(profileRow)
);
ok(
  "username stays NULL at signup (020 access-first contract preserved)",
  profileRow?.username === null,
  JSON.stringify(profileRow)
);
ok(
  "onboarding_completed keeps its NOT NULL default",
  profileRow?.onboarding_completed === false,
  JSON.stringify(profileRow)
);

// Direct repeated calls: one row, never duplicated, never clobbering.
for (let i = 0; i < 3; i += 1) {
  await db.query("select public.bootstrap_profile($1, $2::jsonb, $3)", [
    ABDOUL,
    { full_name: "Attacker Supplied Name" },
    "abdoul@elsewhere.test",
  ]);
}
const afterRepeat = await scalar(
  `select count(*)::int as n, max(display_name) as display_name
     from public.profiles where id = $1`,
  [ABDOUL]
);
ok(
  "bootstrap_profile is idempotent: repeated calls keep exactly one row",
  one(afterRepeat?.n),
  JSON.stringify(afterRepeat)
);
ok(
  "normalisation never overwrites an already-set display_name",
  afterRepeat?.display_name === "Abdoul Karim",
  JSON.stringify(afterRepeat)
);

// A NULL display_name IS filled by a later call (create-or-normalise).
await signup(REPAIRED, "repair@nexus.test", {});
const beforeNormalize = await scalar(
  "select display_name from public.profiles where id = $1",
  [REPAIRED]
);
ok(
  "a signup with no asserted identity stores no invented display_name",
  beforeNormalize?.display_name === null,
  JSON.stringify(beforeNormalize)
);
await db.query("select public.bootstrap_profile($1, $2::jsonb, $3)", [
  REPAIRED,
  { display_name: "Late Provider Name" },
  "repair@nexus.test",
]);
const afterNormalize = await scalar(
  "select display_name from public.profiles where id = $1",
  [REPAIRED]
);
ok(
  "a still-NULL display_name is normalised on a later call",
  afterNormalize?.display_name === "Late Provider Name",
  JSON.stringify(afterNormalize)
);

// ============================================================
console.log("\n-- 4/5. exactly one canonical auth.users trigger --");
// ============================================================
const authTriggers = await db.query(`
  select t.tgname,
         p.proname as fn,
         t.tgtype
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'auth'
    and c.relname = 'users'
    and not t.tgisinternal
  order by t.tgname
`);
ok(
  "auth.users has exactly one non-internal trigger",
  authTriggers.rows.length === 1,
  JSON.stringify(authTriggers.rows)
);
ok(
  "that trigger is the canonical on_auth_user_created",
  authTriggers.rows[0]?.tgname === "on_auth_user_created",
  JSON.stringify(authTriggers.rows)
);
ok(
  "it executes bootstrap_auth_user(), the single signup chain",
  authTriggers.rows[0]?.fn === "bootstrap_auth_user",
  JSON.stringify(authTriggers.rows)
);
// tgtype bit 1 = ROW, bit 2 = BEFORE, bit 3 = INSERT.
ok(
  "it is an AFTER INSERT ... FOR EACH ROW trigger",
  (authTriggers.rows[0]?.tgtype & 2) === 0 &&
    (authTriggers.rows[0]?.tgtype & 4) > 0 &&
    (authTriggers.rows[0]?.tgtype & 1) > 0,
  `tgtype=${authTriggers.rows[0]?.tgtype}`
);

const legacyTriggers = authTriggers.rows.filter((row) =>
  ["on_auth_user_created_profile", "on_auth_user_created_workspace"].includes(row.tgname)
);
ok(
  "no concurrent legacy profile trigger remains",
  legacyTriggers.length === 0,
  JSON.stringify(legacyTriggers)
);

const legacyFunction = await scalar(
  "select to_regprocedure('public.create_default_workspace()') as legacy"
);
ok(
  "the audited legacy wrapper create_default_workspace() is gone",
  legacyFunction?.legacy === null,
  JSON.stringify(legacyFunction)
);

const profileOverloads = await scalar(`
  select count(*)::int as n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'bootstrap_profile'
`);
ok(
  "bootstrap_profile has exactly one definition (no leftover zero-arg overload)",
  one(profileOverloads?.n),
  JSON.stringify(profileOverloads)
);

// ============================================================
console.log("\n-- 6/7. one personal workspace, created idempotently --");
// ============================================================
const workspacesAfterSignup = await db.query(
  "select id, name, slug, owner_id from public.workspaces where owner_id = $1",
  [ABDOUL]
);
ok(
  "signup created exactly one personal workspace",
  workspacesAfterSignup.rows.length === 1,
  JSON.stringify(workspacesAfterSignup.rows)
);
const personalWorkspaceId = workspacesAfterSignup.rows[0]?.id;

for (let i = 0; i < 3; i += 1) {
  const again = await db.query("select public.bootstrap_personal_workspace($1) as id", [ABDOUL]);
  ok(
    `repeat call ${i + 1} returns the same workspace id`,
    again.rows[0]?.id === personalWorkspaceId,
    JSON.stringify(again.rows[0])
  );
}
const workspacesAfterRepeat = await scalar(
  "select count(*)::int as n from public.workspaces where owner_id = $1",
  [ABDOUL]
);
ok(
  "repeated bootstraps never create a second personal workspace",
  one(workspacesAfterRepeat?.n),
  JSON.stringify(workspacesAfterRepeat)
);

// The client-facing RPC path the application actually uses.
const viaRpc = await asUser(ABDOUL, async () =>
  db.query("select workspace_id, role, status from public.get_or_create_personal_workspace()")
);
ok(
  "get_or_create_personal_workspace() returns the same workspace to the owner",
  viaRpc.rows[0]?.workspace_id === personalWorkspaceId,
  JSON.stringify(viaRpc.rows)
);
ok(
  "…and reports the owner membership",
  viaRpc.rows[0]?.role === "owner" && viaRpc.rows[0]?.status === "active",
  JSON.stringify(viaRpc.rows[0])
);
const afterRpc = await scalar(
  "select count(*)::int as n from public.workspaces where owner_id = $1",
  [ABDOUL]
);
ok("the RPC path does not create an extra workspace either", one(afterRpc?.n));

// ============================================================
console.log("\n-- 8/9. slug validity and no full email leakage --");
// ============================================================
const slug = workspacesAfterSignup.rows[0]?.slug ?? "";
ok("slug is not empty", slug.length > 0, JSON.stringify(workspacesAfterSignup.rows[0]));
ok(
  "slug is lowercase alphanumeric separated by single hyphens",
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug),
  slug
);
ok("slug has no leading/trailing hyphen", !slug.startsWith("-") && !slug.endsWith("-"), slug);
ok("slug has no double hyphen", !slug.includes("--"), slug);
ok("slug is a reasonable length (<= 100)", slug.length <= 100, `${slug} (${slug.length})`);
ok(
  "slug never contains the email domain",
  !slug.includes("nexus") && !slug.includes("test") && !slug.includes("@"),
  slug
);
ok(
  "slug is derived from the username metadata, lowercased (not truncated by the regexp)",
  slug.startsWith("abdoulk-a1b2c3d4"),
  slug
);

// The regression this migration fixes: uppercase must be LOWERCASED, not
// treated as a separator and deleted. Pre-fix, 'Abdoul.Karim@Nexus.Test'
// with no username produced 'bdoul-arim-<suffix>' (leading letter lost).
const EMAIL_ONLY = "f6a7b8c9-0000-4000-8000-000000000006";
await signup(EMAIL_ONLY, "Abdoul.Karim@Nexus.Test", {});
const emailOnlySlug = (
  await scalar("select slug, name from public.workspaces where owner_id = $1", [EMAIL_ONLY])
) ?? {};
ok(
  "uppercase in the email local part is lowercased, not deleted",
  String(emailOnlySlug.slug ?? "").startsWith("abdoul-karim-f6a7b8c9"),
  JSON.stringify(emailOnlySlug)
);
ok(
  "slug stays free of the email domain even without username metadata",
  !String(emailOnlySlug.slug ?? "").includes("nexus.test") &&
    !String(emailOnlySlug.slug ?? "").includes("@"),
  JSON.stringify(emailOnlySlug)
);
ok(
  "workspace name falls back to the email local part before the literal",
  emailOnlySlug.name === "Abdoul.Karim",
  JSON.stringify(emailOnlySlug)
);

// A single uppercase character: pre-fix this normalised to '' and silently
// fell back to 'workspace'.
const SINGLE = "0a1b2c3d-0000-4000-8000-000000000007";
await signup(SINGLE, "A@Nexus.Test", { username: "A" });
const singleSlug = (await scalar("select slug from public.workspaces where owner_id = $1", [SINGLE]))?.slug ?? "";
ok(
  "a one-character uppercase source still yields its own slug",
  singleSlug.startsWith("a-0a1b2c3d"),
  singleSlug
);

// ============================================================
console.log("\n-- 10/11. exactly one owner membership --");
// ============================================================
const membership = await db.query(
  `select id, workspace_id, user_id, role, status
     from public.workspace_members where user_id = $1`,
  [ABDOUL]
);
ok(
  "the owner has exactly one membership row",
  membership.rows.length === 1,
  JSON.stringify(membership.rows)
);
ok(
  "that membership is on the personal workspace",
  membership.rows[0]?.workspace_id === personalWorkspaceId,
  JSON.stringify(membership.rows[0])
);
ok(
  "role is owner and status is active",
  membership.rows[0]?.role === "owner" && membership.rows[0]?.status === "active",
  JSON.stringify(membership.rows[0])
);

const ownerMemberships = await scalar(
  `select count(*)::int as n from public.workspace_members
    where user_id = $1 and role = 'owner'`,
  [ABDOUL]
);
ok(
  "repeated bootstraps never create a second owner membership",
  one(ownerMemberships?.n),
  JSON.stringify(ownerMemberships)
);

const workspacesOwner = await scalar(
  "select owner_id from public.workspaces where id = $1",
  [personalWorkspaceId]
);
ok(
  "workspaces.owner_id and the owner membership agree",
  workspacesOwner?.owner_id === ABDOUL,
  JSON.stringify(workspacesOwner)
);

// A degraded membership is repaired, not duplicated.
await db.query(
  "update public.workspace_members set role = 'viewer', status = 'suspended' where workspace_id = $1 and user_id = $2",
  [personalWorkspaceId, ABDOUL]
);
await db.query("select public.bootstrap_personal_workspace($1)", [ABDOUL]);
const repaired = await db.query(
  "select role, status from public.workspace_members where user_id = $1",
  [ABDOUL]
);
ok(
  "a stale membership is repaired back to owner/active",
  repaired.rows.length === 1 &&
    repaired.rows[0]?.role === "owner" &&
    repaired.rows[0]?.status === "active",
  JSON.stringify(repaired.rows)
);

// ============================================================
console.log("\n-- 12. SECURITY DEFINER functions pin search_path --");
// ============================================================
const BOOTSTRAP_FAMILY = [
  "bootstrap_profile",
  "bootstrap_auth_user",
  "bootstrap_personal_workspace",
  "bootstrap_workspace_owner",
  "create_default_subscription",
  "ensure_personal_workspace",
  "get_or_create_personal_workspace",
  "is_active_workspace_member",
  "can_manage_workspace",
  "is_workspace_owner",
];
const defs = await db.query(
  `select p.proname,
          pg_get_function_identity_arguments(p.oid) as args,
          p.prosecdef,
          coalesce(
            (select a from unnest(p.proconfig) a where a like 'search_path%'),
            '(none)'
          ) as spath
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any($1::text[])
    order by p.proname`,
  [BOOTSTRAP_FAMILY]
);
ok(
  "every function of the bootstrap family exists",
  defs.rows.length === BOOTSTRAP_FAMILY.length,
  JSON.stringify(defs.rows.map((r) => r.proname))
);
ok(
  "every one of them is SECURITY DEFINER",
  defs.rows.length > 0 && defs.rows.every((row) => row.prosecdef === true),
  JSON.stringify(defs.rows.filter((row) => row.prosecdef !== true))
);
ok(
  "every one of them pins search_path = public, pg_temp",
  defs.rows.length > 0 &&
    defs.rows.every((row) => row.spath === "search_path=public, pg_temp"),
  JSON.stringify(defs.rows.filter((row) => row.spath !== "search_path=public, pg_temp"))
);

const dynamicSql = await db.query(
  `select p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('bootstrap_profile','bootstrap_auth_user','bootstrap_personal_workspace')
      and p.prosrc ~* '\\m(execute|format)\\s*\\('`
);
ok(
  "the new bootstrap functions contain no dynamic SQL",
  dynamicSql.rows.length === 0,
  JSON.stringify(dynamicSql.rows)
);

// ============================================================
console.log("\n-- 13. EXECUTE privileges are limited --");
// ============================================================
const TRIGGER_ONLY = [
  "public.bootstrap_profile(uuid, jsonb, text)",
  "public.bootstrap_auth_user()",
  "public.bootstrap_personal_workspace(uuid)",
];
for (const signature of TRIGGER_ONLY) {
  const acl = await scalar(
    `select has_function_privilege('public', $1::regprocedure, 'EXECUTE')        as pub,
            has_function_privilege('anon', $1::regprocedure, 'EXECUTE')           as anon,
            has_function_privilege('authenticated', $1::regprocedure, 'EXECUTE')  as auth`,
    [signature]
  );
  ok(
    `${signature} is not executable by public, anon or authenticated`,
    acl?.pub === false && acl?.anon === false && acl?.auth === false,
    JSON.stringify(acl)
  );
}

const OPTIONAL_TRIGGER_ONLY = [
  "public.bootstrap_workspace_owner()",
  "public.create_default_subscription()",
];
for (const signature of OPTIONAL_TRIGGER_ONLY) {
  const exists = await scalar("select to_regprocedure($1) as f", [signature]);
  if (!exists?.f) continue;
  const acl = await scalar(
    `select has_function_privilege('anon', $1::regprocedure, 'EXECUTE')          as anon,
            has_function_privilege('authenticated', $1::regprocedure, 'EXECUTE') as auth`,
    [signature]
  );
  ok(
    `${signature} (trigger-only) is not executable by anon or authenticated`,
    acl?.anon === false && acl?.auth === false,
    JSON.stringify(acl)
  );
}

const CLIENT_FACING = [
  "public.ensure_personal_workspace(uuid)",
  "public.get_or_create_personal_workspace()",
];
for (const signature of CLIENT_FACING) {
  const acl = await scalar(
    `select has_function_privilege('authenticated', $1::regprocedure, 'EXECUTE') as auth,
            has_function_privilege('anon', $1::regprocedure, 'EXECUTE')          as anon`,
    [signature]
  );
  ok(
    `${signature} stays executable by authenticated (the app's role) only`,
    acl?.auth === true && acl?.anon === false,
    JSON.stringify(acl)
  );
}

// The membership helpers are referenced inside RLS policies, which are
// evaluated with the invoking role's privileges. They must therefore stay
// executable by the app's role; the migration only pins their search_path.
const RLS_HELPERS = [
  "public.is_active_workspace_member(uuid, uuid)",
  "public.can_manage_workspace(uuid, uuid)",
  "public.is_workspace_owner(uuid, uuid)",
];
for (const signature of RLS_HELPERS) {
  const acl = await scalar(
    `select has_function_privilege('public', $1::regprocedure, 'EXECUTE')       as pub,
            has_function_privilege('authenticated', $1::regprocedure, 'EXECUTE') as auth`,
    [signature]
  );
  ok(
    `${signature} is revoked from PUBLIC but kept for authenticated (RLS policy use)`,
    acl?.pub === false && acl?.auth === true,
    JSON.stringify(acl)
  );
}

// Defense in depth: even in the worst case where the platform blanket grant
// is re-applied after the migration, the bodies must refuse a foreign uuid.
await signup(ATTACKER, "attacker@nexus.test", { full_name: "Attacker" });
await db.exec(`
  grant execute on all functions in schema public to authenticated;
  alter role authenticated nobypassrls;
`);
await expectDenied(
  "bootstrap_profile refuses a foreign user id even when EXECUTE is granted",
  () =>
    asUser(ATTACKER, () =>
      db.query("select public.bootstrap_profile($1, $2::jsonb, $3)", [
        ABDOUL,
        { full_name: "Hijacked" },
        "hijack@evil.test",
      ])
    ),
  /PROFILE_ACCESS_DENIED|42501/i
);
await expectDenied(
  "bootstrap_personal_workspace refuses a foreign user id even when EXECUTE is granted",
  () => asUser(ATTACKER, () => db.query("select public.bootstrap_personal_workspace($1)", [ABDOUL])),
  /WORKSPACE_ACCESS_DENIED|42501/i
);
const untouched = await scalar(
  "select display_name from public.profiles where id = $1",
  [ABDOUL]
);
ok(
  "the victim's profile was not modified by the cross-user attempt",
  untouched?.display_name === "Abdoul Karim",
  JSON.stringify(untouched)
);
await expectDenied(
  "ensure_personal_workspace refuses to bootstrap another user",
  () => asUser(ATTACKER, () => db.query("select public.ensure_personal_workspace($1)", [ABDOUL])),
  /WORKSPACE_ACCESS_DENIED|42501/i
);
await expectDenied(
  "ensure_personal_workspace refuses an anonymous caller",
  () => asUser(null, () => db.query("select public.ensure_personal_workspace()")),
  /WORKSPACE_ACCESS_DENIED|42501/i
);

// ============================================================
console.log("\n-- 14. the real schema's NOT NULL / CHECK constraints hold --");
// ============================================================
await signup(NO_META, "no.meta@nexus.test", {});
const noMeta = await scalar(
  "select name, slug from public.workspaces where owner_id = $1",
  [NO_META]
);
ok(
  "empty metadata still yields a non-empty workspace name within 1..120 chars",
  typeof noMeta?.name === "string" && noMeta.name.length >= 1 && noMeta.name.length <= 120,
  JSON.stringify(noMeta)
);
ok(
  "…and a non-null unique slug",
  typeof noMeta?.slug === "string" && noMeta.slug.length > 0,
  JSON.stringify(noMeta)
);

await signup(NO_EMAIL, null, {});
const noEmail = await scalar(
  "select name, slug from public.workspaces where owner_id = $1",
  [NO_EMAIL]
);
ok(
  "a NULL email still yields a valid name (literal fallback)",
  noEmail?.name === "NEXUS Workspace",
  JSON.stringify(noEmail)
);
ok(
  "a NULL email still yields a valid slug",
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(noEmail?.slug ?? "")),
  JSON.stringify(noEmail)
);

const longName = "L".repeat(400);
const LONG_USER = "1b2c3d4e-0000-4000-8000-000000000008";
await signup(LONG_USER, "long@nexus.test", { full_name: longName });
const longRow = await scalar(
  "select char_length(name) as len from public.workspaces where owner_id = $1",
  [LONG_USER]
);
ok(
  "an oversized metadata name is capped at the 120-char CHECK limit",
  longRow?.len === 120,
  JSON.stringify(longRow)
);

const uniqueSlugs = await scalar(`
  select count(*)::int as total, count(distinct slug)::int as distinct_slugs
  from public.workspaces
`);
ok(
  "every workspace slug in the database is unique",
  uniqueSlugs?.total === uniqueSlugs?.distinct_slugs,
  JSON.stringify(uniqueSlugs)
);

const roleConstraint = await scalar(`
  select count(*)::int as n
  from pg_constraint
  where conrelid = 'public.workspace_members'::regclass
    and pg_get_constraintdef(oid) like '%owner%'
`);
ok(
  "workspace_members keeps its canonical role CHECK constraint",
  Number(roleConstraint?.n) >= 1,
  JSON.stringify(roleConstraint)
);

// ============================================================
console.log("\n-- 15/16. FREE subscription (CAS A) and no fake structure --");
// ============================================================
ok(
  "no fake public.subscriptions table was introduced by this PR",
  (await scalar("select to_regclass('public.subscriptions') as t"))?.t === null
);

const subscriptionColumns = await db.query(`
  select column_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'workspace_subscriptions'
  order by column_name
`);
const EXPECTED_SUBSCRIPTION_COLUMNS = [
  "billing_customer_id",
  "billing_subscription_id",
  "created_at",
  "current_period_end",
  "id",
  "plan",
  "status",
  "trial_ends_at",
  "updated_at",
  "workspace_id",
].sort();
ok(
  "workspace_subscriptions still has exactly the columns 007 defined",
  JSON.stringify(subscriptionColumns.rows.map((r) => r.column_name).sort()) ===
    JSON.stringify(EXPECTED_SUBSCRIPTION_COLUMNS),
  JSON.stringify(subscriptionColumns.rows.map((r) => r.column_name))
);

const subscription = await db.query(
  "select plan, status from public.workspace_subscriptions where workspace_id = $1",
  [personalWorkspaceId]
);
ok(
  "the personal workspace has exactly one subscription row",
  subscription.rows.length === 1,
  JSON.stringify(subscription.rows)
);
ok(
  "that subscription is FREE and active",
  subscription.rows[0]?.plan === "FREE" && subscription.rows[0]?.status === "active",
  JSON.stringify(subscription.rows[0])
);

for (let i = 0; i < 3; i += 1) {
  await db.query("select public.bootstrap_personal_workspace($1)", [ABDOUL]);
}
const subscriptionAfterRepeat = await scalar(
  "select count(*)::int as n from public.workspace_subscriptions where workspace_id = $1",
  [personalWorkspaceId]
);
ok(
  "repeated bootstraps never create a second subscription",
  one(subscriptionAfterRepeat?.n),
  JSON.stringify(subscriptionAfterRepeat)
);

// An existing paid plan must survive the bootstrap (on conflict do nothing).
await db.query(
  "update public.workspace_subscriptions set plan = 'PRO' where workspace_id = $1",
  [personalWorkspaceId]
);
await db.query("select public.bootstrap_personal_workspace($1)", [ABDOUL]);
const planPreserved = await scalar(
  "select plan from public.workspace_subscriptions where workspace_id = $1",
  [personalWorkspaceId]
);
ok(
  "an existing PRO subscription is preserved, not downgraded to FREE",
  planPreserved?.plan === "PRO",
  JSON.stringify(planPreserved)
);

const everyWorkspaceHasSubscription = await scalar(`
  select count(*)::int as missing
  from public.workspaces w
  where not exists (
    select 1 from public.workspace_subscriptions s
    where s.workspace_id = w.id and s.status = 'active'
  )
`);
ok(
  "every workspace created by the signup chain holds an active subscription",
  Number(everyWorkspaceHasSubscription?.missing) === 0,
  JSON.stringify(everyWorkspaceHasSubscription)
);

// ============================================================
console.log("\n-- end-to-end invariant: 1 user -> 1 profile -> 1 workspace -> 1 owner --");
// ============================================================
const invariant = await db.query(`
  select u.id,
         (select count(*)::int from public.profiles p  where p.id = u.id)          as profiles,
         (select count(*)::int from public.workspaces w where w.owner_id = u.id)   as workspaces,
         (select count(*)::int from public.workspace_members m
           where m.user_id = u.id and m.role = 'owner' and m.status = 'active')      as owner_memberships
  from auth.users u
  order by u.created_at, u.id
`);
ok(
  "every signed-up user has exactly 1 profile, 1 personal workspace and 1 owner membership",
  invariant.rows.length > 0 &&
    invariant.rows.every(
      (row) => one(row.profiles) && one(row.workspaces) && one(row.owner_memberships)
    ),
  JSON.stringify(invariant.rows.filter((row) => !(one(row.profiles) && one(row.workspaces) && one(row.owner_memberships))))
);

// ============================================================
console.log("\n-- the migration itself is safe to re-apply --");
// ============================================================
let reapplyError = null;
try {
  await db.exec(
    readFileSync(join(migrationsDir, MIGRATION_UNDER_TEST), "utf8").replace(
      /create extension if not exists pgcrypto;\s*/gi,
      ""
    )
  );
} catch (error) {
  reapplyError = String(error.message).split("\n")[0];
}
ok("re-applying the migration does not fail", reapplyError === null, reapplyError ?? "");

const triggersAfterReapply = await scalar(`
  select count(*)::int as n
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal
`);
ok(
  "still exactly one auth.users trigger after re-apply",
  one(triggersAfterReapply?.n),
  JSON.stringify(triggersAfterReapply)
);

const AFTER_REAPPLY = "2c3d4e5f-0000-4000-8000-000000000009";
await signup(AFTER_REAPPLY, "after.reapply@nexus.test", { full_name: "After Reapply" });
const reapplyState = await scalar(
  `select (select count(*)::int from public.profiles p           where p.id = $1)      as profiles,
          (select count(*)::int from public.workspaces w         where w.owner_id = $1) as workspaces,
          (select count(*)::int from public.workspace_members m
             where m.user_id = $1 and m.role = 'owner' and m.status = 'active')         as owner_memberships`,
  [AFTER_REAPPLY]
);
ok(
  "a signup after re-apply still yields 1 profile / 1 workspace / 1 owner membership",
  one(reapplyState?.profiles) && one(reapplyState?.workspaces) && one(reapplyState?.owner_memberships),
  JSON.stringify(reapplyState)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
