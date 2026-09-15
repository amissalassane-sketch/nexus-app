/**
 * ============================================================
 * NEXUS — SUPABASE LINEAGE RECONCILIATION HARNESS
 * ============================================================
 * Proves, against a real PostgreSQL engine (PGlite), which schema lineage
 * this repository actually versions, and that the reconciled chain is
 * reproducible end to end.
 *
 * PHASE 1  001_nexus_base_schema.sql then 006 -> 027 apply with ZERO
 *          failures. This is what makes that lineage the source of truth.
 * PHASE 2  20260915130000_nexus_core_contract.sql has been RETIRED to a
 *          guarded no-op. It now applies cleanly on the lineage of record,
 *          creates nothing, and leaves every helper body untouched.
 * PHASE 3  Why it was retired, kept as a permanent regression fixture: even
 *          with the enum created, the original enum-cast can_manage_workspace()
 *          body cannot exist, because workspace_members.role is text.
 * PHASE 9  The COMPLETE chain - 001 -> 027 -> 130000 -> 130500 -> 131000 -
 *          applies in one pass with zero failures, and signup still works.
 *          This is what neutralising 130000 buys: `db reset` is unblocked.
 * PHASE 4  20260915130500_nexus_lineage_reconciliation.sql applies, pins
 *          the canonical helpers and changes no type, no table, no policy.
 * PHASE 5  20260915131000_nexus_auth_workspace_bootstrap.sql applies ONLY
 *          AFTER the reconciliation, and the signup chain still works.
 * PHASE 6  Every stored RLS policy expression still resolves — the check
 *          that a column-type conversion would have failed.
 * PHASE 7  Static quarantine: NO migration creates the void contract
 *          objects, and none references a bare public.subscriptions table.
 * PHASE 8  Idempotence: the reconciliation is safe to re-apply.
 *
 * No remote Supabase operation is performed. No db reset, no db push, no
 * migration repair. Everything below runs in-process.
 * ============================================================
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

const VOID_CONTRACT = "20260915130000_nexus_core_contract.sql";
const RECONCILIATION = "20260915130500_nexus_lineage_reconciliation.sql";
const AUTH_BOOTSTRAP = "20260915131000_nexus_auth_workspace_bootstrap.sql";

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

const strip = (sql) => sql.replace(/create extension if not exists pgcrypto;\s*/gi, "");
const one = (v) => v === 1 || v === "1";

/**
 * Migration text with prose removed, so a hit is a real SQL reference and not
 * a sentence documenting the void contract. Tokenises rather than regex-guesses:
 * it tracks line comments, single-quoted literals (with '' escapes) and both
 * $$ and $tag$ dollar-quoted bodies, which is where plpgsql lives.
 */
