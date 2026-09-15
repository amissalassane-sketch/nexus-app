/**
 * ============================================================
 * NEXUS — FREEMIUM CONTRACT + WRITE GUARD TESTS
 * ============================================================
 * This is a local PGlite behaviour suite. It applies the real post-base
 * lineage and the corrective freemium migration, then exercises the actual
 * triggers with boundary writes rather than checking SQL strings alone.
 *
 * The admin migrations and the three timestamp migrations are deliberately
 * omitted here: their separate suites own those contracts, while this suite
 * needs no Supabase roles or remote database. No remote project is touched.
 * ============================================================
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
const { PLAN_LIMITS, highestPlan, isPlanName } = await import("../../src/lib/plan-limits.ts");
const { canCreateWorkspace } = await import("../../src/lib/access.ts");

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const SKIPPED = new Set([
  "026_admin_control_plane.sql",
  "027_admin_directory.sql",
  "028_admin_activity_security.sql",
  "20260915130000_nexus_core_contract.sql",
  "20260915130500_nexus_lineage_reconciliation.sql",
  "20260915131000_nexus_auth_workspace_bootstrap.sql",
]);

const db = await PGlite.create();
let passed = 0;
let failed = 0;
let userSequence = 1;
let workspaceSequence = 1;

function ok(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

async function expectOk(label, run) {
  try {
    await run();
    ok(label, true);
  } catch (error) {
    ok(label, false, String(error.message).split("\n")[0]);
  }
}

async function expectLimit(label, run, resource) {
  try {
    await run();
    ok(label, false, "the write succeeded above the plan limit");
  } catch (error) {
    const message = String(error.message);
    ok(
      label,
      message.includes("PLAN_LIMIT_EXCEEDED") &&
        (error.code === "P0001" || message.includes("P0001")),
      `got: ${message.split("\n")[0]}`
    );
    if (resource) {
      ok(`${label} names ${resource}`, message.includes(resource));
    }
  }
}

async function expectDenied(label, run) {
  try {
    await run();
    ok(label, false, "the direct mutation succeeded");
  } catch (error) {
    const message = String(error.message);
    ok(
      label,
      message.includes("WORKSPACE_ACCESS_DENIED") ||
        message.includes("42501") ||
        message.toLowerCase().includes("permission"),
      `got: ${message.split("\n")[0]}`
    );
  }
}

async function asUser(userId, run) {
  await db.query("select set_config('test.current_user_id', $1, false)", [userId ?? ""]);
  try {
    return await run();
  } finally {
    await db.query("select set_config('test.current_user_id', '', false)");
  }
}

function nextUser() {
  const head = userSequence.toString(16).padStart(8, "0");
  const suffix = userSequence.toString(16).padStart(12, "0");
  userSequence += 1;
  return `${head}-0000-4000-8000-${suffix}`;
}

async function createUser(id = nextUser()) {
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, '{}'::jsonb)
     on conflict (id) do nothing`,
    [id, `${id.slice(0, 8)}@nexus.test`]
  );
  return id;
}

async function createWorkspace(plan = "FREE", ownerId = nextUser()) {
  await createUser(ownerId);
  const existing = await db.query(
    `select id from public.workspaces where owner_id = $1 order by created_at, id limit 1`,
    [ownerId]
  );
  let workspaceId = existing.rows[0]?.id;
  if (!workspaceId) {
    const suffix = workspaceSequence++;
    const result = await db.query(
      `insert into public.workspaces (owner_id, name, slug)
       values ($1, $2, $3)
       returning id`,
      [ownerId, `Guard workspace ${suffix}`, `guard-workspace-${suffix}`]
    );
    workspaceId = result.rows[0].id;
  }
  await db.query(
    `update public.workspace_subscriptions
        set plan = $1
      where workspace_id = $2 and status = 'active'`,
    [plan, workspaceId]
  );
  return { id: workspaceId, ownerId, plan };
}

async function disableTriggers(table, run) {
  await db.exec(`alter table public.${table} disable trigger user`);
  try {
    return await run();
  } finally {
    await db.exec(`alter table public.${table} enable trigger user`);
  }
}

async function seedProjects(workspaceId, count) {
  if (count <= 0) return;
  await disableTriggers("projects", () =>
    db.query(
      `insert into public.projects (workspace_id, name, slug)
       select $1, 'seed-project-' || g, 'seed-project-' || g
         from generate_series(1, $2) g`,
      [workspaceId, count]
    )
  );
}

async function seedGoals(workspaceId, count) {
  if (count <= 0) return;
  await disableTriggers("goals", () =>
    db.query(
      `insert into public.goals (workspace_id, title)
       select $1, 'seed-goal-' || g from generate_series(1, $2) g`,
      [workspaceId, count]
    )
  );
}

async function seedTasks(workspaceId, count, status = "todo") {
  if (count <= 0) return;
  await disableTriggers("tasks", () =>
    db.query(
      `insert into public.tasks (workspace_id, title, status)
       select $1, 'seed-task-' || g, $3 from generate_series(1, $2) g`,
      [workspaceId, count, status]
    )
  );
}

async function seedMembers(workspaceId, count) {
  if (count <= 0) return;
  const members = [];
  for (let i = 0; i < count; i += 1) members.push(await createUser());
  await disableTriggers("workspace_members", () =>
    db.query(
      `insert into public.workspace_members (workspace_id, user_id, role, status)
       select $1, value::uuid, 'member', 'active'
         from unnest($2::text[]) as value`,
      [workspaceId, members]
    )
  );
}

// ------------------------------------------------------------
// Local lineage setup
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
end
$$;
`);
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
ok("post-base lineage plus freemium guard migration applies locally", true);

// ------------------------------------------------------------
// Guard hardening is installed, not just present in the file
// ------------------------------------------------------------
console.log("\n-- guard security contract ------------------------------");
const guardedFunctions = [
  "public.enforce_project_limit()",
  "public.enforce_goal_limit()",
  "public.enforce_member_limit()",
  "public.enforce_task_limit()",
  "public.enforce_workspace_limit()",
  "public.get_workspace_plan(uuid)",
  "public.get_owner_plan(uuid)",
  "public.get_plan_limit(text, text)",
  "public.create_default_subscription()",
];
for (const signature of guardedFunctions) {
  const result = await db.query(
    `select p.prosecdef,
            p.proconfig,
            has_function_privilege('authenticated', $1, 'EXECUTE') as authenticated_exec,
            has_function_privilege('anon', $1, 'EXECUTE') as anon_exec
       from pg_proc p
      where p.oid = $1::regprocedure`,
    [signature]
  );
  const row = result.rows[0];
  ok(`${signature} is SECURITY DEFINER with pinned search_path`, row?.prosecdef === true && row?.proconfig?.includes("search_path=public, pg_temp"));
  ok(`${signature} is not client-executable`, row?.authenticated_exec === false && row?.anon_exec === false);
}
const usageAcl = await db.query(
  `select has_function_privilege('authenticated', 'public.get_workspace_usage(uuid)', 'EXECUTE') as executable`
);
ok("get_workspace_usage remains executable for authenticated", usageAcl.rows[0]?.executable === true);

// ------------------------------------------------------------
// Frontend + database contract values
// ------------------------------------------------------------
console.log("\n-- contract values --------------------------------------");
ok("frontend exports canCreateWorkspace through the existing access layer", typeof canCreateWorkspace === "function");
ok("unknown plans fail closed to FREE", !isPlanName("ENTERPRISE") && highestPlan(["TEAM", "INVALID"]) === "TEAM");
ok("owner plan resolution defaults to FREE", highestPlan(["INVALID", null]) === "FREE");
for (const [plan, limits] of Object.entries(PLAN_LIMITS)) {
  const expected = {
    workspaces: limits.workspaces,
    projects: limits.projects,
    active_tasks: limits.activeTasks,
    goals: limits.goals,
    members: limits.members,
  };
  for (const [resource, value] of Object.entries(expected)) {
    const result = await db.query(
      "select public.get_plan_limit($1, $2) as limit",
      [plan, resource]
    );
    ok(
      `${plan} ${resource} is ${value} in frontend and DB`,
      Number(result.rows[0]?.limit) === value,
      JSON.stringify(result.rows[0])
    );
  }
}

// ------------------------------------------------------------
// Every resource: limit - 1, limit, limit + 1
// ------------------------------------------------------------
console.log("\n-- boundary writes for every plan/resource -------------");
for (const [plan, limits] of Object.entries(PLAN_LIMITS)) {
  const projects = await createWorkspace(plan);
  await seedProjects(projects.id, limits.projects - 1);
  await expectOk(`${plan} projects reaches its limit`, () =>
    db.query(
      `insert into public.projects (workspace_id, name, slug)
       values ($1, $2, $3)`,
      [projects.id, `${plan}-project-limit`, `${plan.toLowerCase()}-project-limit`]
    )
  );
  await expectLimit(
    `${plan} projects limit + 1 is blocked`,
    () =>
      db.query(
        `insert into public.projects (workspace_id, name, slug)
         values ($1, $2, $3)`,
        [projects.id, `${plan}-project-over`, `${plan.toLowerCase()}-project-over`]
      ),
    "projects"
  );

  const goals = await createWorkspace(plan);
  await seedGoals(goals.id, limits.goals - 1);
  await expectOk(`${plan} goals reaches its limit`, () =>
    db.query(`insert into public.goals (workspace_id, title) values ($1, $2)`, [
      goals.id,
      `${plan} goal at limit`,
    ])
  );
  await expectLimit(
    `${plan} goals limit + 1 is blocked`,
    () => db.query(`insert into public.goals (workspace_id, title) values ($1, $2)`, [goals.id, `${plan} goal over`]),
    "goals"
  );

  const tasks = await createWorkspace(plan);
  await seedTasks(tasks.id, limits.activeTasks - 1);
  await expectOk(`${plan} active tasks reaches its limit`, () =>
    db.query(`insert into public.tasks (workspace_id, title, status) values ($1, $2, 'todo')`, [
      tasks.id,
      `${plan} task at limit`,
    ])
  );
  await expectLimit(
    `${plan} active tasks limit + 1 is blocked`,
    () => db.query(`insert into public.tasks (workspace_id, title, status) values ($1, $2, 'todo')`, [tasks.id, `${plan} task over`]),
    "active_tasks"
  );

  const members = await createWorkspace(plan);
  // The owner already occupies one member slot. FREE is therefore already
  // at its member limit immediately after workspace creation.
  const additionalBeforeLimit = Math.max(0, limits.members - 2);
  await seedMembers(members.id, additionalBeforeLimit);
  if (limits.members > 1) {
    await expectOk(`${plan} members reaches its limit`, async () => {
      const member = await createUser();
      await db.query(
        `insert into public.workspace_members (workspace_id, user_id, role, status)
         values ($1, $2, 'member', 'active')`,
        [members.id, member]
      );
    });
  } else {
    ok(`${plan} owner consumes the only member slot`, true);
  }
  await expectLimit(
    `${plan} members limit + 1 is blocked`,
    async () => {
      const member = await createUser();
      await db.query(
        `insert into public.workspace_members (workspace_id, user_id, role, status)
         values ($1, $2, 'member', 'active')`,
        [members.id, member]
      );
    },
    "members"
  );
}

// Workspace capacity is owner-scoped and resolved from the highest active
// subscription owned by that person.
for (const [plan, limits] of Object.entries(PLAN_LIMITS)) {
  const owner = await createUser();
  const first = await createWorkspace(plan, owner);
  for (let i = 2; i <= limits.workspaces; i += 1) {
    await expectOk(`${plan} workspace ${i}/${limits.workspaces} is allowed`, () =>
      db.query(
        `insert into public.workspaces (owner_id, name, slug)
         values ($1, $2, $3)`,
        [owner, `${plan} workspace ${i}`, `${plan.toLowerCase()}-workspace-${i}`]
      )
    );
  }
  await expectLimit(
    `${plan} workspace limit + 1 is blocked`,
    () =>
      db.query(
        `insert into public.workspaces (owner_id, name, slug)
         values ($1, $2, $3)`,
        [owner, `${plan} workspace over`, `${plan.toLowerCase()}-workspace-over`]
      ),
    "workspaces"
  );
  const count = await db.query(
    `select count(*)::int as count from public.workspaces where owner_id = $1`,
    [owner]
  );
  ok(`${plan} owner has exactly its workspace limit`, count.rows[0]?.count === limits.workspaces);
  void first;
}

// ------------------------------------------------------------
// Missing/incoherent subscription falls back to FREE
// ------------------------------------------------------------
console.log("\n-- subscription fallback -------------------------------");
const noSubscription = await createWorkspace("FREE");
await db.query(
  `delete from public.workspace_subscriptions where workspace_id = $1`,
  [noSubscription.id]
);
await seedProjects(noSubscription.id, 2);
await expectLimit(
  "workspace without an active subscription falls back to FREE",
  () => db.query(`insert into public.projects (workspace_id, name, slug) values ($1, 'over', 'over')`, [noSubscription.id]),
  "projects"
);

const inactiveSubscription = await createWorkspace("FREE");
await db.query(
  `update public.workspace_subscriptions
      set status = 'past_due', plan = 'TEAM'
    where workspace_id = $1 and status = 'active'`,
  [inactiveSubscription.id]
);
await seedProjects(inactiveSubscription.id, 2);
await expectLimit(
  "an incoherent non-active subscription still falls back to FREE",
  () => db.query(`insert into public.projects (workspace_id, name, slug) values ($1, 'over', 'over')`, [inactiveSubscription.id]),
  "projects"
);

const malformedSubscription = await createWorkspace("FREE");
await db.query(
  `update public.workspace_subscriptions
      set plan = 'INVALID'
    where workspace_id = $1 and status = 'active'`,
  [malformedSubscription.id]
);
await seedProjects(malformedSubscription.id, 2);
await expectLimit(
  "an invalid active plan fails closed to FREE",
  () => db.query(`insert into public.projects (workspace_id, name, slug) values ($1, 'over', 'over')`, [malformedSubscription.id]),
  "projects"
);

// ------------------------------------------------------------
// Status transitions, direct writes, and workspace transfers
// ------------------------------------------------------------
console.log("\n-- transitions and workspace transfers ----------------");
const target = await createWorkspace("FREE");
const source = await createWorkspace("FREE");
const actor = await createUser();

// Seed the target at every relevant limit without changing the behaviour of
// the writes under test.
await seedProjects(target.id, 2);
await seedGoals(target.id, 3);
await seedTasks(target.id, 100);
await seedMembers(target.id, 0);
await disableTriggers("workspace_members", () =>
  db.query(
    `insert into public.workspace_members (workspace_id, user_id, role, status)
     values ($1, $2, 'member', 'active'), ($3, $2, 'member', 'active')`,
    [source.id, actor, target.id]
  )
);

const sourceProject = (
  await db.query(
    `insert into public.projects (workspace_id, name, slug, owner_id)
     values ($1, 'transfer project', 'transfer-project', $2) returning id`,
    [source.id, actor]
  )
).rows[0].id;
const sourceGoal = (
  await db.query(
    `insert into public.goals (workspace_id, title, created_by)
     values ($1, 'transfer goal', $2) returning id`,
    [source.id, actor]
  )
).rows[0].id;
const sourceTask = (
  await db.query(
    `insert into public.tasks (workspace_id, title, status, created_by)
     values ($1, 'transfer task', 'todo', $2) returning id`,
    [source.id, actor]
  )
).rows[0].id;
const sourceDoneTask = (
  await db.query(
    `insert into public.tasks (workspace_id, title, status, created_by)
     values ($1, 'done transfer task', 'done', $2) returning id`,
    [source.id, actor]
  )
).rows[0].id;
const sourceMember = (
  await db.query(
    `select id from public.workspace_members where workspace_id = $1 and user_id = $2`,
    [source.id, actor]
  )
).rows[0].id;

await asUser(actor, async () => {
  await expectDenied("a non-member cannot write directly to the target workspace", () =>
    db.query(`insert into public.projects (workspace_id, name, slug) values ($1, 'denied', 'denied')`, [noSubscription.id])
  );

  await expectLimit(
    "project workspace transfer is checked",
    () => db.query(`update public.projects set workspace_id = $1 where id = $2`, [target.id, sourceProject]),
    "projects"
  );
  await expectLimit(
    "goal workspace transfer is checked",
    () => db.query(`update public.goals set workspace_id = $1 where id = $2`, [target.id, sourceGoal]),
    "goals"
  );
  await expectLimit(
    "member workspace transfer is checked",
    () => db.query(`update public.workspace_members set workspace_id = $1 where id = $2`, [target.id, sourceMember]),
    "members"
  );
  await expectLimit(
    "active task workspace transfer is checked",
    () => db.query(`update public.tasks set workspace_id = $1 where id = $2`, [target.id, sourceTask]),
    "active_tasks"
  );
  await expectOk("done task transfer does not consume an active slot", () =>
    db.query(`update public.tasks set workspace_id = $1 where id = $2`, [target.id, sourceDoneTask])
  );

  let doneTask;
  await expectOk("done task is allowed at the active-task cap", async () => {
    doneTask = (
      await db.query(
        `insert into public.tasks (workspace_id, title, status, created_by)
         values ($1, 'reopen done', 'done', $2) returning id`,
        [target.id, actor]
      )
    ).rows[0].id;
  });
  let cancelledTask;
  await expectOk("cancelled task is allowed at the active-task cap", async () => {
    cancelledTask = (
      await db.query(
        `insert into public.tasks (workspace_id, title, status, created_by)
         values ($1, 'reopen cancelled', 'cancelled', $2) returning id`,
        [target.id, actor]
      )
    ).rows[0].id;
  });
  await expectLimit(
    "reopening a done task is checked",
    () => db.query(`update public.tasks set status = 'todo' where id = $1`, [doneTask]),
    "active_tasks"
  );
  await expectLimit(
    "reopening a cancelled task is checked",
    () => db.query(`update public.tasks set status = 'in_progress' where id = $1`, [cancelledTask]),
    "active_tasks"
  );
});

// The new guards deliberately serialize the check-and-write per scope. PGlite
// runs this suite on one backend, so a two-session lock-hold race belongs in a
// deployment-level integration test. We still exercise the actual PostgreSQL
// lock primitive here: a transaction acquires the key, and the key is free
// again after that transaction commits. The function-definition check is only
// the companion assertion that every installed guard uses that primitive.
for (const [signature, lockScope] of [
  ["public.enforce_project_limit()", "projects"],
  ["public.enforce_goal_limit()", "goals"],
  ["public.enforce_member_limit()", "members"],
  ["public.enforce_task_limit()", "active_tasks"],
  ["public.enforce_workspace_limit()", "workspaces"],
]) {
  const lockName = `freemium-test:${lockScope}:${nextUser()}`;
  const acquiredInsideTransaction = await db.transaction(async (tx) => {
    const result = await tx.query(
      `select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as acquired`,
      [lockName]
    );
    return result.rows[0]?.acquired === true;
  });
  const acquiredAfterCommit = await db.query(
    `select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as acquired`,
    [lockName]
  );
  const body = await db.query(
    `select pg_get_functiondef($1::regprocedure) as source`,
    [signature]
  );
  ok(
    `${signature} uses a transaction-scoped advisory lock`,
    acquiredInsideTransaction &&
      acquiredAfterCommit.rows[0]?.acquired === true &&
      body.rows[0].source.includes("pg_advisory_xact_lock")
  );
}

// Subscription path remains unchanged and idempotent: one active row only.
const subscriptionWorkspace = await createWorkspace("FREE");
const before = await db.query(
  `select count(*)::int as count from public.workspace_subscriptions
    where workspace_id = $1 and status = 'active'`,
  [subscriptionWorkspace.id]
);
await db.query("select public.bootstrap_personal_workspace($1)", [subscriptionWorkspace.ownerId]);
const after = await db.query(
  `select count(*)::int as count from public.workspace_subscriptions
    where workspace_id = $1 and status = 'active'`,
  [subscriptionWorkspace.id]
);
ok("default subscription remains exactly one active row after bootstrap retry", before.rows[0].count === 1 && after.rows[0].count === 1);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
