/**
 * ============================================================
 * NEXUS ADMIN — DIRECTORY (PR 2) — UNIT TESTS
 * ============================================================
 * The pure half of the users/workspaces surface:
 *
 *   - URL parsing: clamps, whitelists, href builders. The pages never
 *     touch raw searchParams; they use parseUsersListQuery /
 *     parseWorkspacesListQuery, so these ARE the input-validation tests
 *     for every list screen (ADMIN-USERS-05 "search works", from the app
 *     side; the SQL side is in admin-users-workspaces.test.mjs).
 *   - payload guards: the boundary between "the database answered" and
 *     "we render it". A malformed payload must become an error state.
 *   - the four state transitions of the data layer (ADMIN-USERS-04 /
 *     ADMIN-WORKSPACES-05): success-with-rows, measured-empty,
 *     not-found, and unavailable. Driven through the real exported
 *     functions with fake clients — same pattern as the readActivity
 *     tests in admin-access.test.mjs — because a contract asserted only
 *     by grep is not a contract.
 *
 * Run:  node --import tsx supabase/tests/admin-directory.test.mjs
 * ============================================================
 */

const {
  parseUsersListQuery,
  parseWorkspacesListQuery,
  parseSearch,
  parsePage,
  parsePageSize,
  parseDirection,
  parseDirectoryId,
  hasActiveListFilters,
  nextSortHref,
  listHref,
  shortId,
  isUsersListPayload,
  isWorkspacesListPayload,
  isUserDetailPayload,
  isWorkspaceDetailPayload,
} = await import("../../src/lib/admin/query.ts");

const { __internals, callAdminRpc } = await import(
  "../../src/lib/admin/directory.ts"
);
const {
  readUsersListRpc,
  readWorkspacesListRpc,
  readUserDetailRpc,
  readWorkspaceDetailRpc,
} = __internals;

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
console.log("\n-- list query parsing: clamp, whitelist, never trust ----");
// ============================================================
eq("no params → the canonical default query",
  JSON.stringify(parseUsersListQuery({})),
  JSON.stringify({ search: null, status: "all", sort: "created_at", direction: "desc", page: 1, pageSize: 25 })
);
eq("page 0 clamps up to 1, not to a negative offset", parseUsersListQuery({ page: "0" }).page, 1);
eq("page -4 clamps up to 1", parseUsersListQuery({ page: "-4" }).page, 1);
eq("page 'banana' falls back to 1", parseUsersListQuery({ page: "banana" }).page, 1);
eq("page beyond MAX_PAGE clamps, it does not OFFSET forever", parseUsersListQuery({ page: "999999" }).page, 1_000);
eq("page keeps legitimate values", parseUsersListQuery({ page: "7" }).page, 7);
eq("size 7 is not on the scale → default", parseUsersListQuery({ size: "7" }).pageSize, 25);
eq("size 50 is on the scale", parseUsersListQuery({ size: "50" }).pageSize, 50);
eq("size 1000 is refused (SQL caps at 100; the app caps the scale)", parseUsersListQuery({ size: "1000" }).pageSize, 25);
eq("parsePage: numeric strings win", parsePage("12"), 12);
eq("parsePage: everything else is page 1", parsePage("1e9"), 1);
eq("parsePageSize: only the admin scale is accepted", [1, 25, 100, 101].map((n) => parsePageSize(String(n))).join(","), "25,25,100,25");

eq("search is trimmed", parseSearch("  ada@nexus.test  "), "ada@nexus.test");
eq("search of only spaces is no search", parseSearch("   "), null);
eq("missing search is null", parseSearch(undefined), null);
eq("search is bounded at 200 chars", (parseSearch("x".repeat(500)) ?? "").length, 200);
eq("repeated query keys take the first value", parseSearch(["a", "b"]), "a");

eq("unknown status falls back to 'all' (a typo is not an error screen)", parseUsersListQuery({ status: "inactive" }).status, "all");
eq("known status survives", parseUsersListQuery({ status: "pending" }).status, "pending");
eq("banned filter key accepted", parseUsersListQuery({ status: "banned" }).status, "banned");
eq("no_profile filter accepted", parseUsersListQuery({ status: "no_profile" }).status, "no_profile");
eq("the status list is case-sensitive on purpose", parseUsersListQuery({ status: "BANNED" }).status, "all");

