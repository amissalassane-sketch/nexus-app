/**
 * ============================================================
 * NEXUS ADMIN — ACCESS & HONESTY UNIT TESTS
 * ============================================================
 * Exercises the pure half of the admin foundation: the code that decides
 * *why* a check failed, the role vocabulary, and the formatters that keep
 * a missing measurement from being rendered as a zero.
 *
 * These are the branches the other two suites cannot reach:
 *   - "migration not applied" needs a PostgREST that reports a missing
 *     function, which the local stub does not;
 *   - the formatting rule (NULL ≠ 0) is a contract, and a contract that
 *     is only asserted by grepping source is not a contract.
 *
 * Run:  node --import tsx supabase/tests/admin-access.test.mjs
 * ============================================================
 */

// Same loading convention as the other tsx suites in this folder: dynamic
// import of the .ts source by relative path. The `@/` alias is a Next.js
// bundler alias and does not resolve for a Node entry point.
const { classifyGuardError } = await import("../../src/lib/admin/guard.ts");
const {
  capabilitiesFor,
  isPlatformAdminRole,
  isAdminState,
  PLATFORM_ADMIN_ROLES,
} = await import("../../src/lib/admin/types.ts");
const {
  NOT_AVAILABLE,
  formatCount,
  formatCompact,
  formatShare,
  formatLatency,
  formatRelativeTime,
  formatDateTime,
} = await import("../../src/lib/admin/format.ts");
const { ADMIN_NAV, readyAdminRoutes, ADMIN_HOME } = await import(
  "../../src/lib/admin/nav.ts"
);

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
console.log("\n-- ADMIN-03: the refusal reason is diagnosed correctly --");
// ============================================================
eq(
  "a PostgREST 404 means the control plane is not installed",
  classifyGuardError({ code: "404", message: "Not found" }),
  "MIGRATION_NOT_APPLIED"
);
eq(
  "PGRST202 (unknown function) means the control plane is not installed",
  classifyGuardError({ code: "PGRST202", message: "" }),
  "MIGRATION_NOT_APPLIED"
);
eq(
  "Postgres' own wording is recognised too",
  classifyGuardError({
    code: "42883",
    message: "Could not find the function public.platform_admin_context()",
  }),
  "MIGRATION_NOT_APPLIED"
);
eq(
  "a forbidden error is not reported as a missing migration",
  classifyGuardError({ code: "42501", message: "NEXUS_ADMIN_FORBIDDEN" }),
  "QUERY_FAILED"
);
eq(
  "a dead connection is reported as a failed query",
  classifyGuardError({ code: "08006", message: "connection terminated unexpectedly" }),
  "QUERY_FAILED"
);
eq(
  "an empty error still produces a reason (never undefined)",
  classifyGuardError({}),
  "QUERY_FAILED"
);

// ============================================================
console.log("\n-- ADMIN-01/02: the platform role vocabulary --------------");
// ============================================================
eq("there are exactly three platform roles", PLATFORM_ADMIN_ROLES.length, 3);
assert(
  "owner / operator / viewer are the platform roles",
  isPlatformAdminRole("owner") &&
    isPlatformAdminRole("operator") &&
    isPlatformAdminRole("viewer")
);
// The single most dangerous confusion in this codebase: workspace_members
// also has a role called "admin", and it means something completely
// different. It must never satisfy a platform check.
assert(
  'a workspace "admin" is NOT a platform admin',
  isPlatformAdminRole("admin") === false
);
assert(
  'a workspace "member" is NOT a platform admin',
  isPlatformAdminRole("member") === false
);
assert("a non-string is not a platform admin", isPlatformAdminRole(null) === false);
assert("an object is not a platform admin", isPlatformAdminRole({ role: "owner" }) === false);

eq(
  "a viewer may read but not act",
  JSON.stringify(capabilitiesFor("viewer")),
  JSON.stringify({ read: true, act: false, manageAdmins: false })
);
eq(
  "an operator may read and act, but not manage admins",
  JSON.stringify(capabilitiesFor("operator")),
  JSON.stringify({ read: true, act: true, manageAdmins: false })
);
eq(
  "an owner may do everything",
  JSON.stringify(capabilitiesFor("owner")),
  JSON.stringify({ read: true, act: true, manageAdmins: true })
);

