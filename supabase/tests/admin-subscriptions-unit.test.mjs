/**
 * ============================================================
 * NEXUS ADMIN — SUBSCRIPTIONS (PR 6) — UNIT TESTS
 * ============================================================
 * The pure half of /admin/subscriptions, mirroring the PR 2
 * directory suite (admin-directory.test.mjs):
 *
 *   - URL parsing: clamps, whitelists, href builders. The page never
 *     touches raw searchParams; it uses parseSubscriptionsListQuery,
 *     so these ARE the input-validation tests for the screen.
 *   - the payload guard: the boundary between "the database answered"
 *     and "we render it". A malformed payload must become an error
 *     state, including the new statuses.expired key and the 'expired'
 *     live status.
 *   - the three state transitions of the data layer: success with
 *     rows, measured-empty, and unavailable. Driven through the real
 *     readSubscriptionsListRpc with fake clients — same pattern as
 *     the directory suite — including the exact RPC arguments the
 *     page sends, because a mistyped p_plan would silently unfilter
 *     the query.
 *
 * Run:  node --import tsx supabase/tests/admin-subscriptions-unit.test.mjs
 * ============================================================
 */

const {
  parseSubscriptionsListQuery,
  hasActiveListFilters,
  nextSortHref,
  listHref,
  isSubscriptionsListPayload,
} = await import("../../src/lib/admin/query.ts");

const { __internals } = await import("../../src/lib/admin/subscriptions.ts");
const { readSubscriptionsListRpc } = __internals;

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