eq("unknown sort falls back", parseUsersListQuery({ sort: "password_hash" }).sort, "created_at");
eq("whitelisted sorts are accepted", parseUsersListQuery({ sort: "last_activity" }).sort, "last_activity");
eq("direction only ever asc or desc", parseDirection("sideways"), "desc");
eq("asc is honoured", parseDirection("asc"), "asc");

eq("workspace view whitelist keeps plan codes case-sensitively", parseWorkspacesListQuery({ view: "PRO" }).view, "PRO");
eq("workspace view rejects prose", parseWorkspacesListQuery({ view: "show me pro" }).view, "all");
eq("workspace sort whitelist", parseWorkspacesListQuery({ sort: "members" }).sort, "members");
eq("workspace sort refuses unknown keys", parseWorkspacesListQuery({ sort: "revenue" }).sort, "created_at");

// --- ids -----------------------------------------------------------------
const VALID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
eq("a valid uuid passes, lowercased", parseDirectoryId(VALID.toUpperCase()), VALID);
eq("surrounding whitespace is tolerated then normalised", parseDirectoryId(`  ${VALID}  `), VALID);
eq("'null' is not an id", parseDirectoryId("null"), null);
eq("the all-zeros shape is not an id", parseDirectoryId("00000000-0000-0000-0000-00000000000g"), null);
eq("truncated uuids are refused without a round trip", parseDirectoryId(VALID.slice(0, 8)), null);
eq("path segments cannot smuggle path characters", parseDirectoryId(`${VALID}/../../`), null);
eq("an empty string is not an id", parseDirectoryId(""), null);
eq("array params take the first entry", parseDirectoryId([VALID, "junk"]), VALID);

eq("shortId keeps head and tail", shortId(VALID, 8), "3f2504e0…3301");
eq("shortId leaves short values alone", shortId("abc"), "abc");

// --- filter activity ------------------------------------------------------
assert(
  "the default query has no active filters",
  hasActiveListFilters(parseUsersListQuery({})) === false
);
assert(
  "a search counts as an active filter",
  hasActiveListFilters(parseUsersListQuery({ q: "ada" })) === true
);
assert(
  "a non-default status counts, the default does not",
  hasActiveListFilters(parseUsersListQuery({ status: "active" })) === true &&
    hasActiveListFilters(parseUsersListQuery({ status: "all" })) === false
);
assert(
  "page 2 is not itself a 'filter' worth advertising as clearable? — it IS, because Clear must restore page 1 too",
  hasActiveListFilters(parseUsersListQuery({ page: "2" })) === true
);

// ============================================================
console.log("\n-- href builders: defaults disappear, edits survive ----");
// ============================================================
const q0 = parseUsersListQuery({});
eq("the default query round-trips to the bare path", listHref("/admin/users", q0, {}), "/admin/users");
eq("search re-appears encoded", listHref("/admin/users", { ...q0, search: "a b&c" }, {}), "/admin/users?q=a+b%26c");
eq("page 1 is canonical (no param)", listHref("/admin/users", { ...q0, page: 1 }, {}), "/admin/users");
eq("page 3 is explicit", listHref("/admin/users", { ...q0, page: 3 }, {}), "/admin/users?page=3");
eq("overrides win and can delete", listHref("/admin/users", { ...q0, page: 3 }, { page: null }), "/admin/users");
eq("non-default size persists", listHref("/admin/users", { ...q0, pageSize: 50 }, {}), "/admin/users?size=50");

const sortFirst = nextSortHref("/admin/users", q0, "email");
eq("clicking an inactive column sorts it by its canonical direction — canonical means URL-clean",
   sortFirst.href, "/admin/users?sort=email");
eq("…and reports no current state", sortFirst.state, "none");
const nameFirst = nextSortHref("/admin/users", q0, "name");
eq("name-like columns prefer ascending first (also canonical)", nameFirst.href, "/admin/users?sort=name");
const emailAscAgain = nextSortHref("/admin/users", { ...q0, sort: "email", direction: "desc" }, "email");
eq("flipping email back to asc returns to the canonical state — and the URL shrinks with it",
   emailAscAgain.href, "/admin/users?sort=email");
