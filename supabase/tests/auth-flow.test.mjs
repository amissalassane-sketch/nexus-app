/**
 * ============================================================
 * NEXUS — AUTH END-TO-END TEST
 * ============================================================
 * Exercises the real application (server auth routes, proxy, server
 * components, cookie plumbing) against a stubbed Supabase service.
 *
 * Covers the scenarios that must never regress:
 *   signup (session / confirmation / already registered)
 *   login  (success / wrong password / unknown email / invalid input)
 *   session persistence + expired-token refresh
 *   route protection
 *   onboarding gate
 *   logout
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key npm run dev -- --port 3000
 *   node supabase/tests/auth-flow.test.mjs
 * ============================================================
 */

import { makeAccessToken, startSupabaseStub } from "./supabase-stub.mjs";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

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

function createJar() {
  const jar = new Map();
  return {
    store(response) {
      for (const cookie of response.headers.getSetCookie?.() ?? []) {
        const [pair] = cookie.split(";");
        const index = pair.indexOf("=");
        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (value === "" || /expires=Thu, 01 Jan 1970/i.test(cookie)) jar.delete(name);
        else jar.set(name, value);
      }
    },
    set(name, value) {
      jar.set(name, value);
    },
    get(name) {
      return jar.get(name);
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    size: () => jar.size,
    names: () => [...jar.keys()],
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

const PRODUCT_ROUTES = [
  "/dashboard",
  "/tasks",
  "/projects",
  "/goals",
  "/notifications",
  "/settings",
  "/settings/billing",
  "/upgrade",
];

// Reuse an already-running stub (e.g. one backing a preview server).
const stub = await startSupabaseStub(54321).catch((cause) => {
  if (cause?.code !== "EADDRINUSE") throw cause;
  console.log("(reusing the Supabase stub already listening on 54321)");
  return { url: "http://127.0.0.1:54321", calls: [], close: async () => {} };
});
console.log(`Supabase stub: ${stub.url}\nApplication:   ${APP_URL}\n`);

// ============ 1. ROUTE PROTECTION (no session) ============
console.log("-- protection (anonymous) -----------------------------");

for (const path of [...PRODUCT_ROUTES, "/onboarding"]) {
  const response = await visit(path);
  assert(
    `anonymous ${path} -> /login`,
    response.status === 307 && (response.headers.get("location") ?? "").endsWith("/login"),
    `status=${response.status} location=${response.headers.get("location")}`
  );
}

const landing = await visit("/");
const landingHtml = await landing.text();
assert("anonymous / renders the public homepage", landing.status === 200, `status=${landing.status}`);
assert(
  "public homepage offers sign in and sign up",
  landingHtml.includes("It reads the work.") &&
    landingHtml.includes("Get started") &&
    landingHtml.includes("Sign in"),
  "landing copy missing"
);

assert("anonymous /login renders", (await visit("/login")).status === 200);
assert("anonymous /signup renders", (await visit("/signup")).status === 200);
assert("anonymous /forgot-password renders", (await visit("/forgot-password")).status === 200);
assert("anonymous /check-email renders", (await visit("/check-email")).status === 200);

function redirectTarget(response) {
  return new URL(response.headers.get("location") ?? "", APP_URL);
}

const callbackBare = await visit("/auth/callback");
assert(
  "confirmation link without a code goes to the landing page, not /onboarding",
  callbackBare.status === 307 &&
    redirectTarget(callbackBare).pathname === "/" &&
    !redirectTarget(callbackBare).href.includes("onboarding") &&
    redirectTarget(callbackBare).pathname !== "/login",
  `status=${callbackBare.status} location=${callbackBare.headers.get("location")}`
);

const callbackOnboarding = await visit("/auth/callback?code=ok-code&next=/onboarding");
assert(
  "legacy next=/onboarding confirmation links still land on the homepage",
  callbackOnboarding.status === 307 &&
    (callbackOnboarding.headers.get("location") ?? "").includes("/?confirmed=1") &&
    !(callbackOnboarding.headers.get("location") ?? "").includes("onboarding"),
  `status=${callbackOnboarding.status} location=${callbackOnboarding.headers.get("location")}`
);

const callbackInvalid = await visit("/auth/callback?code=invalid");
assert(
  "a confirmation click in another browser (failed PKCE) still opens the landing page",
  callbackInvalid.status === 307 &&
    !(callbackInvalid.headers.get("location") ?? "").includes("onboarding") &&
    !(callbackInvalid.headers.get("location") ?? "").includes("/login"),
  `status=${callbackInvalid.status} location=${callbackInvalid.headers.get("location")}`
);

const callbackRecover = await visit("/auth/callback?code=recover-code&next=/reset-password");
assert(
  "a recovery link that cannot be exchanged does not open onboarding",
  callbackRecover.status === 307 &&
    !(callbackRecover.headers.get("location") ?? "").includes("onboarding") &&
    (callbackRecover.headers.get("location") ?? "").includes("/forgot-password"),
  `status=${callbackRecover.status} location=${callbackRecover.headers.get("location")}`
);

const emailOnOnboarding = await visit("/onboarding?code=ok-code");
assert(
  "a confirmation code that landed on /onboarding is forwarded to /auth/callback",
  emailOnOnboarding.status === 307 &&
    (emailOnOnboarding.headers.get("location") ?? "").includes("/auth/callback") &&
    (emailOnOnboarding.headers.get("location") ?? "").includes("code=ok-code"),
  `status=${emailOnOnboarding.status} location=${emailOnOnboarding.headers.get("location")}`
);

const confirmedLanding = await visit("/?confirmed=1");
const confirmedHtml = await confirmedLanding.text();
assert(
  "landing page after confirmation still offers sign in and sign up",
  confirmedLanding.status === 200 &&
    confirmedHtml.includes("Sign in") &&
    (confirmedHtml.includes("Create your NEXUS") || confirmedHtml.includes("Get started")),
  `status=${confirmedLanding.status}`
);

const health = await visit("/api/health");
const healthBody = await health.json().catch(() => null);
assert(
  "/api/health is public and reports ok",
  health.status === 200 && healthBody?.ok === true && healthBody?.service === "nexus",
  JSON.stringify(healthBody)
);

// ============ 2. SIGNUP ============
console.log("\n-- signup ---------------------------------------------");

const signupJar = createJar();
const signup = await visit("/api/auth/signup", {
  jar: signupJar,
  method: "POST",
  body: {
    email: "fresh@nexus.test",
    password: "supersecret",
  },
});
const signupBody = await signup.json().catch(() => null);

assert("signup succeeds", signup.status === 200 && signupBody?.ok === true, JSON.stringify(signupBody));
assert(
  "signup with an immediate session writes auth cookies",
  signupJar.size() > 0,
  `cookies=${JSON.stringify(signupJar.names())}`
);
assert(
  "signup sends the new user to /onboarding",
  signupBody?.redirectTo === "/onboarding",
  JSON.stringify(signupBody)
);
assert(
  "confirmation email never forces /onboarding",
  (stub.redirectTos ?? []).every((value) => !String(value).includes("onboarding")),
  JSON.stringify(stub.redirectTos)
);

const confirmSignup = await visit("/api/auth/signup", {
  method: "POST",
  body: {
    email: "confirm-me@nexus.test",
    password: "supersecret",
  },
});
const confirmBody = await confirmSignup.json().catch(() => null);
assert(
  "signup requiring email confirmation is reported explicitly",
  confirmSignup.status === 200 &&
    confirmBody?.ok === true &&
    confirmBody?.requiresConfirmation === true &&
    typeof confirmBody?.message === "string",
  JSON.stringify(confirmBody)
);

const existing = await visit("/api/auth/signup", {
  method: "POST",
  body: {
    email: "existing@nexus.test",
    password: "supersecret",
  },
});
const existingBody = await existing.json().catch(() => null);
assert(
  "signup with an existing email returns a readable error",
  existing.status === 400 && /already exists/i.test(existingBody?.error ?? ""),
  JSON.stringify(existingBody)
);

const badSignup = await visit("/api/auth/signup", {
  method: "POST",
  body: { email: "not-an-email", password: "123" },
});
assert("signup validates its input (400)", badSignup.status === 400);

// Signup is intentionally minimal: it must NOT require onboarding fields.
// Name, username, workspace and goals are collected later in onboarding.
const minimalSignup = await visit("/api/auth/signup", {
  method: "POST",
  body: { email: "minimal@nexus.test", password: "supersecret" },
});
const minimalBody = await minimalSignup.json().catch(() => null);
assert(
  "signup accepts email + password only (no onboarding fields)",
  minimalSignup.status === 200 && minimalBody?.ok === true,
  JSON.stringify(minimalBody)
);

// ============ 3. ONBOARDING GATE ============
console.log("\n-- onboarding gate ------------------------------------");

const gate = await visit("/dashboard", { jar: signupJar });
assert(
  "a user without a completed profile is sent to /onboarding",
  gate.status === 307 && (gate.headers.get("location") ?? "").endsWith("/onboarding"),
  `status=${gate.status} location=${gate.headers.get("location")}`
);

const onboarding = await visit("/onboarding", { jar: signupJar });
assert("authenticated /onboarding renders", onboarding.status === 200, `status=${onboarding.status}`);

// ============ 4. LOGIN ============
console.log("\n-- login ----------------------------------------------");

const wrongPassword = await visit("/api/auth/signin", {
  method: "POST",
  body: { email: "owner@nexus.test", password: "wrong-password" },
});
const wrongBody = await wrongPassword.json().catch(() => null);
assert(
  "wrong password -> 401 with a readable message",
  wrongPassword.status === 401 && /incorrect email or password/i.test(wrongBody?.error ?? ""),
  JSON.stringify(wrongBody)
);
assert(
  "wrong password sets no session cookie",
  (wrongPassword.headers.getSetCookie?.() ?? []).length === 0
);

const unknownEmail = await visit("/api/auth/signin", {
  method: "POST",
  body: { email: "unknown@nexus.test", password: "supersecret" },
});
const unknownBody = await unknownEmail.json().catch(() => null);
assert(
  "unknown email -> 401 with a readable message",
  unknownEmail.status === 401 && /incorrect email or password/i.test(unknownBody?.error ?? ""),
  JSON.stringify(unknownBody)
);

const unconfirmed = await visit("/api/auth/signin", {
  method: "POST",
  body: { email: "unconfirmed@nexus.test", password: "supersecret" },
});
const unconfirmedBody = await unconfirmed.json().catch(() => null);
assert(
  "unconfirmed email -> actionable message",
  unconfirmed.status === 401 && /not confirmed/i.test(unconfirmedBody?.error ?? ""),
  JSON.stringify(unconfirmedBody)
);

const invalidInput = await visit("/api/auth/signin", {
  method: "POST",
  body: { email: "nope", password: "x" },
});
assert("invalid login input -> 400", invalidInput.status === 400);

const jar = createJar();
const login = await visit("/api/auth/signin", {
  jar,
  method: "POST",
  body: { email: "owner@nexus.test", password: "supersecret" },
});
const loginBody = await login.json().catch(() => null);
assert("login succeeds", login.status === 200 && loginBody?.ok === true, JSON.stringify(loginBody));
assert("login writes auth cookies", jar.size() > 0, JSON.stringify(jar.names()));
assert(
  "an onboarded user lands on /dashboard",
  loginBody?.redirectTo === "/dashboard",
  JSON.stringify(loginBody)
);

// ============ 5. AUTHENTICATED NAVIGATION ============
console.log("\n-- authenticated navigation ---------------------------");

const root = await visit("/", { jar });
assert(
  "/ redirects to /dashboard once signed in",
  root.status === 307 && (root.headers.get("location") ?? "").endsWith("/dashboard"),
  `status=${root.status} location=${root.headers.get("location")}`
);

const dashboard = await visit("/dashboard", { jar });
const dashboardHtml = await dashboard.text();
assert("/dashboard returns 200", dashboard.status === 200, `status=${dashboard.status}`);
assert(
  "/dashboard renders the workspace shell",
  dashboardHtml.includes("Workspace navigation") &&
    dashboardHtml.includes("Overview") &&
    !dashboardHtml.includes("Welcome back"),
  "shell markup missing"
);

for (const path of PRODUCT_ROUTES) {
  const response = await visit(path, { jar });
  assert(`${path} returns 200`, response.status === 200, `status=${response.status}`);
}

const loginWhileAuthenticated = await visit("/login", { jar });
assert(
  "/login redirects away when already signed in",
  loginWhileAuthenticated.status === 307,
  `status=${loginWhileAuthenticated.status}`
);

// ============ 6. SESSION PERSISTENCE + REFRESH ============
console.log("\n-- session persistence --------------------------------");

const reload = await visit("/dashboard", { jar });
assert("session survives a reload", reload.status === 200, `status=${reload.status}`);

// Simulate an expired access token: the proxy must silently refresh it.
const authCookieName = jar.names().find((name) => name.includes("auth-token"));
if (authCookieName) {
  const raw = jar.get(authCookieName);
  const decoded = decodeURIComponent(raw);
  const jsonPart = decoded.startsWith("base64-")
    ? Buffer.from(decoded.slice(7), "base64").toString("utf8")
    : decoded;

  try {
    const session = JSON.parse(jsonPart);
    session.access_token = makeAccessToken(undefined, -60);
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    const rebuilt = decoded.startsWith("base64-")
      ? `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`
      : JSON.stringify(session);
    jar.set(authCookieName, encodeURIComponent(rebuilt));

    const refreshed = await visit("/dashboard", { jar });
    assert(
      "an expired access token is refreshed server-side",
      refreshed.status === 200,
      `status=${refreshed.status}`
    );
  } catch (cause) {
    assert("an expired access token is refreshed server-side", false, String(cause));
  }
} else {
  assert("an expired access token is refreshed server-side", false, "auth cookie not found");
}

// ============ 7. API CONTRACT ============
console.log("\n-- API contract ---------------------------------------");

const upgradeAnonymous = await visit("/api/billing/upgrade", {
  method: "POST",
  body: { targetPlan: "PRO" },
});
assert(
  "/api/billing/upgrade -> 401 JSON for anonymous callers",
  upgradeAnonymous.status === 401 &&
    (upgradeAnonymous.headers.get("content-type") ?? "").includes("application/json"),
  `status=${upgradeAnonymous.status}`
);

const upgradeBadPlan = await visit("/api/billing/upgrade", {
  jar,
  method: "POST",
  body: { targetPlan: "FREE" },
});
assert("/api/billing/upgrade rejects FREE (400)", upgradeBadPlan.status === 400);

const forgotInvalid = await visit("/api/auth/forgot-password", {
  method: "POST",
  body: { email: "not-an-email" },
});
assert("forgot-password validates its input (400)", forgotInvalid.status === 400);

const forgot = await visit("/api/auth/forgot-password", {
  method: "POST",
  body: { email: "owner@nexus.test" },
});
const forgotBody = await forgot.json().catch(() => null);
assert(
  "forgot-password accepts a valid email",
  forgot.status === 200 && forgotBody?.ok === true,
  JSON.stringify(forgotBody)
);

const updateAnonymous = await visit("/api/auth/update-password", {
  method: "POST",
  body: { password: "newsecret" },
});
assert(
  "update-password -> 401 without a recovery session",
  updateAnonymous.status === 401,
  `status=${updateAnonymous.status}`
);

// ============ 7b. RESEND CONFIRMATION ===========
console.log("-- resend confirmation -------------------------------");

const resendInvalid = await visit("/api/auth/resend-confirmation", {
  method: "POST",
  body: { email: "not-an-email" },
});
assert("resend-confirmation validates its input (400)", resendInvalid.status === 400);

const resend = await visit("/api/auth/resend-confirmation", {
  method: "POST",
  body: { email: "confirm-me@nexus.test" },
});
const resendBody = await resend.json().catch(() => null);
assert(
  "resend-confirmation accepts a valid email",
  resend.status === 200 && resendBody?.ok === true,
  JSON.stringify(resendBody)
);
assert(
  "resend-confirmation never confirms the address exists",
  typeof resendBody?.message === "string" && !/confirmed/i.test(resendBody.message),
  JSON.stringify(resendBody)
);

// ============ 8. LOGOUT ============
console.log("\n-- logout ---------------------------------------------");

const signOut = await visit("/api/auth/signout", { jar, method: "POST" });
assert("/api/auth/signout succeeds", signOut.status === 200, `status=${signOut.status}`);

const afterSignOut = await visit("/dashboard", { jar });
assert(
  "after logout /dashboard redirects to /login",
  afterSignOut.status === 307 &&
    (afterSignOut.headers.get("location") ?? "").endsWith("/login"),
  `status=${afterSignOut.status} location=${afterSignOut.headers.get("location")}`
);

const tasksAfterSignOut = await visit("/tasks", { jar });
assert(
  "after logout /tasks redirects to /login",
  tasksAfterSignOut.status === 307,
  `status=${tasksAfterSignOut.status}`
);

await stub.close();

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
console.log(`(stub received ${stub.calls.length} Supabase calls, incl. ${
  stub.calls.filter((c) => c.includes("/auth/v1/")).length
} auth calls)`);

process.exit(failed === 0 ? 0 : 1);
