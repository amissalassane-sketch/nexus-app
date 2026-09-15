#!/usr/bin/env node
/**
 * ============================================================
 * NEXUS — ADMIN PREVIEW HARNESS (PR 2)
 * ============================================================
 * Brings up the app against a REAL PostgreSQL engine so /admin/users and
 * /admin/workspaces can be walked through a browser with genuine data:
 *
 *   • PGlite runs the repository's actual migrations (006 → 027) and the
 *     real triggers — the same setup the SQL test suites use. Nothing is
 *     reimplemented: admin_users_list, admin_user_detail,
 *     admin_workspaces_list and admin_workspace_detail execute as the
 *     real SECURITY DEFINER functions, and the admin gate re-checks the
 *     caller's identity per call, exactly as in production.
 *   • the Supabase service stub (GoTrue + PostgREST surface used by the
 *     product) answers auth, session refresh and the product pages; its
 *     additive extraRpc hook routes the platform_admin_* / admin_* RPCs
 *     to PGlite, with the JWT's `sub` set as `auth.uid()` before each
 *     query. Failing closed is tested behaviour, not a preview feature.
 *   • the seed below mimics a young SaaS in week twelve: tenants with
 *     projects and tasks, a churned TEAM account, a pending signup, a
 *     banned trial, suspended memberships — states the directory must
 *     report honestly. The audit log starts empty, because it is empty.
 *
 * Usage (from the repository root):
 *   node scripts/preview-admin.mjs &                # stub + engine on :54321
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key npm run dev
 *   # sign in as owner@nexus.test with any password
 *   # then open /admin, /admin/users?size=10, /admin/workspaces
 *
 * This is a preview harness: a test double for the EXTERNAL service. No
 * NEXUS logic is mocked — if an admin page says "not available" here,
 * that is the real behaviour against the real engine.
 * ============================================================
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { startSupabaseStub, ONBOARDED_USER } from "../supabase/tests/supabase-stub.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const migrationsDir = join(repoRoot, "supabase", "migrations");
const testsDir = join(repoRoot, "supabase", "tests");

const STUB_PORT = Number(process.env.STUB_PORT ?? 54321);

// ---- engine --------------------------------------------------------------
const db = await PGlite.create();

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
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`);
await db.exec(readFileSync(join(testsDir, "00_base_schema_fixture.sql"), "utf8"));

for (const file of readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && !f.startsWith("001_"))
  .sort()) {
  await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
}

const days = (n) => `${n} days`;
const ago = (n) => `now() - interval '${days(n)}'`;
const ahead = (n) => `now() + interval '${days(n)}'`;

const OWNER = ONBOARDED_USER.id; // 1111… — matches the stub's sign-in account
const CASEY = "0a0a0a0a-0000-4000-8000-000000000001";
const JAMIE = "0a0a0a0a-0000-4000-8000-000000000002";
const ROSHNI = "0a0a0a0a-0000-4000-8000-000000000003";
const SAM = "0a0a0a0a-0000-4000-8000-000000000004";
const PRIYA = "0a0a0a0a-0000-4000-8000-000000000005";
const PENDING = "0a0a0a0a-0000-4000-8000-000000000006";
const BANNED = "0a0a0a0a-0000-4000-8000-000000000007";
const SOLO = "0a0a0a0a-0000-4000-8000-000000000008";
const CHURN = "0a0a0a0a-0000-4000-8000-000000000009";
const VIEWER = "0a0a0a0a-0000-4000-8000-00000000000a";

// Accounts, created_at spread over ~90 days so growth numbers have shape.
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, last_sign_in_at, created_at) values
    ('${OWNER}','owner@nexus.test','{"full_name":"Owner One"}',        ${ago(90)}, ${ago(0)},  ${ago(90)}),
    ('${CASEY}','casey@lumen.studio','{"full_name":"Casey Nguyen"}',    ${ago(71)}, ${ago(0)},  ${ago(71)}),
    ('${JAMIE}','jamie@lumen.studio','{"full_name":"Jamie Okafor"}',    ${ago(63)}, ${ago(1)},  ${ago(63)}),
    ('${ROSHNI}','roshni@fieldops.io','{"full_name":"Roshni Patel"}',   ${ago(58)}, ${ago(2)},  ${ago(58)}),
    ('${SAM}','sam@fieldops.io','{"full_name":"Sam Ferreira"}',         ${ago(55)}, ${ago(3)},  ${ago(55)}),
    ('${PRIYA}','priya@fieldops.io','{"full_name":"Priya Sharma"}',      ${ago(50)}, ${ago(21)}, ${ago(50)}),
    ('${SOLO}','solo@freelance.dev','{"full_name":"Solo Adeyemi"}',      ${ago(34)}, ${ago(4)},  ${ago(34)}),
    ('${VIEWER}','viewer@nexus.test','{}',                               ${ago(12)}, ${ago(6)},  ${ago(12)}),
    ('${PENDING}','new.signup@mail.test','{}',                           null,       null,       ${ago(0)}),
    ('${CHURN}','churn@fieldops.io','{"full_name":"Churned Cyclic"}',    ${ago(80)}, ${ago(46)}, ${ago(80)});
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, last_sign_in_at, banned_until, created_at) values
    ('${BANNED}','abuse@try-this-once.biz','{}',                         ${ago(9)},  ${ago(8)},  ${ahead(3)}, ${ago(9)});
`);

// Platform seats.
await db.exec(`
  insert into public.platform_admins (user_id, role, note) values
    ('${OWNER}','owner','bootstrap operator'),
    ('${VIEWER}','viewer','support rotation');
  -- make the personal workspace plan rows look lived-in
  update public.profiles set username = 'ownerone' where id = '${OWNER}';
`);

// Two real tenants beyond the personal workspaces. The seed honours the
// freemium triggers exactly as an operator's history would: the founders
// upgrade their personal plan FIRST (that is what lifts the workspace
// cap), then create the team workspace, then invite members. Nothing in
// this file bypasses a trigger — a preview that cheats would also mislead.
await db.exec(`
  update public.workspace_subscriptions s set plan = 'PRO'
  from public.workspaces w
  where w.id = s.workspace_id and w.owner_id = '${CASEY}' and s.status = 'active';
  update public.workspace_subscriptions s set plan = 'TEAM'
  from public.workspaces w
  where w.id = s.workspace_id and w.owner_id = '${ROSHNI}' and s.status = 'active';
`);

await db.exec(`
  insert into public.workspaces (owner_id, name, slug, description, created_at, updated_at)
  values ('${CASEY}','Lumen Studio','lumen-studio','Brand & web studio — 3 people, two live clients.', ${ago(70)}, ${ago(0)});
  insert into public.workspaces (owner_id, name, slug, description, created_at, updated_at)
  values ('${ROSHNI}','FieldOps','fieldops','Operations cockpit for the field team.', ${ago(57)}, ${ago(2)});
`);

const lumen = (await db.query(`select id from public.workspaces where slug='lumen-studio'`)).rows[0].id;
const fieldops = (await db.query(`select id from public.workspaces where slug='fieldops'`)).rows[0].id;

// trg_default_subscription (007) gave both new tenants an active FREE row;
// move them to the plans their owners actually paid for.
await db.exec(`
  update public.workspace_subscriptions set plan='PRO', updated_at = ${ago(20)}
  where workspace_id = '${lumen}' and status='active';
  update public.workspace_subscriptions set plan='TEAM', updated_at = ${ago(30)}
  where workspace_id = '${fieldops}' and status='active';

  insert into public.workspace_members (workspace_id, user_id, role, status, created_at) values
    ('${lumen}','${JAMIE}','member','active', ${ago(62)}),
    ('${fieldops}','${SAM}','admin','active', ${ago(54)}),
    ('${fieldops}','${PRIYA}','viewer','suspended', ${ago(49)});

  -- The churned account was in FieldOps; its membership ended. Its personal
  -- workspace then loses its only ACTIVE owner-membership — the exact
  -- condition admin_overview() flags under “Needs attention”, and what the
  -- directory's attention filter must surface organically.
  insert into public.workspace_members (workspace_id, user_id, role, status, created_at)
  values ('${fieldops}','${CHURN}','member','suspended', ${ago(78)});
  update public.workspace_members
     set status = 'suspended'
   where user_id = '${CHURN}' and role = 'owner';
`);

// Projects and goals — direct table-owner inserts (no attribution needed).
await db.exec(`
  insert into public.projects (workspace_id, name, status, progress, due_date, created_at, updated_at) values
    ('${lumen}','Northwind rebrand','active',65, ${ahead(6)},  ${ago(68)}, ${ago(0)}),
    ('${lumen}','Studio site refresh','active',20, ${ahead(21)}, ${ago(40)}, ${ago(2)}),
    ('${lumen}','Archive migration','planning',0, null,        ${ago(12)}, ${ago(12)}),
    ('${fieldops}','Dispatch v2','active',45, ${ahead(9)},      ${ago(50)}, ${ago(1)}),
    ('${fieldops}','Coverage audit','in_review',80, ${ago(1)},  ${ago(28)}, ${ago(3)});
  insert into public.goals (workspace_id, title, status, progress, target_date, created_by, created_at, updated_at) values
    ('${lumen}','Ship the rebrand before Q3','active',65, ${ahead(30)}, '${CASEY}', ${ago(60)}, ${ago(1)}),
    ('${fieldops}','Zero manual dispatch by October','active',45, ${ahead(45)}, '${ROSHNI}', ${ago(55)}, ${ago(2)});
`);

// Tasks are inserted as their real authors so the 015 activity trigger
// attributes every row — the directory's "last activity" must be made of
// exactly that kind of truth.
const projectIds = new Map(
  (await db.query(`select id, name from public.projects`)).rows.map((r) => [r.name, r.id])
);
const soloWs = (await db.query(`select id from public.workspaces where owner_id='${SOLO}'`)).rows[0].id;

/**
 * rows: [title, status, priority, createdBy, assignee, projectName|null,
 *        createdDaysAgo, dueInDays|null (negative = overdue), doneDaysAgo|null]
 */
