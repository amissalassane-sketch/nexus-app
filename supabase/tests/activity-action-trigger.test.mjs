/**
 * ============================================================
 * NEXUS — ACTIVITY TRIGGER ENUM CONTRACT TEST
 * ============================================================
 * Regression for the "cannot create a project" incident fixed by
 * 20260922120000_fix_activity_action_trigger_cast.sql:
 *
 * 001_nexus_core.sql defines public.activities.action as the enum
 * public.activity_action, but the audit trigger installed by
 * 015_dependencies_and_activity.sql wrote a bare CASE of string
 * literals into it. PostgreSQL types an all-unknown-literal CASE as
 * TEXT, there is no implicit text -> enum cast, so every row the
 * trigger recorded failed with
 *
 *   42804: column "action" is of type activity_action
 *          but expression is of type text
 *
 * — and because the trigger fires AFTER ROW on projects, tasks and
 * goals, the caller's whole statement rolled back with it. Creating
 * a project was impossible on any database built from the real
 * lineage; the UI surfaced it as "This workspace is temporarily
 * unavailable while its data structure is updated."
 *
 * The older suites never caught it because the PGlite fixture
 * (00_base_schema_fixture.sql) approximated activities.action as
 * plain text. This test applies the FULL versioned lineage (fixture
 * + every migration, including 20260922120000) and proves:
 *
 *   1. the column is the enum after the lineage applies (drift
 *      reconciled, even in this test world);
 *   2. the installed record_workspace_activity() carries the
 *      explicit ::public.activity_action cast;
 *   3. 015's original uncasted expression is still rejected by the
 *      enum column with 42804 (negative control — the
 *      incompatibility is real, the cast is what fixes it);
 *   4. the product flow end-to-end: insert / update / delete a
 *      project exactly as src/components/project-manager.tsx does,
 *      and each write records the right activity row.
 *
 * No remote Supabase operation. No db reset, no db push.
 * ============================================================
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const FIX = "20260922120000_fix_activity_action_trigger_cast.sql";

let passed = 0;
let failed = 0;

function ok(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

const db = await PGlite.create();

// ------------------------------------------------------------
// Local lineage setup — same pattern as the freemium contract suite
// ------------------------------------------------------------
await db.exec(readFileSync(join(here, "00_base_schema_fixture.sql"), "utf8"));
await db.exec(`
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'create role service_role nologin';
  end if;
end
$$;
`);
const SKIPPED = new Set([
  "026_admin_control_plane.sql",
  "027_admin_directory.sql",
  "028_admin_activity_security.sql",
  "029_admin_subscriptions.sql",
  "20260915130000_nexus_core_contract.sql",
  "20260915130500_nexus_lineage_reconciliation.sql",
  "20260915131000_nexus_auth_workspace_bootstrap.sql",
  "002_nexus_storage.sql",
  "003_nexus_ai.sql",
  "004_nexus_automations.sql",
  "005_nexus_worker.sql",
]);
const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql") && !file.startsWith("001_"))
  .filter((file) => !SKIPPED.has(file))
  .sort();
for (const file of migrations) {
  const sql = readFileSync(join(migrationsDir, file), "utf8").replace(
    /create extension if not exists pgcrypto;\s*/gi,
    ""
  );
  await db.exec(sql);
}
ok("full lineage (fixture + 006 -> 2026*) applies with the fix in place", true);
ok("the fix migration is part of the applied lineage", migrations.includes(FIX));

// ------------------------------------------------------------
// 1. The column is the enum after the lineage applies
// ------------------------------------------------------------
console.log("\n-- column contract ----------------------------------");
const actionType = await db.query(`
  select udt_name from information_schema.columns
   where table_schema = 'public' and table_name = 'activities' and column_name = 'action'
`);
ok(
  "activities.action is the activity_action enum after the lineage",
  actionType.rows[0]?.udt_name === "activity_action",
  JSON.stringify(actionType.rows)
);

// ------------------------------------------------------------
// 2. The installed trigger function carries the explicit cast
// ------------------------------------------------------------
const fnCheck = await db.query(`
  select p.prosrc, p.prosecdef, p.proconfig::text as config
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'record_workspace_activity'
`);
const body = fnCheck.rows[0]?.prosrc ?? "";
ok(
  "record_workspace_activity() casts the action expression to public.activity_action",
  body.includes("::public.activity_action"),
  "installed body lacks the cast"
);
ok(
  "record_workspace_activity() is still security definer with an explicit search_path",
  fnCheck.rows[0]?.prosecdef === true && /search_path\s*=\s*public/.test(fnCheck.rows[0]?.config ?? ""),
  JSON.stringify(fnCheck.rows[0]?.config)
);