function sqlCodeOnlyFromText(text) {
  let out = "";
  let i = 0;
  let dollar = null;
  while (i < text.length) {
    // Inside a dollar-quoted body: keep the SQL, it is executable, but still
    // drop string literals - COMMENT statements live inside DO blocks and
    // legitimately NAME the void contract in prose.
    if (dollar) {
      if (text.startsWith(dollar, i)) {
        out += dollar;
        i += dollar.length;
        dollar = null;
        continue;
      }
      // plpgsql comments can contain prose apostrophes; drop them first or
      // they open a phantom string literal and desynchronise the scan.
      if (text.startsWith("--", i)) {
        while (i < text.length && text[i] !== "\n") i += 1;
        continue;
      }
      if (text[i] === "'") {
        i += 1;
        while (i < text.length) {
          if (text[i] === "'") {
            if (text[i + 1] === "'") {
              i += 2;
              continue;
            }
            i += 1;
            break;
          }
          i += 1;
        }
        out += "''";
        continue;
      }
      out += text[i++];
      continue;
    }
    // Line comment: drop to end of line.
    if (text.startsWith("--", i)) {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    // Single-quoted literal: drop its contents, keep an empty literal.
    if (text[i] === "'") {
      i += 1;
      while (i < text.length) {
        if (text[i] === "'") {
          if (text[i + 1] === "'") {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      out += "''";
      continue;
    }
    if (text.startsWith("$$", i)) {
      dollar = "$$";
      out += "$$";
      i += 2;
      continue;
    }
    const tagged = /^\$([a-zA-Z_][a-zA-Z0-9_]*)\$/.exec(text.slice(i));
    if (tagged) {
      dollar = tagged[0];
      out += tagged[0];
      i += tagged[0].length;
      continue;
    }
    out += text[i++];
  }
  return out;
}

/** Same tokeniser, applied to a migration file on disk. */
function sqlCodeOnly(file) {
  return sqlCodeOnlyFromText(readFileSync(join(migrationsDir, file), "utf8"));
}

/** A database that looks like a provisioned Supabase project. */
async function createPlatformDb() {
  const db = await PGlite.create();
  await db.exec(`
    do $d$
    declare r text;
    begin
      foreach r in array array['authenticated','anon','service_role'] loop
        if not exists (select 1 from pg_roles where rolname = r) then
          execute format('create role %I nologin', r);
        end if;
      end loop;
    end $d$;

    alter default privileges in schema public
      grant execute on functions to anon, authenticated, service_role;
    alter default privileges in schema public
      grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public
      grant all on sequences to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;

    create schema auth;

    create table auth.users (
      id                 uuid primary key default gen_random_uuid(),
      email              text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      email_confirmed_at timestamptz,
      last_sign_in_at    timestamptz,
      banned_until       timestamptz,
      created_at         timestamptz not null default now()
    );

    create or replace function auth.uid()
    returns uuid language sql stable as $$
      select nullif(current_setting('app.current_user', true), '')::uuid;
    $$;

    grant usage on schema auth to anon, authenticated, service_role;
  `);
  return db;
}

const allMigrations = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

// ============================================================
console.log("\n== PHASE 1 — the versioned lineage is complete and self-consistent ==");
// ============================================================
const db = await createPlatformDb();

// 001 then 006 -> 027: every versioned file except the two 2026 contracts,
// which are applied later in their mandated order.
const lineageFiles = allMigrations.filter(
  (f) => f === "001_nexus_base_schema.sql" || (/^(0[0-9]{2}|[12][0-9]{2})_/.test(f) && !f.startsWith("2026"))
);
const lineageFailures = [];
for (const file of lineageFiles) {
  try {
    await db.exec(strip(readFileSync(join(migrationsDir, file), "utf8")));
  } catch (error) {
    lineageFailures.push(`${file}: ${String(error.message).split("\n")[0]}`);
  }
}
ok(
  `001_nexus_base_schema.sql then 006 -> 027 apply with zero failures (${lineageFiles.length} files)`,
  lineageFailures.length === 0,
  lineageFailures.join("\n        ")
);
ok("001 is applied first", lineageFiles[0] === "001_nexus_base_schema.sql", lineageFiles[0]);

const helperPresence = await db.query(`
  select p.proname, oidvectortypes(p.proargtypes)::text as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('is_active_workspace_member','can_manage_workspace','is_workspace_owner')
  order by p.proname
`);
ok(
  "the three canonical helpers really exist after the lineage applies",
  helperPresence.rows.length === 3 &&
    helperPresence.rows.every((r) => r.args.replace(/\s+/g, "") === "uuid,uuid"),
  JSON.stringify(helperPresence.rows)
);

const voidObjects = await db.query(`
  select to_regprocedure('public.is_workspace_member(uuid)')                            as is_member,
         to_regprocedure('public.has_workspace_role(uuid, public.workspace_member_role[])') as has_role,
         (select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typname = 'workspace_member_role')          as role_enum,
         (select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typname = 'workspace_member_status')        as status_enum,
         to_regclass('public.subscriptions')                                            as subscriptions_tbl
`);
ok(
  "the PR #68 contract objects do NOT exist in the versioned lineage",
  voidObjects.rows[0].is_member === null &&
    voidObjects.rows[0].has_role === null &&
    voidObjects.rows[0].role_enum === 0 &&
    voidObjects.rows[0].status_enum === 0 &&
    voidObjects.rows[0].subscriptions_tbl === null,
  JSON.stringify(voidObjects.rows[0])
);

const roleType = await db.query(`
  select column_name, data_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'workspace_members'
    and column_name in ('role','status')
  order by column_name
`);
ok(
  "workspace_members.role and .status are text (not enums) in the lineage of record",
  roleType.rows.length === 2 && roleType.rows.every((r) => r.data_type === "text"),
  JSON.stringify(roleType.rows)
);

const activityColumns = await db.query(`
  select count(*) filter (where column_name = 'actor_id')::int as actor_id,
         count(*) filter (where column_name = 'user_id')::int  as user_id
  from information_schema.columns
  where table_schema = 'public' and table_name = 'activities'
`);
ok(
  "activities uses actor_id; there is no activities.user_id to reconcile",
  activityColumns.rows[0].actor_id === 1 && activityColumns.rows[0].user_id === 0,
  JSON.stringify(activityColumns.rows[0])
);

// ============================================================
console.log("\n== PHASE 2 — the retired core contract is a safe no-op ==");
// ============================================================
// Isolated database: 130000 must be shown to change nothing, so it gets its
// own copy of the lineage rather than polluting the chain under test.
const forensic = await createPlatformDb();
for (const file of lineageFiles) {
  await forensic.exec(strip(readFileSync(join(migrationsDir, file), "utf8")));
}

const snapshotQuery = `
  select
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public')                                   as functions,
    (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typtype in ('e','c','d'))     as types,
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r')                as tables,
    (select count(*) from pg_policies where schemaname = 'public')   as policies,
    (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not t.tgisinternal)             as triggers,
    -- prosrc + signature + return type, deliberately NOT pg_get_functiondef:
    -- that renders the SET search_path clause, which this migration is
    -- allowed (and meant) to change. Body and signature are what must not move.
    -- The sort key is spelled out because inside an aggregate's ORDER BY a
    -- bare integer is a CONSTANT, not an output-column ordinal - "order by 1"
    -- would leave the concatenation order up to the heap scan and make this
    -- assertion flaky.
    (select coalesce(string_agg(sig, ',' order by sig), '')
       from (select p.proname || '(' || oidvectortypes(p.proargtypes) || ')->' ||
                    p.prorettype::text || ':' || md5(coalesce(p.prosrc, '')) as sig
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public') s)                         as bodies
`;
const beforeRetired = await forensic.query(snapshotQuery);

const retiredSql = strip(readFileSync(join(migrationsDir, VOID_CONTRACT), "utf8"));
let retiredError = null;
try {
  await forensic.exec(retiredSql);
} catch (error) {
  retiredError = String(error.message).split("\n")[0];
}
const afterRetired = await forensic.query(snapshotQuery);

ok(
  "20260915130000 (retired) applies cleanly on the lineage of record",
  retiredError === null,
  retiredError ?? ""
);
ok(
  "…and creates no function, type, table, policy or trigger",
  ["functions", "types", "tables", "policies", "triggers"].every(
    (k) => beforeRetired.rows[0][k] === afterRetired.rows[0][k]
  ),
  JSON.stringify({ before: beforeRetired.rows[0], after: afterRetired.rows[0] })
);
ok(
  "…and rewrites no function body, signature or return type (search_path / ACL / COMMENT may move)",
  beforeRetired.rows[0].bodies === afterRetired.rows[0].bodies,
  "a prosrc/signature/return-type digest changed"
);

const stillAbsent = await forensic.query(`
  select to_regtype('public.workspace_member_role')                  as enum_role,
         to_regtype('public.workspace_member_status')                as enum_status,
         to_regprocedure('public.is_workspace_member(uuid)')         as iwm,
         to_regprocedure('public.has_workspace_role(uuid, public.workspace_member_role[])') as hwr
`);
ok(
  "the void contract objects still do not exist after it runs",
  Object.values(stillAbsent.rows[0]).every((v) => v === null),
  JSON.stringify(stillAbsent.rows[0])
);

// The retired file must not have smuggled the enum-cast body back in: the
// canonical management helper has to keep 001's text-based semantics.
const cmwAfterRetired = await forensic.query(
  `select pg_get_functiondef('public.can_manage_workspace(uuid, uuid)'::regprocedure) as def`
);
ok(
  "can_manage_workspace() keeps the lineage's text semantics, not the enum cast",
  !/workspace_member_role/.test(cmwAfterRetired.rows[0].def),
  cmwAfterRetired.rows[0].def
);

// ============================================================
console.log("\n== PHASE 3 — why it was retired: the enum does NOT rescue the contract ==");
// ============================================================
// Permanent regression fixture. The file on disk no longer contains this body
// (it was retired in PHASE 2), so the proof is embedded here: if anyone ever
// proposes reviving the enum-based contract, this phase shows it still cannot
// exist against workspace_members.role text.
const RETIRED_ENUM_CAST_BODY = `
  create or replace function public.can_manage_workspace(
    p_workspace_id uuid,
    p_user_id uuid default auth.uid()
  )
  returns boolean language sql stable security definer
  set search_path = public, pg_temp
  as $body$
    select exists (
      select 1 from public.workspace_members
      where workspace_id = p_workspace_id
        and user_id = p_user_id
        and status = 'active'
        and role = any (array[
          'owner'::public.workspace_member_role,
          'admin'::public.workspace_member_role
        ])
    );
  $body$;
`;

await forensic.exec(
  `create type public.workspace_member_role as enum ('owner','admin','member','viewer');`
);
await forensic.exec(
  `create type public.workspace_member_status as enum ('active','invited','suspended');`
);
await forensic.exec(`
  create or replace function public.is_workspace_member(target_workspace_id uuid)
  returns boolean language sql stable security definer set search_path = public, pg_temp
  as $$ select exists (select 1 from public.workspace_members
        where workspace_id = target_workspace_id and user_id = auth.uid()
          and status = 'active') $$;
`);

let enumRepairError = null;
try {
  await forensic.exec(RETIRED_ENUM_CAST_BODY);
} catch (error) {
  enumRepairError = String(error.message).split("\n")[0];
}
ok(
  "even with the enum present, the retired enum-cast can_manage_workspace() still cannot be created",
  enumRepairError !== null && /operator does not exist: text = workspace_member_role/.test(enumRepairError),
  enumRepairError ?? "it succeeded — the analysis needs revisiting"
);
ok(
  "…because workspace_members.role is text in the lineage of record",
  /text = workspace_member_role/.test(enumRepairError ?? "")
);

// ============================================================
console.log("\n== PHASE 4 — the reconciliation migration applies ==");
// ============================================================
const before = await db.query(`
  select (select count(*)::int from pg_policy)    as policies,
         (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public')            as functions,
         (select count(*)::int from information_schema.columns
           where table_schema = 'public')         as columns
`);

let reconciliationError = null;
try {
  await db.exec(strip(readFileSync(join(migrationsDir, RECONCILIATION), "utf8")));
} catch (error) {
  reconciliationError = String(error.message).split("\n")[0];
}
ok("20260915130500_nexus_lineage_reconciliation.sql applies cleanly", reconciliationError === null, reconciliationError ?? "");

const after = await db.query(`
  select (select count(*)::int from pg_policy)    as policies,
         (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public')            as functions,
         (select count(*)::int from information_schema.columns
           where table_schema = 'public')         as columns
`);
ok(
  "the reconciliation creates no policy, no function and no column",
  before.rows[0].policies === after.rows[0].policies &&
    before.rows[0].functions === after.rows[0].functions &&
    before.rows[0].columns === after.rows[0].columns,
  JSON.stringify({ before: before.rows[0], after: after.rows[0] })
);

const reconciledTypes = await db.query(`
  select (select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace
            where n.nspname = 'public' and t.typtype = 'e'
              and t.typname like 'workspace_member%') as enums,
         (select data_type from information_schema.columns
            where table_schema='public' and table_name='workspace_members' and column_name='role') as role_type
`);
ok(
  "no enum was fabricated and workspace_members.role is still text",
  reconciledTypes.rows[0].enums === 0 && reconciledTypes.rows[0].role_type === "text",
  JSON.stringify(reconciledTypes.rows[0])
);

const pinned = await db.query(`
  select p.proname,
         coalesce((select a from unnest(p.proconfig) a where a like 'search_path%'), '(none)') as spath,
         p.prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('is_active_workspace_member','can_manage_workspace','is_workspace_owner')
  order by p.proname
`);
ok(
  "all three canonical helpers are SECURITY DEFINER with search_path = public, pg_temp",
  pinned.rows.length === 3 &&
    pinned.rows.every((r) => r.prosecdef === true && r.spath === "search_path=public, pg_temp"),
  JSON.stringify(pinned.rows)
);

const acls = await db.query(`
  select
    has_function_privilege('public',        'public.is_active_workspace_member(uuid, uuid)', 'EXECUTE') as member_public,
    has_function_privilege('anon',          'public.is_active_workspace_member(uuid, uuid)', 'EXECUTE') as member_anon,
    has_function_privilege('authenticated', 'public.is_active_workspace_member(uuid, uuid)', 'EXECUTE') as member_auth,
    has_function_privilege('service_role',  'public.is_active_workspace_member(uuid, uuid)', 'EXECUTE') as member_svc,
    has_function_privilege('public',        'public.can_manage_workspace(uuid, uuid)',       'EXECUTE') as manage_public,
    has_function_privilege('authenticated', 'public.can_manage_workspace(uuid, uuid)',       'EXECUTE') as manage_auth,
    has_function_privilege('service_role',  'public.can_manage_workspace(uuid, uuid)',       'EXECUTE') as manage_svc,
    has_function_privilege('anon',          'public.is_workspace_owner(uuid, uuid)',         'EXECUTE') as owner_anon,
    has_function_privilege('authenticated', 'public.is_workspace_owner(uuid, uuid)',         'EXECUTE') as owner_auth,
    has_function_privilege('public',        'public.is_workspace_owner(uuid, uuid)',         'EXECUTE') as owner_public
`);
ok(
  "helper ACLs are explicit: PUBLIC revoked, the three real roles granted",
  acls.rows[0].member_public === false &&
    acls.rows[0].manage_public === false &&
    acls.rows[0].owner_public === false &&
    acls.rows[0].member_anon === true &&
    acls.rows[0].member_auth === true &&
    acls.rows[0].member_svc === true &&
    acls.rows[0].manage_auth === true &&
    acls.rows[0].manage_svc === true &&
    acls.rows[0].owner_anon === true &&
    acls.rows[0].owner_auth === true,
  JSON.stringify(acls.rows[0])
);

const comments = await db.query(`
  select obj_description('public.workspace_members'::regclass, 'pg_class') as tbl,
         obj_description('public.is_active_workspace_member(uuid, uuid)'::regprocedure, 'pg_proc') as member_fn,
         obj_description('public.can_manage_workspace(uuid, uuid)'::regprocedure, 'pg_proc') as manage_fn,
         obj_description('public.is_workspace_owner(uuid, uuid)'::regprocedure, 'pg_proc') as owner_fn
`);
ok(
  "the lineage decision is recorded on the table and on each helper",
  [comments.rows[0].tbl, comments.rows[0].member_fn, comments.rows[0].manage_fn, comments.rows[0].owner_fn].every(
    (c) => typeof c === "string" && c.includes("lineage")
  ),
  JSON.stringify(comments.rows[0]).slice(0, 300)
);

// ============================================================
console.log("\n== PHASE 5 — 20260915131000 applies only AFTER reconciliation ==");
// ============================================================
ok(
  "migration order puts the reconciliation between PR #68 and PR #69",
  allMigrations.indexOf(VOID_CONTRACT) < allMigrations.indexOf(RECONCILIATION) &&
    allMigrations.indexOf(RECONCILIATION) < allMigrations.indexOf(AUTH_BOOTSTRAP),
  JSON.stringify(allMigrations.filter((f) => f.startsWith("2026")))
);

let bootstrapError = null;
try {
  await db.exec(strip(readFileSync(join(migrationsDir, AUTH_BOOTSTRAP), "utf8")));
} catch (error) {
  bootstrapError = String(error.message).split("\n")[0];
}
ok("20260915131000 applies cleanly on top of the reconciled lineage", bootstrapError === null, bootstrapError ?? "");

const authTriggers = await db.query(`
  select t.tgname, p.proname as fn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal
`);
ok(
  "PR #69's single canonical signup trigger survived the reconciliation",
  authTriggers.rows.length === 1 && authTriggers.rows[0].tgname === "on_auth_user_created",
  JSON.stringify(authTriggers.rows)
);

// End-to-end: the reconciled chain still produces a coherent tenant.
const USER = "e1e1e1e1-2222-4333-8444-555566667777";
await db.query(
  "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)",
  [USER, "Reconciled.User@Nexus.Test", { full_name: "Reconciled User", username: "ReconciledU" }]
);
const endToEnd = await db.query(
  `select (select count(*)::int from public.profiles p           where p.id = $1)      as profiles,
          (select count(*)::int from public.workspaces w         where w.owner_id = $1) as workspaces,
          (select count(*)::int from public.workspace_members m
             where m.user_id = $1 and m.role = 'owner' and m.status = 'active')         as owner_memberships,
          (select count(*)::int from public.workspace_subscriptions s
             where s.plan = 'FREE' and s.status = 'active'
               and s.workspace_id in (select id from public.workspaces where owner_id = $1)) as free_subs,
          (select slug from public.workspaces w where w.owner_id = $1)                  as slug`,
  [USER]
);
ok(
  "signup on the reconciled chain yields 1 profile / 1 workspace / 1 owner membership / 1 FREE subscription",
  one(endToEnd.rows[0].profiles) &&
    one(endToEnd.rows[0].workspaces) &&
    one(endToEnd.rows[0].owner_memberships) &&
    one(endToEnd.rows[0].free_subs),
  JSON.stringify(endToEnd.rows[0])
);
ok(
  "…and the slug normalisation from PR #69 still holds (lowercased, no double hyphen)",
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(endToEnd.rows[0].slug ?? "")) &&
    String(endToEnd.rows[0].slug ?? "").startsWith("reconciledu-"),
  JSON.stringify(endToEnd.rows[0].slug)
);

// ============================================================
console.log("\n== PHASE 6 — every stored RLS policy expression still resolves ==");
// ============================================================
// This is the check a workspace_members.role -> enum conversion would fail:
// pg_get_expr re-parses each stored policy expression, so an invalidated
// operator or a dropped function surfaces here.
const policies = await db.query(`
  select c.relname as table_name, p.polname,
         pg_get_expr(p.polqual, p.polrelid)       as using_expr,
         pg_get_expr(p.polwithcheck, p.polrelid)  as check_expr
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
  order by c.relname, p.polname
`);
ok("the lineage really does install RLS policies", policies.rows.length >= 30, `count=${policies.rows.length}`);

const unresolved = [];
for (const row of policies.rows) {
  for (const expr of [row.using_expr, row.check_expr]) {
    if (!expr) continue;
    try {
      // Re-plan the expression against its own table: this is what the
      // executor does, and it fails on any invalidated operator/function.
      await db.query(`select exists (select 1 from public.${row.table_name} where (${expr})) as ok`);
    } catch (error) {
      unresolved.push(`${row.table_name}.${row.polname}: ${String(error.message).split("\n")[0]}`);
    }
  }
}
ok(
  "every stored policy expression still evaluates (no invalidated operator or function)",
  unresolved.length === 0,
  unresolved.slice(0, 6).join("\n        ")
);

const rlsEnabled = await db.query(`
  select count(*)::int as n from pg_class c join pg_namespace nn on nn.oid = c.relnamespace
  where nn.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
`);
ok("row level security is still enabled on the tenant tables", rlsEnabled.rows[0].n >= 10, JSON.stringify(rlsEnabled.rows[0]));

// ============================================================
console.log("\n== PHASE 7 — nothing creates the void contract ==");
// ============================================================
// The retired file probes these names inside to_regprocedure('...') string
// literals, which sqlCodeOnly() strips. What must never appear in executable
// SQL anywhere is a statement that CREATES them.
const CREATORS = [
  /create\s+type\s+(public\.)?workspace_member_(role|status)\b/i,
  /create\s+(or\s+replace\s+)?function\s+(public\.)?is_workspace_member\s*\(/i,
  /create\s+(or\s+replace\s+)?function\s+(public\.)?has_workspace_role\s*\(/i,
];
const creators = [];
for (const file of allMigrations) {
  const code = sqlCodeOnly(file);
  const hits = CREATORS.filter((re) => re.test(code));
  if (hits.length > 0) creators.push(`${file}: ${hits.length} creating statement(s)`);
}
ok(
  "no migration creates workspace_member_role, workspace_member_status, is_workspace_member or has_workspace_role",
  creators.length === 0,
  creators.join("\n        ")
);

// Positive control: without it the assertion above would also pass if the
// scanner simply matched nothing at all.
const POSITIVE_CONTROL = `create type public.workspace_member_role as enum ('owner','admin');`;
ok(
  "…and the scanner really would detect such a statement (positive control)",
  CREATORS.some((re) => re.test(sqlCodeOnlyFromText(POSITIVE_CONTROL))),
  "the scanner is vacuous"
);
// A comment or a string literal must NOT count as creating anything — that is
// what allows 130000 to keep documenting the retired names.
ok(
  "…while prose and to_regprocedure() literals correctly do NOT count as creating",
  !CREATORS.some((re) => re.test(sqlCodeOnly(VOID_CONTRACT))),
  "130000's guarded probes were mistaken for creating statements"
);

const fakeSubscriptions = allMigrations.filter((file) =>
  /(from|into|table|join|update)\s+(public\.)?subscriptions\b/.test(sqlCodeOnly(file))
);
ok(
  "no migration references a bare public.subscriptions table",
  fakeSubscriptions.length === 0,
  fakeSubscriptions.join(", ")
);

// ============================================================
console.log("\n== PHASE 8 — the reconciliation is idempotent ==");
// ============================================================
const functionsBefore = (
  await db.query(`
    select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'`)
).rows[0].n;

let reapplyError = null;
try {
  await db.exec(strip(readFileSync(join(migrationsDir, RECONCILIATION), "utf8")));
} catch (error) {
  reapplyError = String(error.message).split("\n")[0];
}
ok("re-applying 20260915130500 does not fail", reapplyError === null, reapplyError ?? "");

const functionsAfter = (
  await db.query(`
    select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'`)
).rows[0].n;
ok("re-applying creates no duplicate function", functionsBefore === functionsAfter, `${functionsBefore} -> ${functionsAfter}`);

const helperCounts = await db.query(`
  select p.proname, count(*)::int as n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('is_active_workspace_member','can_manage_workspace','is_workspace_owner')
  group by p.proname order by p.proname
`);
ok(
  "each canonical helper still has exactly one signature",
  helperCounts.rows.length === 3 && helperCounts.rows.every((r) => one(r.n)),
  JSON.stringify(helperCounts.rows)
);

const stillPinned = await db.query(`
  select count(*)::int as n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('is_active_workspace_member','can_manage_workspace','is_workspace_owner')
    and (p.proconfig @> array['search_path=public, pg_temp'])
`);
ok("all three helpers are still pinned after re-apply", stillPinned.rows[0].n === 3, JSON.stringify(stillPinned.rows[0]));

// ============================================================
console.log("\n== PHASE 9 — the COMPLETE chain applies in one pass ==");
// ============================================================
// The headline result of retiring 20260915130000: a runner that simply applies
// every file in supabase/migrations/ in order - which is what `supabase db
// reset` does - now succeeds. Before the retirement it died at 130000.
const full = await createPlatformDb();
const fullFailures = [];
for (const file of allMigrations) {
  try {
    await full.exec(strip(readFileSync(join(migrationsDir, file), "utf8")));
  } catch (error) {
    fullFailures.push(`${file}: ${String(error.message).split("\n")[0]}`);
  }
}
ok(
  `every file in supabase/migrations/ applies in order, one pass (${allMigrations.length} files)`,
  fullFailures.length === 0,
  fullFailures.join("\n        ")
);
ok(
  "…and that chain really contains the retired contract plus both 2026 migrations",
  [VOID_CONTRACT, RECONCILIATION, AUTH_BOOTSTRAP].every((f) => allMigrations.includes(f)),
  JSON.stringify(allMigrations.filter((f) => f.startsWith("2026")))
);

// Signup through the complete chain, exactly as `db reset` + first user would.
const FULL_USER = "a1b2c3d4-2222-4333-8444-555566667777";
await full.query(
  "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)",
  [FULL_USER, "Full.Chain@Nexus.Test", { full_name: "Full Chain", username: "FullChain" }]
);
const fullSignup = await full.query(
  `select (select count(*)::int from public.profiles p where p.id = $1)              as profiles,
          (select count(*)::int from public.workspaces w where w.owner_id = $1)      as workspaces,
          (select count(*)::int from public.workspace_members m
             where m.user_id = $1 and m.role = 'owner' and m.status = 'active')      as owner_memberships,
          (select count(*)::int from public.workspace_subscriptions s
             where s.plan = 'FREE' and s.status = 'active'
               and s.workspace_id in (select id from public.workspaces where owner_id = $1)) as free_subs,
          (select count(*)::int from pg_trigger t
             join pg_class c on c.oid = t.tgrelid
             join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal) as auth_triggers`,
  [FULL_USER]
);
ok(
  "signup on the COMPLETE chain yields 1 profile / 1 workspace / 1 owner membership / 1 FREE subscription",
  one(fullSignup.rows[0].profiles) &&
    one(fullSignup.rows[0].workspaces) &&
    one(fullSignup.rows[0].owner_memberships) &&
    one(fullSignup.rows[0].free_subs),
  JSON.stringify(fullSignup.rows[0])
);
ok(
  "…and exactly one auth.users trigger survives the whole chain",
  one(fullSignup.rows[0].auth_triggers),
  JSON.stringify(fullSignup.rows[0].auth_triggers)
);

// The retired contract must stay inert even on a fully migrated database.
let retiredTwiceError = null;
try {
  await full.exec(strip(readFileSync(join(migrationsDir, VOID_CONTRACT), "utf8")));
} catch (error) {
  retiredTwiceError = String(error.message).split("\n")[0];
}
ok(
  "re-applying the retired contract after the full chain is still inert",
  retiredTwiceError === null,
  retiredTwiceError ?? ""
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