const emailDescAgain = nextSortHref("/admin/users", { ...q0, sort: "email", direction: "asc" }, "email");
eq("…while the non-canonical desc earns an explicit param",
   emailDescAgain.href, "/admin/users?sort=email&dir=desc");
const active = nextSortHref("/admin/users", { ...q0, sort: "email", direction: "asc", page: 2 }, "email");
eq("the active column flips direction and resets the page", active.href, "/admin/users?sort=email&dir=desc");
eq("…with state read from the live query", active.state, "asc");

// ============================================================
console.log("\n-- payload guards -------------------------------------");
// ============================================================
function userRow(o = {}) {
  return {
    user_id: VALID,
    email: "ada@nexus.test",
    display_name: "Ada",
    username: null,
    has_profile: true,
    created_at: "2026-09-01T00:00:00Z",
    last_sign_in_at: null,
    last_activity_at: null,
    email_confirmed: true,
    banned_until: null,
    account_status: "active",
    memberships: { total: 1, active: 1, owned: 1 },
    platform_role: null,
    ...o,
  };
}
function usersPayload(o = {}) {
  return {
    generated_at: "2026-09-14T00:00:00Z",
    page: 1,
    page_size: 25,
    sort: "created_at",
    direction: "desc",
    search: null,
    status: "all",
    total: 1,
    items: [userRow()],
    ...o,
  };
}
assert("a well-formed users payload passes", isUsersListPayload(usersPayload()));
assert("missing total fails", isUsersListPayload({ ...usersPayload(), total: undefined }) === false);
assert("a null items array fails", isUsersListPayload({ ...usersPayload(), items: null }) === false);
assert("an invented account_status fails", isUsersListPayload(usersPayload({ items: [userRow({ account_status: "suspended" })] })) === false);
assert("a fabricated platform role fails", isUsersListPayload(usersPayload({ items: [userRow({ platform_role: "superuser" })] })) === false);
assert("memberships must be whole numbers", isUsersListPayload(usersPayload({ items: [userRow({ memberships: { total: 1, active: 1 } })] })) === false);
assert("an empty items list is a VALID payload", isUsersListPayload(usersPayload({ total: 0, items: [] })) === true);
assert("direction must be asc or desc", isUsersListPayload({ ...usersPayload(), direction: "descending" }) === false);

function wsRow(o = {}) {
  return {
    workspace_id: "9c858901-8a57-4791-81fe-632f2b63c06b",
    name: "Lovelace Labs",
    slug: "ada-9c858901",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-02T00:00:00Z",
    last_activity_at: null,
    owner: { user_id: VALID, email: "ada@nexus.test", display_name: "Ada", username: null },
    members: { total: 1, active: 1 },
    projects: 0,
    tasks: 0,
    plan: "FREE",
    has_subscription: false,
    subscription_status: null,
    has_active_owner: true,
    ...o,
  };
}
function wsPayload(o = {}) {
  return {
    generated_at: "2026-09-14T00:00:00Z",
    page: 1,
    page_size: 25,
    sort: "created_at",
    direction: "desc",
    search: null,
    view: "all",
    total: 1,
    items: [wsRow()],
    ...o,
  };
}
assert("a well-formed workspaces payload passes", isWorkspacesListPayload(wsPayload()));
assert("an invented plan fails the guard", isWorkspacesListPayload(wsPayload({ items: [wsRow({ plan: "ENTERPRISE" })] })) === false);
assert("has_active_owner must be boolean", isWorkspacesListPayload(wsPayload({ items: [wsRow({ has_active_owner: 1 })] })) === false);
assert("a missing owner block fails", isWorkspacesListPayload(wsPayload({ items: [{ ...wsRow(), owner: undefined }] })) === false);

