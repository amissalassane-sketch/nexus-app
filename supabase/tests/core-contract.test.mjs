import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(
  here,
  "..",
  "migrations",
  "20260915130000_nexus_core_contract.sql"
);

const db = await PGlite.create();
let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

await db.exec(`
  create role authenticated;
  create role anon;
  create role service_role;

  create schema auth;
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('test.current_user_id', true), '')::uuid;
  $$;

  create type public.workspace_member_role as enum ('owner', 'admin', 'member', 'viewer');
  create type public.workspace_member_status as enum ('active', 'invited', 'suspended');

  create table public.profiles (
    id uuid primary key
  );

  create table public.workspaces (
    id uuid primary key,
    owner_id uuid not null
  );

  create table public.workspace_members (
    workspace_id uuid not null,
    user_id uuid not null,
    role public.workspace_member_role not null,
    status public.workspace_member_status not null,
    primary key (workspace_id, user_id)
  );

  create or replace function public.is_workspace_member(target_workspace_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace_id
        and user_id = auth.uid()
        and status = 'active'
    );
  $$;

  create or replace function public.has_workspace_role(
    target_workspace_id uuid,
    allowed_roles public.workspace_member_role[]
  )
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace_id
        and user_id = auth.uid()
        and status = 'active'
        and role = any(allowed_roles)
    );
  $$;
`);

await db.exec(readFileSync(migrationPath, "utf8"));
await db.exec(`
  insert into public.profiles (id) values
    ('11111111-1111-1111-1111-111111111111'),
    ('22222222-2222-2222-2222-222222222222'),
    ('33333333-3333-3333-3333-333333333333');

  insert into public.workspaces (id, owner_id) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333');

  insert into public.workspace_members (workspace_id, user_id, role, status) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin', 'active'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member', 'suspended'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner', 'active');
`);

const functions = await db.query(`
  select
    p.proname,
    pg_get_function_identity_arguments(p.oid) as args,
    p.prosecdef,
    p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'is_workspace_member',
      'has_workspace_role',
      'is_active_workspace_member',
      'can_manage_workspace',
      'is_workspace_owner'
    )
`);

assert("all five contract helpers exist", functions.rows.length === 5);
assert(
  "all contract helpers are SECURITY DEFINER",
  functions.rows.length === 5 && functions.rows.every((row) => row.prosecdef === true)
);
assert(
  "all contract helpers pin search_path",
  functions.rows.length === 5 &&
    functions.rows.every((row) =>
      (row.proconfig ?? []).some((setting) => setting === "search_path=public, pg_temp")
    ),
  JSON.stringify(functions.rows)
);

const grants = await db.query(`
  select
    has_function_privilege('public', 'public.is_workspace_member(uuid)', 'EXECUTE') as member_public,
    has_function_privilege('anon', 'public.is_workspace_member(uuid)', 'EXECUTE') as member_anon,
    has_function_privilege('authenticated', 'public.is_workspace_member(uuid)', 'EXECUTE') as member_auth,
    has_function_privilege('authenticated', 'public.has_workspace_role(uuid, public.workspace_member_role[])', 'EXECUTE') as role_auth,
    has_function_privilege('authenticated', 'public.is_active_workspace_member(uuid, uuid)', 'EXECUTE') as active_auth,
    has_function_privilege('authenticated', 'public.can_manage_workspace(uuid, uuid)', 'EXECUTE') as manage_auth,
    has_function_privilege('authenticated', 'public.is_workspace_owner(uuid, uuid)', 'EXECUTE') as owner_auth,
    has_function_privilege('anon', 'public.is_workspace_owner(uuid, uuid)', 'EXECUTE') as owner_anon
`);

assert(
  "canonical helpers are not executable by public or anon",
  grants.rows[0].member_public === false &&
    grants.rows[0].member_anon === false &&
    grants.rows[0].owner_anon === false,
  JSON.stringify(grants.rows[0])
);
assert(
  "authenticated can execute all required helpers",
  grants.rows[0].member_auth === true &&
    grants.rows[0].role_auth === true &&
    grants.rows[0].active_auth === true &&
    grants.rows[0].manage_auth === true &&
    grants.rows[0].owner_auth === true,
  JSON.stringify(grants.rows[0])
);

await db.exec("select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false)");
const ownerChecks = await db.query(`
  select
    public.is_workspace_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as is_member,
    public.has_workspace_role(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      array['owner'::public.workspace_member_role]
    ) as is_owner_role,
    public.can_manage_workspace('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as can_manage,
    public.is_workspace_owner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as is_workspace_owner,
    public.is_workspace_member('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') as other_workspace_member
`);
assert(
  "owner receives member, role, manage, and ownership access only in own workspace",
  ownerChecks.rows[0].is_member === true &&
    ownerChecks.rows[0].is_owner_role === true &&
    ownerChecks.rows[0].can_manage === true &&
    ownerChecks.rows[0].is_workspace_owner === true &&
    ownerChecks.rows[0].other_workspace_member === false,
  JSON.stringify(ownerChecks.rows[0])
);

await db.exec("select set_config('test.current_user_id', '22222222-2222-2222-2222-222222222222', false)");
const adminChecks = await db.query(`
  select
    public.is_workspace_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as is_member,
    public.has_workspace_role(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      array['admin'::public.workspace_member_role]
    ) as is_admin_role,
    public.can_manage_workspace('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as can_manage,
    public.is_workspace_owner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as is_workspace_owner
`);
assert(
  "admin receives member, role, and manage access but is not owner",
  adminChecks.rows[0].is_member === true &&
    adminChecks.rows[0].is_admin_role === true &&
    adminChecks.rows[0].can_manage === true &&
    adminChecks.rows[0].is_workspace_owner === false,
  JSON.stringify(adminChecks.rows[0])
);

await db.exec("select set_config('test.current_user_id', '33333333-3333-3333-3333-333333333333', false)");
const suspendedChecks = await db.query(`
  select
    public.is_workspace_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as is_member,
    public.can_manage_workspace('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as can_manage,
    public.is_workspace_owner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as is_workspace_owner
`);
assert(
  "suspended member is denied and cannot claim another workspace",
  suspendedChecks.rows[0].is_member === false &&
    suspendedChecks.rows[0].can_manage === false &&
    suspendedChecks.rows[0].is_workspace_owner === false,
  JSON.stringify(suspendedChecks.rows[0])
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