assert(
  "only the admin state passes isAdminState()",
  isAdminState({ status: "admin", userId: "u", role: "viewer" }) &&
    !isAdminState({ status: "not_admin", userId: "u" }) &&
    !isAdminState({ status: "unauthenticated" }) &&
    !isAdminState({ status: "unavailable", reason: "TIMEOUT" })
);

// ============================================================
console.log("\n-- ADMIN-12: a missing measurement is never a zero --------");
// ============================================================
eq("the marker is the literal string the UI shows", NOT_AVAILABLE, "Not available");

eq("formatCount(null) → marker", formatCount(null), NOT_AVAILABLE);
eq("formatCount(undefined) → marker", formatCount(undefined), NOT_AVAILABLE);
eq("formatCount(NaN) → marker", formatCount(Number.NaN), NOT_AVAILABLE);
eq("formatCount(Infinity) → marker", formatCount(Number.POSITIVE_INFINITY), NOT_AVAILABLE);
// The whole point: zero is a measurement and must survive as zero.
eq("formatCount(0) → \"0\", never the marker", formatCount(0), "0");
eq("formatCount(1234) is grouped", formatCount(1234), "1,234");
eq("formatCount(-3) keeps its sign", formatCount(-3), "-3");

eq("formatCompact(null) → marker", formatCompact(null), NOT_AVAILABLE);
eq("formatCompact(0) → \"0\"", formatCompact(0), "0");
eq("formatCompact(12345) is compact", formatCompact(12345), "12.3K");

eq("formatShare with an unknown part → null", formatShare(null, 10), null);
eq("formatShare with an unknown total → null", formatShare(5, null), null);
eq("formatShare with a zero total → null, not Infinity", formatShare(5, 0), null);
eq("formatShare(5, 10) → 50%", formatShare(5, 10), "50%");
eq("formatShare(0, 10) → 0%", formatShare(0, 10), "0%");

eq("formatLatency(null) → marker", formatLatency(null), NOT_AVAILABLE);
eq("formatLatency(42) → 42 ms", formatLatency(42), "42 ms");
eq("formatLatency(1500) → seconds", formatLatency(1500), "1.50 s");

eq("formatRelativeTime(null) → marker", formatRelativeTime(null), NOT_AVAILABLE);
eq(
  "formatRelativeTime on an unparseable date → marker, not \"Invalid Date\"",
  formatRelativeTime("not-a-date"),
  NOT_AVAILABLE
);
eq(
  "formatRelativeTime(now) → just now",
  formatRelativeTime(new Date().toISOString()),
  "just now"
);
eq(
  "formatRelativeTime(60s ago) → 1m ago",
  formatRelativeTime(new Date(Date.now() - 60_000).toISOString()),
  "1m ago"
);
eq(
  "formatRelativeTime(3h ago) → 3h ago",
  formatRelativeTime(new Date(Date.now() - 3 * 3_600_000).toISOString()),
  "3h ago"
);
eq("formatDateTime(null) → marker", formatDateTime(null), NOT_AVAILABLE);
eq(
  "formatDateTime on an unparseable date → marker",
  formatDateTime("2026-13-45T99:99:99Z"),
  NOT_AVAILABLE
);
assert(
  "formatDateTime names its time zone, so a timestamp cannot be misread",
  /UTC/.test(formatDateTime("2026-01-02T03:04:05Z")),
  formatDateTime("2026-01-02T03:04:05Z")
);

// ============================================================
console.log("\n-- NAVIGATION: no entry points at nothing -----------------");
// ============================================================
const ready = readyAdminRoutes();
assert("the control plane ships at least one working route", ready.length >= 1);
assert("the admin home is one of the ready routes", ready.includes(ADMIN_HOME));

const allItems = ADMIN_NAV.flatMap((group) => group.items);
assert(
  "every navigation entry declares a status",
  allItems.every((item) => item.status === "ready" || item.status === "planned")
);
assert(
  "every planned entry states why it is not ready",
  allItems
    .filter((item) => item.status === "planned")
    .every((item) => typeof item.note === "string" && item.note.length > 10),
  allItems
    .filter((item) => item.status === "planned" && !(item.note?.length > 10))
    .map((item) => item.label)
    .join(", ")
);
assert(
  "the seven operational groups are all present",
  ["control", "business", "finance", "product", "operations", "security", "platform"].every(
    (id) => ADMIN_NAV.some((group) => group.id === id)
  ),
  ADMIN_NAV.map((g) => g.id).join(",")
);
assert(
  "no two entries share a route",
  new Set(allItems.map((item) => item.href)).size === allItems.length
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
