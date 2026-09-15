/**
 * ============================================================
 * NEXUS — CORE CONTRACT RETIREMENT GUARD
 * ============================================================
 * `20260915130000_nexus_core_contract.sql` used to install an enum-based
 * "core contract" (`workspace_member_role`, `is_workspace_member(uuid)`,
 * `has_workspace_role(uuid, workspace_member_role[])`) that this repository
 * has never contained. It was retired to a guarded no-op.
 *
 * THIS FILE IS A CANARY. Its only job is to fail loudly if that contract is
 * ever revived — by restoring the old bodies, by creating the enums, or by
 * adding the two imaginary helpers beside the real ones.
 *
 * It deliberately does NOT re-prove the lineage analysis. For the evidence,
 * the compatibility matrix and the full end-to-end chain see:
 *   docs/supabase/LINEAGE_RECONCILIATION.md
 *   supabase/tests/lineage-reconciliation.test.mjs   (phases 1-9)
 *
 * No remote Supabase operation. No db reset, no db push, no migration repair.
 * ============================================================
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const RETIRED = "20260915130000_nexus_core_contract.sql";

let passed = 0;
let failed = 0;
function ok(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    if (detail) console.log(`        ${detail}`);
  }
}

/**
 * Migration text with prose removed, so a hit is real SQL and not a sentence
 * documenting the retired contract. Tracks line comments, single-quoted
 * literals (with '' escapes) and $$ / $tag$ dollar-quoted bodies.
 */