async function insertTasks(ws, rows) {
  for (const [title, status, priority, by, assignee, projectName, createdDays, dueDays, doneDays] of rows) {
    const pid = projectName ? `'${projectIds.get(projectName)}'` : "null";
    const due = dueDays === null || dueDays === undefined
      ? "null"
      : dueDays >= 0
        ? `${ahead(dueDays)}`
        : `${ago(Math.abs(dueDays))}`;
    const done = doneDays === null || doneDays === undefined ? "null" : `${ago(doneDays)}`;
    await db.exec(`set test.current_user_id = '${by}'`);
    await db.exec(`
      insert into public.tasks (workspace_id, project_id, title, status, priority, created_by, assignee_id, due_at, completed_at, created_at, updated_at)
      values ('${ws}', ${pid}, '${title}', '${status}', '${priority}', '${by}', ${assignee ? `'${assignee}'` : "null"},
              ${due}, ${done}, ${ago(createdDays)}, ${ago(Math.max(0, doneDays ?? 0) || 0)})
        on conflict do nothing;
    `);
  }
  await db.exec(`set test.current_user_id = ''`);
}

await insertTasks(lumen, [
  ["Northwind: logo lockups", "done", "high", JAMIE, JAMIE, "Northwind rebrand", 20, -2, 4],
  ["Northwind: signage proofs", "in_progress", "urgent", CASEY, CASEY, "Northwind rebrand", 14, 6, null],
  ["Northwind: motion kit", "todo", "medium", CASEY, null, "Northwind rebrand", 6, 12, null],
  ["Studio site: copy pass", "blocked", "high", JAMIE, JAMIE, "Studio site refresh", 30, -4, null],
  ["Studio site: staging deploy", "todo", "medium", CASEY, CASEY, "Studio site refresh", 10, 14, null],
  ["Archive: export inventory", "done", "low", JAMIE, JAMIE, "Archive migration", 11, -9, 8],
]);
await insertTasks(fieldops, [
  ["Dispatch: queue priorities", "done", "urgent", SAM, SAM, "Dispatch v2", 15, -3, 5],
  ["Dispatch: driver app copy", "in_review", "high", ROSHNI, SAM, "Dispatch v2", 12, 4, null],
  ["Coverage: metro census", "blocked", "medium", ROSHNI, ROSHNI, "Coverage audit", 25, -6, null],
  ["Coverage: rural estimate", "todo", "high", SAM, null, "Coverage audit", 5, 9, null],
  ["Coverage: stakeholder memo", "cancelled", "low", ROSHNI, ROSHNI, "Coverage audit", 22, -14, null],
]);
await insertTasks(soloWs, [
  ["Invoice March clients", "done", "high", SOLO, SOLO, null, 33, -30, 29],
  ["Portfolio case study", "in_progress", "medium", SOLO, SOLO, null, 8, 5, null],
  ["Retainer paperwork", "todo", "urgent", SOLO, SOLO, null, 2, 1, null],
]);

