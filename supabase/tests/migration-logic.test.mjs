// ============================================================
// NEXUS — MIGRATION LOGIC TESTS
// Static analysis of supabase/migrations/*.sql — run with:
//   node supabase/tests/migration-logic.test.mjs
// No database required: these assert the structural invariants
// that the P0 fix (and future migrations) must keep.
// ============================================================

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = join(root, "supabase", "migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

assert.ok(files.length > 0, "migrations directory must not be empty");
const read = (name) => readFileSync(join(migrationsDir, name), "utf8");

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
};

// ------------------------------------------------------------
// 011_workspace_owner_membership.sql — the P0 critical fix
// ------------------------------------------------------------
const m011Name = files.find((f) => f.startsWith("011_"));
assert.ok(m011Name, "migration 011 (workspace owner membership) must exist");
const m011 = read(m011Name);

test("011: trigger on public.workspaces after insert", () => {
  assert.match(m011, /after insert on public\.workspaces/i);
});

test("011: creates owner membership with role=owner status=active", () => {
  assert.match(m011, /insert into public\.workspace_members[^;]*'owner'[^;]*'active'/is);
});

test("011: on conflict (workspace_id, user_id) reactivates as owner", () => {
  assert.match(m011, /on conflict \(workspace_id, user_id\)\s*do update set\s*status\s*=\s*'active',\s*role\s*=\s*'owner'/is);
});

test("011: NEVER breaks signup — exception handler returns NEW", () => {
  assert.match(m011, /exception\s+when others then[\s\S]*?raise warning[\s\S]*?return NEW;/i);
});

test("011: owner is exempt from the member plan limit", () => {
  assert.match(m011, /create or replace function public\.enforce_member_limit\(\)[\s\S]*?NEW\.user_id = v_owner[\s\S]*?return NEW;/);
  // The count must exclude the owner
  assert.match(m011, /user_id <> v_owner/);
});

test("011: backfills missing owner memberships for existing workspaces", () => {
  assert.match(m011, /insert into public\.workspace_members[^;]*select w\.id, w\.owner_id, 'owner', 'active'[^;]*from public\.workspaces w/is);
});

test("011: read-own-membership policy guarded by pg_policies (idempotent)", () => {
  assert.match(m011, /pg_policies[\s\S]*members_can_read_own_membership/);
  assert.match(m011, /create policy "members_can_read_own_membership"[\s\S]*using \(user_id = auth\.uid\(\)\)/);
});

test("011: unique index creation is guarded with if not exists", () => {
  assert.match(m011, /create unique index if not exists[\s\S]*?on public\.workspace_members/i);
});

// ------------------------------------------------------------
// Cross-migration invariants
// ------------------------------------------------------------
test("plan limits in SQL mirror src/lib/plan-limits.ts", () => {
  const ts = readFileSync(join(root, "src", "lib", "plan-limits.ts"), "utf8");
  const plans = { FREE: {}, PRO: {}, TEAM: {} };
  for (const plan of Object.keys(plans)) {
    const section = ts.split(`${plan}: {`)[1]?.split("},")[0] ?? "";
    const num = (key) => Number(section.split(`${key}:`)[1]?.split(",")[0]);
    plans[plan] = {
      projects: num("projects"),
      activeTasks: num("activeTasks"),
      goals: num("goals"),
      members: num("members"),
    };
  }
  // The last definition of get_plan_limit in SQL must win — check the FINAL one.
  const sqlAll = files.map(read).join("\n");
  const lastDef = sqlAll.split("create or replace function public.get_plan_limit").pop();
  const planOrder = ["FREE", "PRO", "TEAM"];
  const planBlockOf = (plan) => {
    const after = lastDef.split(`when '${plan}'`)[1] ?? "";
    const nextPlans = planOrder
      .filter((p) => p !== plan)
      .map((p) => after.indexOf(`when '${p}'`))
      .filter((i) => i >= 0);
    const stopAt = nextPlans.length > 0 ? Math.min(...nextPlans) : after.indexOf("else");
    return stopAt >= 0 ? after.slice(0, stopAt) : after;
  };
  for (const [plan, limits] of Object.entries(plans)) {
    const planBlock = planBlockOf(plan);
    const sqlNum = (resource) =>
      Number(planBlock.split(`'${resource}'`)[1]?.split("return")[1]?.match(/\d+/)?.[0]);
    assert.ok(Number.isFinite(sqlNum("projects")), `${plan}: could not parse SQL limits`);
    assert.equal(sqlNum("projects"), limits.projects, `${plan} projects mismatch`);
    assert.equal(sqlNum("active_tasks"), limits.activeTasks, `${plan} active_tasks mismatch`);
    assert.equal(sqlNum("goals"), limits.goals, `${plan} goals mismatch`);
    assert.equal(sqlNum("members"), limits.members, `${plan} members mismatch`);
  }
});

test("every trigger creation is preceded by a guarded drop", () => {
  for (const file of files) {
    const sql = read(file);
    const creates = sql.match(/create trigger (\w+)/g) ?? [];
    for (const create of creates) {
      const name = create.split(" ")[2];
      assert.match(
        sql,
        new RegExp(`drop trigger if exists ${name} on (public|auth)\\.\\w+`),
        `${file}: trigger ${name} must have a guarded drop (idempotency)`
      );
    }
  }
});

test("workspace bootstrap keeps its exception guard (never block auth.users insert)", () => {
  const bootstrap = files
    .map(read)
    .filter((sql) => sql.includes("create_default_workspace"))
    .join("\n");
  assert.match(
    bootstrap,
    /create or replace function public\.create_default_workspace\(\)[\s\S]*exception[\s\S]*return new;/i
  );
});

console.log(`\nmigration-logic: ${passed} assertions passed`);