// --- detail payloads (representative, not exhaustive — SQL suite covers shape)
const userDetail = {
  generated_at: "2026-09-14T00:00:00Z",
  identity: {
    user_id: VALID, email: "ada@nexus.test", display_name: "Ada", username: null,
    job_title: null, bio: null, avatar_url: null,
    created_at: "2026-09-01T00:00:00Z",
    profile_created_at: null, profile_updated_at: null,
  },
  account: {
    has_profile: false, email_confirmed: true, email_confirmed_at: null,
    last_sign_in_at: null, banned_until: null, onboarding_completed: false,
    account_status: "active", last_activity_at: null,
  },
  platform_admin: { is_admin: false, role: null, status: null, since: null, note: null },
  usage: {
    memberships_total: 0, memberships_active: 0, workspaces_owned: 0,
    tasks_created: 0, tasks_assigned: 0, tasks_open: 0, tasks_done: 0,
    projects_owned: 0, goals_created: 0, notifications_unread: 0, activity_events: 0,
  },
  workspaces: [],
  recent_activity: [],
};
assert("a well-formed user detail passes", isUserDetailPayload(userDetail));
assert("a string usage count fails hard", isUserDetailPayload({ ...userDetail, usage: { ...userDetail.usage, tasks_created: "12" } }) === false);
assert("a missing usage block fails", isUserDetailPayload({ ...userDetail, usage: undefined }) === false);
assert(
  "a malformed workspace ref in the list fails the whole payload",
  isUserDetailPayload({
    ...userDetail,
    workspaces: [{ workspace_id: "x" }],
  }) === false
);

const wsDetail = {
  generated_at: "2026-09-14T00:00:00Z",
  overview: {
    workspace_id: "9c858901-8a57-4791-81fe-632f2b63c06b", name: "Lovelace Labs",
    slug: "ada-9c858901", description: null, icon: null, color: null,
    created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
    last_activity_at: null,
  },
  owner: {
    user_id: VALID, email: "ada@nexus.test", display_name: "Ada", username: null,
    account_status: "active", last_sign_in_at: null,
  },
  health: { has_active_owner: true, member_count_active: 1 },
  subscription: [],
  members: [],
  usage: { projects: 0, tasks: 0, goals: 0, events: 0, notifications: 0, signals: 0, missions: 0 },
  tasks_by_status: {},
  recent_projects: [],
  recent_tasks: [],
  recent_activity: [],
};
assert("a well-formed workspace detail passes", isWorkspaceDetailPayload(wsDetail));
assert("a null owner is allowed (orphaned in the strict sense)", isWorkspaceDetailPayload({ ...wsDetail, owner: null }) === true);
assert("tasks_by_status with a string count fails", isWorkspaceDetailPayload({ ...wsDetail, tasks_by_status: { todo: "3" } }) === false);
assert(
  "recent_activity entries must carry their timestamp",
  isWorkspaceDetailPayload({
    ...wsDetail,
    recent_activity: [{ activity_id: "a", actor_id: null, actor_email: null, action: "created", entity_type: "task" }],
  }) === false
);

// ============================================================
console.log("\n-- ADMIN-USERS-04 / WS-05: empty ≠ error ≠ missing -------");
// ============================================================
/** The two fake-client shapes the readActivity tests established. */
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
const okList = await readUsersListRpc(
  fakeClient({ data: usersPayload(), error: null }, listCalls),
  parseUsersListQuery({})
);
eq("a populated read is state ok", okList.state, "ok");
assert("…with the payload passed through unchanged", okList.state === "ok" && okList.payload.total === 1);
eq("…and exactly one RPC is issued (no N+1 above the SQL)", listCalls.length, 1);
assert(
  "…carrying the normalized query, not raw searchParams",
  listCalls[0].fn === "admin_users_list" &&
    listCalls[0].args.p_page === 1 &&
    listCalls[0].args.p_search === null &&
    listCalls[0].args.p_status === "all"
);

const emptyCalls = [];
const emptyList = await readUsersListRpc(
  fakeClient({ data: usersPayload({ total: 0, items: [] }), error: null }, emptyCalls),
  parseUsersListQuery({ q: "zzz" })
);
eq("ADMIN-USERS-04: zero matches is 'empty', a measured outcome", emptyList.state, "empty");
assert("…and the payload keeps the true total for the UI sentence", emptyList.state === "empty" && emptyList.payload.total === 0);
assert("…no error is attached to an honest zero", !("error" in emptyList));