// Notifications and intelligence state — real rows only.
await db.exec(`
  insert into public.notifications (workspace_id, user_id, type, title, read_at, created_at) values
    ('${lumen}','${JAMIE}','info','Northwind: motion kit assigned to the studio', null, ${ago(5)}),
    ('${lumen}','${CASEY}','warning','Studio site: copy pass has been blocked for 4 days', null, ${ago(1)}),
    ('${fieldops}','${SAM}','info','Coverage audit moved to review', ${ago(2)}, ${ago(3)});

  insert into public.intelligence_signals (user_id, workspace_id, fingerprint, type, severity, status, title, summary, entity_type, score, created_at) values
    ('${CASEY}','${lumen}','preview:blocked-copy','stalled_task','warning','new','Copy pass blocked 4 days','“Studio site: copy pass” has no progress since it was blocked.','task',0.62,${ago(1)}),
    ('${ROSHNI}','${fieldops}','preview:rural-todo','at_risk_deadline','info','seen','Rural estimate untouched','“Coverage: rural estimate” is due in 5 days and has no assignee.','task',0.4,${ago(2)});

  insert into public.intelligence_missions (id, user_id, workspace_id, title, objective, kind, status, progress, created_at, updated_at) values
    ('mission-preview-1','${CASEY}','${lumen}','Unblock the copy pass','Get Studio site copy unstaged and reviewed','general','active',30,${ago(2)},${ago(0)});

  insert into public.intelligence_memory (user_id, workspace_id, state) values
    ('${CASEY}','${lumen}','{"preview":"true"}');
`);

