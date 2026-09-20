/**
 * ============================================================
 * NEXUS — HERMETIC BRIDGE & FULL LINEAGE INTEGRITY TEST
 * ============================================================
 * Verifies the complete chronological migration chain:
 *   001_nexus_core.sql -> 005_nexus_worker.sql (remote baseline)
 *   -> 006 (with Bridge preamble) -> 028 -> 20260915*
 *
 * Invariants checked:
 * 1. Bridge executes before 006 workspace bootstrap body.
 * 2. workspaces.slug receives a DEFAULT before 006 insert.
 * 3. is_active_workspace_member exists before 015.
 * 4. can_manage_workspace exists before 016.
 * 5. is_workspace_owner is created by 017.
 * 6. anon CANNOT execute is_active_workspace_member or can_manage_workspace.
 * 7. authenticated CAN execute both helpers.
 * 8. PostgreSQL ENUMs (workspace_member_role, workspace_member_status) remain untouched.
 * 9. SECURITY DEFINER helpers have explicit search_path = public, pg_temp.
 * 10. End-to-end access behaviors:
 *     A. stranger isolation
 *     B. invited member denied
 *     C. suspended member denied
 *     D. active member allowed
 *     E. active admin allowed to manage
 *     F. active owner allowed to manage
 *     G. existing slug unchanged
 *     H. new workspace receives valid slug
 *
 * Completely hermetic, in-process via PGlite. Zero remote operations.
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

function ok(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

async function expectError(name, fn, needle) {
  try {
    await fn();
    failed += 1;
    console.log(`  FAIL  ${name}\n        expected error containing "${needle}", but succeeded`);
  } catch (err) {
    const msg = String(err.message || err);
    if (!needle || msg.includes(needle)) {
      passed += 1;
      console.log(`  PASS  ${name}`);
    } else {
      failed += 1;
      console.log(`  FAIL  ${name}\n        got: ${msg}`);
    }
  }
}

const mockSearchAiMemories = `create or replace function public.search_ai_memories(
  query_embedding double precision[],
  target_workspace_id uuid,
  match_threshold float default 0.70,
  match_count integer default 8
)
returns table (
  id uuid,
  memory_type public.ai_memory_type,
  content text,
  importance numeric,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.memory_type,
    m.content,
    m.importance,
    0.9::float as similarity
  from public.ai_memories m
  where m.workspace_id = target_workspace_id
    and public.is_workspace_member(target_workspace_id)
  limit match_count;
$$;`;

// In PGlite WASM, C-extension dynamic libraries (pgcrypto, pgvector HNSW) are emulated in-memory.
const strip = (sql) => {
  let s = sql
    .replace(/create extension if not exists "pgcrypto";/gi, "-- pgcrypto")
    .replace(/create extension if not exists pgcrypto;/gi, "-- pgcrypto")
    .replace(/create extension if not exists vector;/gi, "-- vector")
    .replace(/vector\(1536\)/gi, "double precision[]")
    .replace(/create index idx_ai_memories_embedding[\s\S]*?;/gi, "-- hnsw index emulated;");
  s = s.replace(/create or replace function public\.search_ai_memories[\s\S]*?\$\$;/gi, () => mockSearchAiMemories);
  return s;
};

console.log("\n-- NEXUS BRIDGE & LINEAGE HERMETIC TEST --\n");

const db = await PGlite.create();

// 1. Initialize environment with standard Supabase platform roles and stubs
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

  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );

  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  create or replace function auth.role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
  $$;

  -- Emulate Supabase storage schema for 002
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key,
    name text not null,
    owner uuid,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    public boolean default false
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text,
    owner uuid,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    last_accessed_at timestamptz default now(),
    metadata jsonb default '{}'::jsonb,
    path_tokens text[]
  );
`);

// 2. Apply remote historical lineage: 001_nexus_core .. 005_nexus_worker
console.log("Applying 001_nexus_core .. 005_nexus_worker (remote baseline)...");
for (let i = 1; i <= 5; i++) {
  const filename = readdirSync(migrationsDir).find(f => f.startsWith(`00${i}_`));
  if (!filename) throw new Error(`Missing remote baseline migration 00${i}_`);
  const sql = strip(readFileSync(join(migrationsDir, filename), "utf8"));
  await db.exec(sql);
}

// Verify baseline state after 005
const baselineSlugCol = await db.query(`
  select column_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'workspaces' and column_name = 'slug';
`);
ok("Baseline 001..005: workspaces.slug has NO default yet", baselineSlugCol.rows[0]?.column_default === null);

const baselineEnumRole = await db.query(`
  select udt_name from information_schema.columns
  where table_schema = 'public' and table_name = 'workspace_members' and column_name = 'role';
`);
ok("Baseline 001..005: workspace_members.role is enum workspace_member_role", baselineEnumRole.rows[0]?.udt_name === "workspace_member_role");

// Seed an existing workspace in remote baseline to verify slug stability later
const SEED_WS_ID = "11111111-1111-1111-1111-111111111111";
const SEED_OWNER_ID = "22222222-2222-2222-2222-222222222222";
// Inserting into auth.users automatically triggers public.handle_new_user() creating the profile
await db.exec(`
  insert into auth.users (id, email) values ('${SEED_OWNER_ID}', 'seed-owner@nexus.internal');
  insert into public.workspaces (id, name, slug, owner_id)
  values ('${SEED_WS_ID}', 'Seed Workspace', 'seed-original-slug', '${SEED_OWNER_ID}');
`);

// 3. Apply 006 with Bridge Preamble
console.log("Applying 006_nexus_workspace_bootstrap.sql with bridge preamble...");
const sql006 = strip(readFileSync(join(migrationsDir, "006_nexus_workspace_bootstrap.sql"), "utf8"));
await db.exec(sql006);

// Verify Bridge Invariants right after 006
const slugDefAfter006 = await db.query(`
  select column_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'workspaces' and column_name = 'slug';
`);
ok("Invariant: slug has DEFAULT after bridge preamble in 006", String(slugDefAfter006.rows[0]?.column_default).includes("gen_random_uuid"));

const helperActiveAfter006 = await db.query(`
  select routine_name, routine_type, security_type
  from information_schema.routines
  where routine_schema = 'public' and routine_name = 'is_active_workspace_member';
`);
ok("Invariant: is_active_workspace_member exists right after 006", helperActiveAfter006.rows.length === 1);
ok("Invariant: is_active_workspace_member is SECURITY DEFINER", helperActiveAfter006.rows[0]?.security_type === "DEFINER");

const helperManageAfter006 = await db.query(`
  select routine_name, routine_type, security_type
  from information_schema.routines
  where routine_schema = 'public' and routine_name = 'can_manage_workspace';
`);
ok("Invariant: can_manage_workspace exists right after 006", helperManageAfter006.rows.length === 1);
ok("Invariant: can_manage_workspace is SECURITY DEFINER", helperManageAfter006.rows[0]?.security_type === "DEFINER");

// Verify SECURITY DEFINER search_path = public, pg_temp
const searchPathCheck = await db.query(`
  select proname, proconfig
  from pg_proc
  where proname in ('is_active_workspace_member', 'can_manage_workspace');
`);
for (const row of searchPathCheck.rows) {
  const cfg = String(row.proconfig);
  ok(`Invariant: ${row.proname} has secured search_path (public, pg_temp)`, cfg.includes("public") && cfg.includes("pg_temp"));
}

// Verify Privilege Invariants: anon CANNOT execute, authenticated CAN execute
await db.exec(`set role anon;`);
await expectError(
  "Invariant: anon cannot execute is_active_workspace_member",
  () => db.query(`select public.is_active_workspace_member('${SEED_WS_ID}', '${SEED_OWNER_ID}')`),
  "permission denied"
);
await expectError(
  "Invariant: anon cannot execute can_manage_workspace",
  () => db.query(`select public.can_manage_workspace('${SEED_WS_ID}', '${SEED_OWNER_ID}')`),
  "permission denied"
);
await db.exec(`reset role;`);

// As authenticated, caller CAN execute both helpers (SEED_OWNER_ID is active owner -> returns true)
await db.exec(`set role authenticated;`);
const authExecActive = await db.query(`select public.is_active_workspace_member('${SEED_WS_ID}', '${SEED_OWNER_ID}') as res`);
ok("Invariant: authenticated CAN execute is_active_workspace_member", authExecActive.rows[0]?.res === true);

const authExecManage = await db.query(`select public.can_manage_workspace('${SEED_WS_ID}', '${SEED_OWNER_ID}') as res`);
ok("Invariant: authenticated CAN execute can_manage_workspace", authExecManage.rows[0]?.res === true);
await db.exec(`reset role;`);

// 4. Test 006 trigger with default slug on user signup
const NEW_USER_ID = "33333333-3333-3333-3333-333333333333";
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data)
  values ('${NEW_USER_ID}', 'test-bootstrap@nexus.internal', '{"name":"New Guy"}'::jsonb);
`);
const newWs = await db.query(`select id, name, slug from public.workspaces where owner_id = '${NEW_USER_ID}';`);
ok("Invariant: 006 workspace trigger succeeds with valid fallback slug", newWs.rows.length === 1 && Boolean(newWs.rows[0]?.slug));

// 5. Apply migrations 007 through 028 and timestamped migrations
console.log("Applying remaining migrations 007 through 028 and 20260915*...");
const allFiles = readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
for (const file of allFiles) {
  const num = parseInt(file.split("_")[0], 10);
  if (num <= 6) continue; // Already applied 001..006
  const sql = strip(readFileSync(join(migrationsDir, file), "utf8"));
  try {
    await db.exec(sql);
  } catch (err) {
    throw new Error(`Failed on migration ${file}: ${err.message}`);
  }
}
ok("Full chronological migration chain 001 -> 005 -> 006 -> 028 -> 2026* applied without error", true);

// 6. Verify Post-lineage State Invariants
const enumCheckAfter = await db.query(`
  select udt_name from information_schema.columns
  where table_schema = 'public' and table_name = 'workspace_members' and column_name = 'role';
`);
ok("Invariant: workspace_members.role ENUM is preserved across entire lineage", enumCheckAfter.rows[0]?.udt_name === "workspace_member_role");

// Invariant: is_workspace_owner exists (created by 017)
const ownerFn = await db.query(`
  select routine_name from information_schema.routines
  where routine_schema = 'public' and routine_name = 'is_workspace_owner';
`);
ok("Invariant: is_workspace_owner exists (created by 017)", ownerFn.rows.length === 1);

// Invariant: Existing slug unchanged
const origWs = await db.query(`select slug from public.workspaces where id = '${SEED_WS_ID}';`);
ok("Invariant: Pre-existing workspace slug unchanged", origWs.rows[0]?.slug === "seed-original-slug");

// 7. Verify Functional Access Matrix (A through F)
console.log("Testing access matrix (stranger, invited, suspended, member, admin, owner)...");

const WS_ID = "44444444-4444-4444-4444-444444444444";
const OWNER = "55555555-5555-5555-5555-555555555555";
const ADMIN = "66666666-6666-6666-6666-666666666666";
const MEMBER = "77777777-7777-7777-7777-777777777777";
const SUSPENDED = "88888888-8888-8888-8888-888888888888";
const INVITED = "99999999-9999-9999-9999-999999999999";
const STRANGER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

for (const u of [OWNER, ADMIN, MEMBER, SUSPENDED, INVITED, STRANGER]) {
  await db.exec(`
    insert into auth.users (id, email) values ('${u}', '${u}@nexus.internal');
  `);
}

// Ensure OWNER is on TEAM plan so freemium write guard allows additional workspaces
await db.exec(`
  update public.workspace_subscriptions
  set plan = 'TEAM'
  where workspace_id in (select id from public.workspaces where owner_id = '${OWNER}');

  insert into public.workspaces (id, name, slug, owner_id)
  values ('${WS_ID}', 'Matrix Workspace', 'matrix-ws', '${OWNER}');

  -- Workspace creation automatically inserts a FREE subscription; update to TEAM to allow multiple members
  update public.workspace_subscriptions
  set plan = 'TEAM'
  where workspace_id = '${WS_ID}';

  insert into public.workspace_members (workspace_id, user_id, role, status) values
    ('${WS_ID}', '${ADMIN}', 'admin', 'active'),
    ('${WS_ID}', '${MEMBER}', 'member', 'active'),
    ('${WS_ID}', '${SUSPENDED}', 'member', 'suspended'),
    ('${WS_ID}', '${INVITED}', 'member', 'invited');
`);

// A. stranger isolation
const strangerActive = (await db.query(`select public.is_active_workspace_member('${WS_ID}', '${STRANGER}') as v`)).rows[0]?.v;
const strangerManage = (await db.query(`select public.can_manage_workspace('${WS_ID}', '${STRANGER}') as v`)).rows[0]?.v;
ok("Matrix A: Stranger denied active membership and management", !strangerActive && !strangerManage);

// B. invited member denied
const invitedActive = (await db.query(`select public.is_active_workspace_member('${WS_ID}', '${INVITED}') as v`)).rows[0]?.v;
const invitedManage = (await db.query(`select public.can_manage_workspace('${WS_ID}', '${INVITED}') as v`)).rows[0]?.v;
ok("Matrix B: Invited member denied active membership and management", !invitedActive && !invitedManage);

// C. suspended member denied
const suspendedActive = (await db.query(`select public.is_active_workspace_member('${WS_ID}', '${SUSPENDED}') as v`)).rows[0]?.v;
const suspendedManage = (await db.query(`select public.can_manage_workspace('${WS_ID}', '${SUSPENDED}') as v`)).rows[0]?.v;
ok("Matrix C: Suspended member denied active membership and management", !suspendedActive && !suspendedManage);

// D. active member allowed active, denied manage
const memberActive = (await db.query(`select public.is_active_workspace_member('${WS_ID}', '${MEMBER}') as v`)).rows[0]?.v;
const memberManage = (await db.query(`select public.can_manage_workspace('${WS_ID}', '${MEMBER}') as v`)).rows[0]?.v;
ok("Matrix D: Active member allowed active membership, denied management", memberActive === true && memberManage === false);

// E. active admin allowed to manage
const adminActive = (await db.query(`select public.is_active_workspace_member('${WS_ID}', '${ADMIN}') as v`)).rows[0]?.v;
const adminManage = (await db.query(`select public.can_manage_workspace('${WS_ID}', '${ADMIN}') as v`)).rows[0]?.v;
ok("Matrix E: Active admin allowed active membership and management", adminActive === true && adminManage === true);

// F. active owner allowed to manage
const ownerActive = (await db.query(`select public.is_active_workspace_member('${WS_ID}', '${OWNER}') as v`)).rows[0]?.v;
const ownerManage = (await db.query(`select public.can_manage_workspace('${WS_ID}', '${OWNER}') as v`)).rows[0]?.v;
ok("Matrix F: Active owner allowed active membership and management", ownerActive === true && ownerManage === true);

// G. existing slug unchanged
const matrixWs = await db.query(`select slug from public.workspaces where id = '${WS_ID}';`);
ok("Matrix G: Existing workspace slug unchanged", matrixWs.rows[0]?.slug === "matrix-ws");

// H. new workspace receives valid slug
const NEW_USER_2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data)
  values ('${NEW_USER_2}', 'another-user@nexus.internal', '{"name":"Second Guy"}'::jsonb);
`);
const newWs2 = await db.query(`select id, name, slug from public.workspaces where owner_id = '${NEW_USER_2}';`);
ok("Matrix H: New workspace receives valid slug", newWs2.rows.length === 1 && typeof newWs2.rows[0]?.slug === "string" && newWs2.rows[0]?.slug.length > 3);

console.log(`\nHermetic Lineage Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