const errCalls = [];
const brokenList = await readUsersListRpc(
  fakeClient({ data: null, error: { code: "XX000", message: "connection terminated" } }, errCalls),
  parseUsersListQuery({})
);
eq("ADMIN-USERS-04: a failed read is 'unavailable' — never 'empty'", brokenList.state, "unavailable");
assert("…and it carries no items array a UI could render as a zero", brokenList.state === "unavailable" && !("items" in brokenList) && !("payload" in brokenList));
assert(
  "…with a message written for the operator, not the raw transport string",
  brokenList.state === "unavailable" &&
    typeof brokenList.error.message === "string" &&
    brokenList.error.message.length > 10
);
assert(
  "…with the migration-class error code separated from generic failures",
  brokenList.state === "unavailable" && brokenList.error.code === "UNAVAILABLE"
);

const notInstalled = await readUsersListRpc(
  fakeClient({ data: null, error: { code: "PGRST202", message: "Could not find the function" } }, []),
  parseUsersListQuery({})
);
assert(
  "a missing 027 reports NOT_INSTALLED with the fix, not an empty table",
  notInstalled.state === "unavailable" &&
    notInstalled.error.code === "NOT_INSTALLED",
  JSON.stringify(notInstalled)
);

const forbidden = await readUsersListRpc(
  fakeClient({ data: null, error: { code: "42501", message: "NEXUS_ADMIN_FORBIDDEN: platform admin access required" } }, []),
  parseUsersListQuery({})
);
assert(
  "a database-level refusal classifies as FORBIDDEN",
  forbidden.state === "unavailable" && forbidden.error.code === "FORBIDDEN",
  JSON.stringify(forbidden)
);

const rejectedList = await readUsersListRpc(rejectingClient("fetch failed"), parseUsersListQuery({}));
eq("a rejecting transport is unavailable as well", rejectedList.state, "unavailable");

const malformedList = await readUsersListRpc(
  fakeClient({ data: { items: "yes" }, error: null }, []),
  parseUsersListQuery({})
);
assert(
  "an unexpected payload shape is unavailable — never silently empty",
  malformedList.state === "unavailable" &&
    malformedList.state === "unavailable" &&
    malformedList.error.code === "INVALID_PAYLOAD",
  JSON.stringify(malformedList)
);

const nullDataList = await readUsersListRpc(
  fakeClient({ data: null, error: null }, []),
  parseUsersListQuery({})
);
assert(
  "a list RPC answering NULL with no error is a shape failure, not '0 users'",
  nullDataList.state === "unavailable" && nullDataList.error.code === "INVALID_PAYLOAD",
  JSON.stringify(nullDataList)
);

// --- workspaces list, same contract ---
const wsBroken = await readWorkspacesListRpc(
  fakeClient({ data: null, error: { code: "57P01", message: "admin cancelled query" } }, []),
  parseWorkspacesListQuery({})
);
eq("ADMIN-WORKSPACES-05: a DB error never becomes '0 workspaces'", wsBroken.state, "unavailable");
assert(
  "…the error has a code and a message, ready for the error panel",
  wsBroken.state === "unavailable" && wsBroken.error.code !== null && wsBroken.error.message.length > 0
);
const wsEmpty = await readWorkspacesListRpc(
  fakeClient({ data: wsPayload({ total: 0, items: [] }), error: null }, []),
  parseWorkspacesListQuery({ view: "PRO" })
);
eq("…while an honest zero is 'empty'", wsEmpty.state, "empty");