function eq(name, actual, expected) {
  assert(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
}

// ============================================================
console.log("\n-- subscriptions query parsing: clamp, whitelist ----");
// ============================================================
eq(
  "no params → the canonical default query (paid plans first)",
  JSON.stringify(parseSubscriptionsListQuery({})),
  JSON.stringify({
    search: null,
    plan: "all",
    status: "all",
    sort: "plan",
    direction: "desc",
    page: 1,
    pageSize: 25,
  })
);

const parsed = parseSubscriptionsListQuery({
  q: "  acme ",
  plan: "PRO",
  status: "past_due",
  sort: "name",
  page: "3",
  size: "50",
});
eq("search is trimmed", parsed.search, "acme");
eq("plan PRO survives the whitelist", parsed.plan, "PRO");
eq("status past_due survives the whitelist", parsed.status, "past_due");
eq("sort name survives the whitelist", parsed.sort, "name");
eq("sort name without ?dir inherits the canonical asc", parsed.direction, "asc");
eq("page 3 survives", parsed.page, 3);
eq("page size 50 survives the allowlist", parsed.pageSize, 50);

const hostile = parseSubscriptionsListQuery({
  q: "",
  plan: "ULTRA",
  status: "subscribing",
  sort: "mrr",
  dir: "sideways",
  page: "-4",
  size: "200",
});
eq("empty search is null, not an empty filter", hostile.search, null);
eq("unknown plan → no filter, never an error", hostile.plan, "all");
eq("unknown status → no filter, never an error", hostile.status, "all");
eq("unknown sort → the plan default", hostile.sort, "plan");
eq("unknown direction → desc", hostile.direction, "desc");
eq("negative page clamps to 1", hostile.page, 1);
eq("off-allowlist page size falls back to 25", hostile.pageSize, 25);

eq(
  "lowercase plan is rejected (the whitelist is exact; the UI emits canonical values)",
  parseSubscriptionsListQuery({ plan: "pro" }).plan,
  "all"
);
eq(
  "the expired status survives the whitelist (the sweep's vocabulary)",
  parseSubscriptionsListQuery({ status: "expired" }).status,
  "expired"
);
eq(
  "repeated keys: the first value wins",
  parseSubscriptionsListQuery({ plan: ["PRO", "TEAM"] }).plan,
  "PRO"
);

// ============================================================
console.log("\n-- active filters and href round-trips --------------");
// ============================================================
const canonical = parseSubscriptionsListQuery({});
assert(
  "the default query has no active filters (no Clear button)",
  hasActiveListFilters(canonical) === false
);
assert(
  "a plan filter counts as active",
  hasActiveListFilters({ ...canonical, plan: "PRO" }) === true
);
assert(
  "a status filter counts as active",
  hasActiveListFilters({ ...canonical, status: "cancelled" }) === true
);
assert(
  "page 2 counts as active",
  hasActiveListFilters({ ...canonical, page: 2 }) === true
);

eq(
  "the canonical query collapses to the bare path",
  listHref("/admin/subscriptions", canonical),
  "/admin/subscriptions"
);
eq(
  "a plan filter survives into the href",
  listHref("/admin/subscriptions", { ...canonical, plan: "PRO" }),
  "/admin/subscriptions?plan=PRO"
);
eq(
  "sort=name with its canonical asc collapses the direction away",
  listHref("/admin/subscriptions", {
    ...canonical,
    sort: "name",
    direction: "asc",
  }),
  "/admin/subscriptions?sort=name"
);

const same = nextSortHref("/admin/subscriptions", canonical, "plan");
eq("re-clicking the active column toggles to asc", same.href, "/admin/subscriptions?dir=asc");
eq("…and reports the current state as desc", same.state, "desc");
const other = nextSortHref("/admin/subscriptions", canonical, "name");
eq(
  "clicking a new column takes its canonical direction and resets to page 1",
  other.href,
  "/admin/subscriptions?sort=name"
);
eq("…and reports no current state", other.state, "none");

// ============================================================
console.log("\n-- the payload guard keeps malformed data out -------");
// ============================================================
function subsPayload(overrides = {}) {
  return {
    generated_at: "2026-09-21T00:00:00Z",
    page: 1,
    page_size: 25,
    sort: "plan",
    direction: "desc",
    search: null,
    plan: "all",
    status: "all",
    total: 1,
    summary: {
      workspaces: 1,
      plans: { free: 0, pro: 1, team: 0 },
      statuses: {
        active: 1,
        trialing: 0,
        past_due: 0,
        cancelled: 0,
        expired: 0,
        implicit_free: 0,
      },
      attention: 0,
    },
    items: [
      {
        workspace_id: "11111111-1111-1111-1111-111111111111",
        name: "Acme",
        slug: "acme",
        plan: "PRO",
        has_subscription: true,
        subscription_status: "active",
        current_period_end: "2026-10-21T00:00:00Z",
        trial_ends_at: null,
        subscription_updated_at: "2026-09-01T00:00:00Z",
        billing_wired: false,
        previous_rows: 0,
        owner: {
          user_id: "11111111-1111-1111-1111-111111111111",
          email: "owner@nexus.test",
          display_name: "Owner One",
        },
        usage: { projects: 2, active_tasks: 2, goals: 1, members: 2 },
        limits: { projects: 10, active_tasks: 1000, goals: 20 },
        has_active_owner: true,
      },
    ],
    ...overrides,
  };
}

assert("a well-formed payload passes", isSubscriptionsListPayload(subsPayload()) === true);
assert(
  "an empty-but-measured payload passes (zero is a fact, not a failure)",
  isSubscriptionsListPayload(
    subsPayload({
      total: 0,
      items: [],
      summary: {
        workspaces: 0,
        plans: { free: 0, pro: 0, team: 0 },
        statuses: {
          active: 0,
          trialing: 0,
          past_due: 0,
          cancelled: 0,
          expired: 0,
          implicit_free: 0,
        },
        attention: 0,
      },
    })
  ) === true
);
assert(
  "the expired live status passes the guard",
  isSubscriptionsListPayload(
    subsPayload({
      items: [
        { ...subsPayload().items[0], subscription_status: "expired" },
      ],
    })
  ) === true
);
assert("null is not a payload", isSubscriptionsListPayload(null) === false);
assert("an array is not a payload", isSubscriptionsListPayload([]) === false);
assert(
  "a missing summary is not a payload",
  isSubscriptionsListPayload({ ...subsPayload(), summary: undefined }) === false
);
assert(
  "a summary missing the expired key is not a payload (the contract grew)",
  isSubscriptionsListPayload({
    ...subsPayload(),
    summary: {
      ...subsPayload().summary,
      statuses: {
        active: 1,
        trialing: 0,
        past_due: 0,
        cancelled: 0,
        implicit_free: 0,
      },
    },
  }) === false
);
assert(
  "an unknown live status is not a payload",
  isSubscriptionsListPayload({
    ...subsPayload(),
    items: [
      { ...subsPayload().items[0], subscription_status: "subscribing" },
    ],
  }) === false
);
assert(
  "a non-boolean has_subscription is not a payload",
  isSubscriptionsListPayload({
    ...subsPayload(),
    items: [{ ...subsPayload().items[0], has_subscription: "yes" }],
  }) === false
);

// ============================================================
console.log("\n-- readSubscriptionsListRpc: three outcomes stay three");
/** The two fake-client shapes the directory suite established. */
function fakeClient(response, calls = []) {
  return {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return { abortSignal: () => Promise.resolve(response) };
    },
  };
}
function rejectingClient(message, calls = []) {
  return {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return { abortSignal: () => Promise.reject(new Error(message)) };
    },
  };
}