// ------------------------------------------------------------
// 3. Negative control: 015's original uncasted CASE is rejected
//    by the enum column — the cast is what fixes it.
// ------------------------------------------------------------
console.log("\n-- negative control ---------------------------------");
let negativeCode = null;
try {
  await db.query(`
    insert into public.activities (workspace_id, entity_type, entity_id, action, metadata)
    select null, 'project', gen_random_uuid(),
           case when true then 'created' when false then 'deleted' else 'updated' end,
           '{}'::jsonb
  `);
} catch (error) {
  negativeCode = error.code;
}
ok(
  "the original uncasted CASE expression is rejected by the enum column with 42804",
  negativeCode === "42804",
  `got code ${negativeCode ?? "(no error)"}`
);

// ------------------------------------------------------------
// 4. Product flow: the exact payloads from project-manager.tsx
// ------------------------------------------------------------
console.log("\n-- product flow (project-manager.tsx payloads) ------");
const userId = "44444444-0000-4000-8000-000000000001";
await db.query(
  `insert into auth.users (id, email, raw_user_meta_data)
   values ($1, 'activity@nexus.test', '{}'::jsonb) on conflict (id) do nothing`,
  [userId]
);
// 006's bootstrap trigger gave the user a workspace + owner
// membership + FREE subscription on signup — the same shape the
// product bootstraps.
const ws = await db.query(
  `select w.id from public.workspaces w
     join public.workspace_members m on m.workspace_id = w.id
    where m.user_id = $1 and m.status = 'active'`,
  [userId]
);
ok("bootstrap workspace exists for the new user", ws.rows.length === 1);
const workspaceId = ws.rows[0]?.id;

async function asUser(uid, run) {
  await db.query(`select set_config('test.current_user_id', $1, false)`, [uid ?? ""]);
  try {
    return await run();
  } finally {
    await db.query(`select set_config('test.current_user_id', '', false)`);
  }
}

// createProject() insert
let createdId = null;
let createError = null;
try {
  const res = await asUser(userId, () =>
    db.query(
      `insert into public.projects
         (workspace_id, name, slug, description, status, progress, due_date, owner_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [workspaceId, "Website", "website-a1b2c3", null, "planning", 0, null, userId]
    )
  );
  createdId = res.rows[0].id;
} catch (error) {
  createError = error;
}
ok(
  "creating a project succeeds (the 42804 regression is gone)",
  createdId !== null,
  createError ? `${createError.code} ${String(createError.message).split("\n")[0]}` : ""
);

const activityRows = async () =>
  (
    await db.query(
      `select entity_type, action::text as action, metadata->>'title' as title
         from public.activities
        where workspace_id = $1
        order by created_at, id`,
      [workspaceId]
    )
  ).rows;

ok(
  "the insert records an activity row: project / created / Website",
  JSON.stringify(await activityRows()) ===
    JSON.stringify([{ entity_type: "project", action: "created", title: "Website" }])
);

// updateProject() payload
let updateError = null;
try {
  await asUser(userId, () =>
    db.query(
      `update public.projects
          set name = $2, slug = $3, description = $4, status = $5, progress = $6,
              due_date = $7, updated_at = now()
        where id = $8 and workspace_id = $1`,
      [workspaceId, "Website", "website", null, "active", 40, null, createdId]
    )
  );
} catch (error) {
  updateError = error;
}
ok("updating the project succeeds", updateError === null, updateError?.message?.split("\n")[0]);
ok(
  "the update records an activity row: project / updated",
  (await activityRows()).some((row) => row.entity_type === "project" && row.action === "updated")
);

// deleteProject() payload
let deleteError = null;
try {
  await asUser(userId, () =>
    db.query(`delete from public.projects where id = $1 and workspace_id = $2`, [createdId, workspaceId])
  );
} catch (error) {
  deleteError = error;
}
ok("deleting the project succeeds", deleteError === null, deleteError?.message?.split("\n")[0]);
ok(
  "the delete records an activity row: project / deleted",
  (await activityRows()).some((row) => row.entity_type === "project" && row.action === "deleted")
);

// ------------------------------------------------------------
await db.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