function sqlCodeOnly(text) {
  let out = "";
  let i = 0;
  let dollar = null;
  while (i < text.length) {
    if (dollar) {
      if (text.startsWith(dollar, i)) {
        out += dollar;
        i += dollar.length;
        dollar = null;
        continue;
      }
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

const strip = (sql) => sql.replace(/create extension if not exists pgcrypto;\s*/gi, "");

const allMigrations = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const lineageFiles = allMigrations.filter(
  (f) =>
    f === "001_nexus_base_schema.sql" ||
    (/^(0[0-9]{2}|[12][0-9]{2})_/.test(f) && !f.startsWith("2026"))
);

const retiredText = readFileSync(join(migrationsDir, RETIRED), "utf8");
const retiredCode = sqlCodeOnly(retiredText);

console.log("\n== 1 — the retired file must create nothing ==");
const DDL = [
  ["create type", /create\s+type\b/i],
  ["create table", /create\s+table\b/i],
  ["create policy", /create\s+policy\b/i],
  ["create trigger", /create\s+trigger\b/i],
  ["create function", /create\s+(or\s+replace\s+)?function\b/i],
  ["alter table", /alter\s+table\b/i],
  ["drop function", /drop\s+function\b/i],
];
for (const [label, re] of DDL) {
  ok(`no \`${label}\` in executable SQL`, !re.test(retiredCode), "the contract is being revived");
}

// Canary self-check: the scanner must actually be able to see DDL, otherwise
// every assertion above would pass on an empty file too.
ok(
  "…and the scanner really does see DDL (self-check)",
  DDL.every(([, re]) => re.test(sqlCodeOnly("create type t as enum ('a'); create table u(id int); " +
    "create policy p on u for select using (true); create trigger tr before insert on u " +
    "execute function f(); create or replace function f() returns int language sql as $$ select 1 $$; " +
    "alter table u add column c int; drop function if exists g();")))
);

console.log("\n== 2 — the retired file still exists and keeps its version key ==");
ok("20260915130000_nexus_core_contract.sql is still present", allMigrations.includes(RETIRED));
ok(
  "it still sorts before the reconciliation and the auth bootstrap",
  allMigrations.indexOf(RETIRED) < allMigrations.indexOf("20260915130500_nexus_lineage_reconciliation.sql") &&
    allMigrations.indexOf("20260915130500_nexus_lineage_reconciliation.sql") <
      allMigrations.indexOf("20260915131000_nexus_auth_workspace_bootstrap.sql")
);

// ------------------------------------------------------------
// Apply the real lineage, then the retired contract.
// ------------------------------------------------------------
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

let lineageError = null;
try {
  for (const file of lineageFiles) {
    await db.exec(strip(readFileSync(join(migrationsDir, file), "utf8")));
  }
} catch (error) {
  lineageError = String(error.message).split("\n")[0];
}
ok(`the lineage of record applies (${lineageFiles.length} files)`, lineageError === null, lineageError ?? "");

let retiredError = null;
try {
  await db.exec(strip(retiredText));
} catch (error) {
  retiredError = String(error.message).split("\n")[0];
}

console.log("\n== 3 — applying it is safe ==");
ok("the retired contract applies cleanly on the lineage of record", retiredError === null, retiredError ?? "");

const voidObjects = await db.query(`
  select to_regtype('public.workspace_member_role')                                        as enum_role,
         to_regtype('public.workspace_member_status')                                      as enum_status,
         to_regprocedure('public.is_workspace_member(uuid)')                               as is_workspace_member,
         to_regprocedure('public.has_workspace_role(uuid, public.workspace_member_role[])') as has_workspace_role
`);
ok(
  "none of the four void objects exist afterwards",
  Object.values(voidObjects.rows[0]).every((v) => v === null),
  JSON.stringify(voidObjects.rows[0])
);

const helpers = await db.query(`
  select p.proname,
         p.prosecdef,
         p.proconfig::text as cfg,
         pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('is_active_workspace_member','can_manage_workspace','is_workspace_owner')
  order by p.proname
`);
ok("the three canonical helpers still exist", helpers.rows.length === 3, JSON.stringify(helpers.rows.map((r) => r.proname)));
ok(
  "…all still SECURITY DEFINER",
  helpers.rows.every((r) => r.prosecdef === true)
);
ok(
  "…all pinned to search_path = public, pg_temp (the retired file's one legitimate job)",
  helpers.rows.every((r) => /search_path=public,\s*pg_temp/.test(r.cfg)),
  JSON.stringify(helpers.rows.map((r) => r.cfg))
);
ok(
  "can_manage_workspace() keeps the lineage's text semantics — no enum cast was smuggled back in",
  !/workspace_member_role/.test(
    helpers.rows.find((r) => r.proname === "can_manage_workspace")?.def ?? "MISSING"
  )
);

const acls = await db.query(`
  select has_function_privilege('anon',          'public.is_active_workspace_member(uuid, uuid)', 'EXECUTE') as active_anon,
         has_function_privilege('authenticated','public.is_active_workspace_member(uuid, uuid)', 'EXECUTE') as active_auth,
         has_function_privilege('service_role', 'public.is_active_workspace_member(uuid, uuid)', 'EXECUTE') as active_srv,
         has_function_privilege('anon',         'public.is_workspace_owner(uuid, uuid)',         'EXECUTE') as owner_anon
`);
ok(
  "EXECUTE is explicit for anon / authenticated / service_role",
  Object.values(acls.rows[0]).every((v) => v === true || v === "t" || v === 1),
  JSON.stringify(acls.rows[0])
);

console.log("\n== 4 — it stays inert on re-apply ==");
let twiceError = null;
try {
  await db.exec(strip(retiredText));
} catch (error) {
  twiceError = String(error.message).split("\n")[0];
}
ok("re-applying does not fail", twiceError === null, twiceError ?? "");
const stillVoid = await db.query(
  `select to_regtype('public.workspace_member_role') as e,
          to_regprocedure('public.is_workspace_member(uuid)') as f`
);
ok(
  "…and still installs no void object",
  stillVoid.rows[0].e === null && stillVoid.rows[0].f === null,
  JSON.stringify(stillVoid.rows[0])
);

console.log("\n== 5 — no other migration revives the contract ==");
const revived = allMigrations.filter((file) => {
  const code = sqlCodeOnly(readFileSync(join(migrationsDir, file), "utf8"));
  return (
    /create\s+type\s+(public\.)?workspace_member_(role|status)\b/i.test(code) ||
    /create\s+(or\s+replace\s+)?function\s+(public\.)?is_workspace_member\s*\(/i.test(code) ||
    /create\s+(or\s+replace\s+)?function\s+(public\.)?has_workspace_role\s*\(/i.test(code)
  );
});
ok(
  "no migration in supabase/migrations/ creates the void contract",
  revived.length === 0,
  revived.join(", ")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