const listCalls = [];
const okList = await readSubscriptionsListRpc(
  fakeClient({ data: subsPayload(), error: null }, listCalls),
  parseSubscriptionsListQuery({})
);
eq("a populated read is state ok", okList.state, "ok");
assert(
  "…with the payload passed through unchanged",
  okList.state === "ok" && okList.payload.total === 1
);
eq("…via exactly one RPC call", listCalls.length, 1);
eq("…to admin_subscriptions_list", listCalls[0]?.fn, "admin_subscriptions_list");
eq(
  "…with the normalized query as arguments (a mistyped key would silently unfilter)",
  JSON.stringify(listCalls[0]?.args),
  JSON.stringify({
    p_search: null,
    p_plan: "all",
    p_status: "all",
    p_sort: "plan",
    p_direction: "desc",
    p_page: 1,
    p_page_size: 25,
  })
);

const filteredCalls = [];
await readSubscriptionsListRpc(
  fakeClient(
    {
      data: subsPayload({ total: 0, items: [] }),
      error: null,
    },
    filteredCalls
  ),
  parseSubscriptionsListQuery({ plan: "TEAM", status: "past_due", q: "acme" })
);
eq(
  "filters reach the RPC verbatim",
  JSON.stringify({
    p_search: filteredCalls[0]?.args.p_search,
    p_plan: filteredCalls[0]?.args.p_plan,
    p_status: filteredCalls[0]?.args.p_status,
  }),
  JSON.stringify({ p_search: "acme", p_plan: "TEAM", p_status: "past_due" })
);

const emptyList = await readSubscriptionsListRpc(
  fakeClient({ data: subsPayload({ total: 0, items: [] }), error: null }),
  parseSubscriptionsListQuery({})
);
eq(
  "zero matching rows is state empty, not state unavailable",
  emptyList.state,
  "empty"
);

const forbidden = await readSubscriptionsListRpc(
  rejectingClient("NEXUS_ADMIN_FORBIDDEN: not a platform admin"),
  parseSubscriptionsListQuery({})
);
eq("a refused read is state unavailable", forbidden.state, "unavailable");
eq(
  "…classified as FORBIDDEN, so the page renders the refusal copy",
  forbidden.state === "unavailable" ? forbidden.error.code : null,
  "FORBIDDEN"
);

const timeout = await readSubscriptionsListRpc(
  rejectingClient("Network connection terminated"),
  parseSubscriptionsListQuery({})
);
eq("a dead network is state unavailable too", timeout.state, "unavailable");
assert(
  "…never an empty list (a failed read must not read as “no paid workspaces”)",
  timeout.state === "unavailable" && !("payload" in timeout)
);

const malformed = await readSubscriptionsListRpc(
  fakeClient({ data: { total: 1 }, error: null }),
  parseSubscriptionsListQuery({})
);
eq("a malformed payload is state unavailable", malformed.state, "unavailable");
eq(
  "…classified as INVALID_PAYLOAD",
  malformed.state === "unavailable" ? malformed.error.code : null,
  "INVALID_PAYLOAD"
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
