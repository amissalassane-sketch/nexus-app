/**
 * ============================================================
 * NEXUS — AUTH PIPELINE END-TO-END TEST
 * ============================================================
 * Drives the real application (dev or production server) against a stubbed
 * Supabase service and asserts the complete session pipeline:
 *
 *   sign in -> tokens -> /api/auth/session -> SSR cookies -> proxy ->
 *   protected pages -> logout
 *
 * Nothing about NEXUS itself is mocked: the proxy, the route handler, the
 * server components and the cookie plumbing are the real ones.
 *
 * Usage:
 *   node supabase/tests/auth-flow.test.mjs            # expects app on :3100
 *   APP_URL=http://localhost:3000 node supabase/tests/auth-flow.test.mjs
 *
 * The app under test must be started with:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key \
 *   npm run dev -- --port 3100
 * ============================================================
 */

import { makeSession, startSupabaseStub } from "./supabase-stub.mjs";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3100";

let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${detail}`);
  }
}

/** Minimal cookie jar so we behave like a browser across requests. */
function createJar() {
  const jar = new Map();
  return {
    store(response) {
      const raw = response.headers.getSetCookie?.() ?? [];
      for (const cookie of raw) {
        const [pair] = cookie.split(";");
        const index = pair.indexOf("=");
        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (value === "" || /expires=Thu, 01 Jan 1970/i.test(cookie)) jar.delete(name);
        else jar.set(name, value);
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    size() {
      return jar.size;
    },
    names() {
      return [...jar.keys()];
    },
  };
}

async function visit(path, { jar, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${APP_URL}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(jar?.size() ? { cookie: jar.header() } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  jar?.store(response);
  return response;
}

const stub = await startSupabaseStub(54321);
console.log(`Supabase stub listening on ${stub.url}`);
console.log(`Application under test: ${APP_URL}\n`);

// ---- 1. anonymous access -------------------------------------------
console.log("-- anonymous ------------------------------------------");

for (const path of ["/", "/dashboard", "/tasks", "/projects", "/goals", "/notifications", "/settings", "/settings/billing", "/upgrade", "/onboarding"]) {
  const response = await visit(path);
  assert(
    `anonymous ${path} redirects to /login`,
    response.status === 307 && (response.headers.get("location") ?? "").endsWith("/login"),
    `status=${response.status} location=${response.headers.get("location")}`
  );
}

const loginPage = await visit("/login");
assert("anonymous /login renders", loginPage.status === 200, `status=${loginPage.status}`);

const signupPage = await visit("/signup");
assert("anonymous /signup renders", signupPage.status === 200, `status=${signupPage.status}`);

// ---- 2. session handshake ------------------------------------------
console.log("\n-- sign-in handshake ----------------------------------");

const jar = createJar();
const session = makeSession();

const badPayload = await visit("/api/auth/session", {
  jar,
  method: "POST",
  body: { access_token: 123 },
});
assert(
  "/api/auth/session rejects a malformed payload",
  badPayload.status === 400,
  `status=${badPayload.status}`
);

const handshake = await visit("/api/auth/session", {
  jar,
  method: "POST",
  body: {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  },
});
assert(
  "/api/auth/session accepts valid tokens",
  handshake.status === 200,
  `status=${handshake.status} body=${await handshake.clone().text()}`
);
assert(
  "/api/auth/session writes Supabase auth cookies",
  jar.size() > 0,
  `cookies=${JSON.stringify(jar.names())}`
);

// ---- 3. authenticated navigation ------------------------------------
console.log("\n-- authenticated navigation ---------------------------");

const root = await visit("/", { jar });
assert(
  "authenticated / redirects to /dashboard",
  root.status === 307 && (root.headers.get("location") ?? "").endsWith("/dashboard"),
  `status=${root.status} location=${root.headers.get("location")}`
);

const dashboard = await visit("/dashboard", { jar });
const dashboardHtml = await dashboard.text();
assert(
  "authenticated /dashboard returns 200",
  dashboard.status === 200,
  `status=${dashboard.status}`
);
assert(
  "/dashboard renders the shell for the signed-in user",
  dashboardHtml.includes("Dashboard") && !dashboardHtml.includes("Sign in to NEXUS"),
  "dashboard HTML did not contain the expected shell"
);

for (const path of ["/tasks", "/projects", "/goals", "/notifications", "/settings", "/settings/billing", "/upgrade"]) {
  const response = await visit(path, { jar });
  assert(`authenticated ${path} returns 200`, response.status === 200, `status=${response.status}`);
}

const loginWhenAuthenticated = await visit("/login", { jar });
assert(
  "authenticated /login redirects away (no dead-end on the login page)",
  loginWhenAuthenticated.status === 307,
  `status=${loginWhenAuthenticated.status} location=${loginWhenAuthenticated.headers.get("location")}`
);

// ---- 4. API contract -------------------------------------------------
console.log("\n-- API contract ---------------------------------------");

const upgradeAnonymous = await visit("/api/billing/upgrade", {
  method: "POST",
  body: { targetPlan: "PRO" },
});
assert(
  "/api/billing/upgrade refuses anonymous callers with 401 JSON",
  upgradeAnonymous.status === 401 &&
    (upgradeAnonymous.headers.get("content-type") ?? "").includes("application/json"),
  `status=${upgradeAnonymous.status} type=${upgradeAnonymous.headers.get("content-type")}`
);

const upgradeAuthenticated = await visit("/api/billing/upgrade", {
  jar,
  method: "POST",
  body: { targetPlan: "PRO" },
});
assert(
  "/api/billing/upgrade refuses a signed-in user without an active workspace (403)",
  upgradeAuthenticated.status === 403,
  `status=${upgradeAuthenticated.status} body=${await upgradeAuthenticated.clone().text()}`
);

const upgradeBadPlan = await visit("/api/billing/upgrade", {
  jar,
  method: "POST",
  body: { targetPlan: "FREE" },
});
assert(
  "/api/billing/upgrade rejects FREE as a target plan (400)",
  upgradeBadPlan.status === 400,
  `status=${upgradeBadPlan.status}`
);

// ---- 5. sign-out -----------------------------------------------------
console.log("\n-- sign-out -------------------------------------------");

const signOut = await visit("/api/auth/session", { jar, method: "DELETE" });
assert("/api/auth/session supports sign-out (DELETE)", signOut.status === 200, `status=${signOut.status}`);

const afterSignOut = await visit("/dashboard", { jar });
assert(
  "after sign-out /dashboard redirects to /login",
  afterSignOut.status === 307 && (afterSignOut.headers.get("location") ?? "").endsWith("/login"),
  `status=${afterSignOut.status} location=${afterSignOut.headers.get("location")}`
);

await stub.close();

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
process.exit(failed === 0 ? 0 : 1);