// The account with no profile — a genuinely missing trigger row the
// directory must surface, not paper over.
await db.exec(`delete from public.profiles where id = '${CHURN}'`);

// ---- RPC bridge ----------------------------------------------------------
const ADMIN_RPCS = {
  platform_admin_context: { fn: "platform_admin_context", args: [] },
  admin_overview: { fn: "admin_overview", args: [] },
  admin_recent_activity: { fn: "admin_recent_activity", args: ["p_limit"] },
  admin_users_list: {
    fn: "admin_users_list",
    args: ["p_search", "p_status", "p_sort", "p_direction", "p_page", "p_page_size"],
  },
  admin_user_detail: { fn: "admin_user_detail", args: ["p_user_id"] },
  admin_workspaces_list: {
    fn: "admin_workspaces_list",
    args: ["p_search", "p_view", "p_sort", "p_direction", "p_page", "p_page_size"],
  },
  admin_workspace_detail: { fn: "admin_workspace_detail", args: ["p_workspace_id"] },
  admin_audit_record: {
    fn: "admin_audit_record",
    args: ["p_action", "p_outcome", "p_target_type", "p_target_id", "p_metadata", "p_ip_address", "p_user_agent"],
  },
  admin_audit_record_denied: {
    fn: "admin_audit_record_denied",
    args: ["p_reason", "p_path", "p_ip_address", "p_user_agent"],
  },
};

function adminHandlers() {
  const handlers = {};
  for (const [name, spec] of Object.entries(ADMIN_RPCS)) {
    handlers[name] = async (body, { userId }) => {
      await db.exec(`set test.current_user_id = ${userId ? `'${userId}'` : "''"}`);
      const params = spec.args.map((a) => body?.[a] ?? null);
      const placeholders = params.map((_, i) => `$${i + 1}`).join(",");
      try {
        const out = await db.query(
          `select public.${spec.fn}(${placeholders}) as r`,
          params
        );
        return { data: out.rows[0].r ?? null };
      } catch (error) {
        const message = String(error?.message ?? error);
        const code = error?.code ?? (message.includes("NEXUS_ADMIN_FORBIDDEN") ? "42501" : "XX000");
        return { error: { code, message } };
      }
    };
  }
  return handlers;
}

const stub = await startSupabaseStub(STUB_PORT, "127.0.0.1", {
  extraRpc: adminHandlers(),
});

console.log("─".repeat(64));
console.log("NEXUS admin preview");
console.log(`  supabase stub:  ${stub.url}`);
console.log(`  engine:         PGlite (all migrations 006–027 applied, seeded)`);
console.log("  sign in:        owner@nexus.test / any password  → platform owner");
console.log("                  viewer@nexus.test / any password → read-only seat");
console.log("  then:           /admin/users · /admin/workspaces · row → inspector");
console.log("─".repeat(64));
console.log("stop with Ctrl-C");

process.on("SIGINT", () => process.exit(0));
setInterval(() => {}, 60_000);