// --- details: found / not_found / unavailable are three states ---
const foundDetail = await readUserDetailRpc(
  fakeClient({ data: userDetail, error: null }, []),
  VALID
);
eq("a real id resolves to found", foundDetail.state, "found");
const ghostDetail = await readUserDetailRpc(
  fakeClient({ data: null, error: null }, []),
  "00000000-0000-0000-0000-000000000000"
);
eq("ADMIN-USERS-06: the RPC answering NULL is 'not_found'", ghostDetail.state, "not_found");
const brokenDetail = await readUserDetailRpc(
  fakeClient({ data: null, error: { code: "08006", message: "connection terminated unexpectedly" } }, []),
  VALID
);
eq("…while a failed read is 'unavailable', never a fake 'user does not exist'", brokenDetail.state, "unavailable");
const malformedDetail = await readUserDetailRpc(
  fakeClient({ data: { identity: {} }, error: null }, []),
  VALID
);
assert(
  "a half-shaped detail is unavailable too (INVALID_PAYLOAD)",
  malformedDetail.state === "unavailable" &&
    malformedDetail.state === "unavailable" &&
    malformedDetail.error.code === "INVALID_PAYLOAD"
);

const wsFound = await readWorkspaceDetailRpc(fakeClient({ data: wsDetail, error: null }, []), "9c858901-8a57-4791-81fe-632f2b63c06b");
eq("workspace detail found", wsFound.state, "found");
const wsGhost = await readWorkspaceDetailRpc(fakeClient({ data: null, error: null }, []), "9c858901-8a57-4791-81fe-632f2b63c06b");
eq("ADMIN-WORKSPACES-04: unknown id is not_found", wsGhost.state, "not_found");
const wsBroken2 = await readWorkspaceDetailRpc(
  fakeClient({ data: null, error: { code: "42501", message: "NEXUS_ADMIN_FORBIDDEN: platform admin access required" } }, []),
  "9c858901-8a57-4791-81fe-632f2b63c06b"
);
assert(
  "ADMIN-WORKSPACES-02 (app half): a refusal is reported, not an empty or missing record",
  wsBroken2.state === "unavailable" && wsBroken2.error.code === "FORBIDDEN"
);

// --- callAdminRpc hygiene: only named admin RPCs flow through ---
const spy = [];
await callAdminRpc(fakeClient({ data: null, error: null }, spy), "admin_users_list", {}, 1000, "TAG");
eq("callAdminRpc passes the function name through verbatim", spy[0]?.fn, "admin_users_list");
eq("…and the argument object untouched", JSON.stringify(spy[0]?.args), "{}");

// --- mutual exclusivity of the states (the UI depends on this) ---
const samples = [okList, emptyList, brokenList, rejectedList, malformedList, nullDataList];
assert(
  "list results carry a payload iff they succeeded; an error iff they failed",
  samples.every((r) =>
    r.state === "ok" || r.state === "empty"
      ? Boolean(r.payload) && !("error" in r)
      : Boolean(r.error) && !("payload" in r)
  )
);
const detailSamples = [foundDetail, ghostDetail, brokenDetail, malformedDetail];
assert(
  "detail results are exactly one of found / not_found / unavailable",
  new Set(detailSamples.map((r) => r.state)).size === 3 &&
    detailSamples.every((r) =>
      r.state === "found" ? Boolean(r.detail) : r.state === "not_found" ? true : Boolean(r.error)
    )
);

// ============================================================
console.log("\n-- URL ↔ query round-trip (clean URLs must stay correct) --");
// ============================================================
for (const [href, expectSort, expectDir] of [
  ["?sort=name", "name", "asc"],
  ["?sort=name&dir=desc", "name", "desc"],
  ["?sort=email", "email", "asc"],
  ["?sort=created_at", "created_at", "desc"],
  ["?dir=asc", "created_at", "asc"],
]) {
  const parsed = parseUsersListQuery(Object.fromEntries(new URLSearchParams(href.slice(1))));
  assert(
    `${href} parses to sort=${expectSort} dir=${expectDir}`,
    parsed.sort === expectSort && parsed.direction === expectDir,
    JSON.stringify(parsed)
  );
  // and a stripped href is stable: listHref of the parsed query returns it
  const rebuilt = listHref("/admin/users", parsed, {});
  const bare = rebuilt.slice("/admin/users".length) || "";
  assert(
    `…and re-serialises to ${href} or cleaner`,
    bare === href.slice(1) ||
      (new URLSearchParams(bare).size <= new URLSearchParams(href.slice(1)).size),
    rebuilt
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
