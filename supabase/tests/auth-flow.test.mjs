/**
 * ============================================================
 * NEXUS — AUTH END-TO-END TEST (ACCESS FIRST)
 * ============================================================
 * Exercises the real application (server auth routes, proxy, server
 * components, cookie plumbing) against a stubbed Supabase service.
 *
 * The canonical journey under test:
 *   signup/login/verify -> session -> workspace bootstrap -> /app
 *
 * Covers the scenarios that must never regress:
 *   signup   (session / confirmation / already registered / minimal)
 *   confirm  (new -> /app, complete -> /app, expired/invalid, recovery)
 *   login    (success -> /app, wrong password, unknown email, invalid)
 *   oauth    (new -> /app, incomplete profile -> /app, complete -> /app,
 *            error, cancellation, replay, refresh after callback,
 *            re-login after logout)
 *   first-value experience (brand-new workspace welcome state, optional
 *            profile prompt, profile skip keeps the dashboard open)
 *   profile completion (optional save via /api/profile, dashboard updates)
 *   session persistence + expired-token refresh
 *   route protection (no /onboarding gate: /app is canonical)
 *   logout
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key npm run dev -- --port 3000
 *   node supabase/tests/auth-flow.test.mjs
 * ============================================================
 */

import { makeAccessToken, startSupabaseStub } from "./supabase-stub.mjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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

/** Raw HTML is not user-visible text: React inserts `<!-- -->` comment
 *  placeholders between adjacent text/expression nodes (invisible in the
 *  browser), and inline markup splits strings across tags. Copy assertions
 *  match against the visible text instead, which is what the browser
 *  actually renders to the user. */
function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ");
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

// The OAuth return leg calls supabase.auth.exchangeCodeForSession, which in a
// real browser reads the PKCE `code_verifier` that `signInWithOAuth` stored in
// a cookie before redirecting to Google. This harness has no browser, so the
// OAuth success cases plant that cookie themselves. The name is derived from
// the project storage key (the same derivation the app uses), and the value
// must be a JSON-encoded string — auth-js JSON.parses storage on every read,
// so a bare string would be treated as absent.
const pkceVerifierCookie = `${createSupabaseClient(stub.url, "stub-key", {
  auth: { flowType: "pkce" },
}).auth.storageKey}-code-verifier`;
const pkceVerifierValue = JSON.stringify("nexus-test-verifier");

/** A cookie jar that carries only the PKCE verifier, so an OAuth callback can
 *  exchange its code the way a browser would after `signInWithOAuth`. */
function oauthCallbackJar() {
  const jar = createJar();
  jar.set(pkceVerifierCookie, pkceVerifierValue);
  return jar;
}

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

assert("anonymous /intelligence renders", (await visit("/intelligence")).status === 200);
assert("anonymous /how-it-works renders", (await visit("/how-it-works")).status === 200);
assert("anonymous /pricing renders", (await visit("/pricing")).status === 200);
const anonymousLoginHtmlCache = await (await visit("/login")).text();
const anonymousSignupHtmlCache = await (await visit("/signup")).text();
assert("anonymous /login renders", anonymousLoginHtmlCache.length > 0);
assert("anonymous /signup renders", anonymousSignupHtmlCache.length > 0);
assert("anonymous /forgot-password renders", (await visit("/forgot-password")).status === 200);
assert("anonymous /check-email renders", (await visit("/check-email")).status === 200);

// Browser-safe autocomplete semantics: signup must be treated as a new
// password context and login as a current-password context.
assert(
  "login uses semantic current-password autocomplete",
  anonymousLoginHtmlCache.includes('name="email"') &&
    /autoComplete="username"/i.test(anonymousLoginHtmlCache) &&
    anonymousLoginHtmlCache.includes('name="password"') &&
    /autoComplete="current-password"/i.test(anonymousLoginHtmlCache),
  "login form attributes missing"
);
assert(
  "signup uses semantic new-password autocomplete",
  anonymousSignupHtmlCache.includes('name="email"') &&
    /autoComplete="email"/i.test(anonymousSignupHtmlCache) &&
    anonymousSignupHtmlCache.includes('name="password"') &&
    /autoComplete="new-password"/i.test(anonymousSignupHtmlCache),
  "signup form attributes missing"
);

const confirmErrorPage = await visit("/auth/confirm-error?reason=expired");
const confirmErrorHtml = await confirmErrorPage.text();
assert(
  "confirmation error page renders a branded NEXUS state, not raw JSON",
  confirmErrorPage.status === 200 &&
    confirmErrorHtml.includes("Email verification") &&
    confirmErrorHtml.includes("This verification link has expired") &&
    confirmErrorHtml.includes("Return to sign in"),
  `status=${confirmErrorPage.status}`
);

function redirectTarget(response) {
  return new URL(response.headers.get("location") ?? "", APP_URL);
}

const callbackBare = await visit("/auth/callback");
assert(
  "confirmation link without a token goes to the NEXUS error page, not the landing page",
  callbackBare.status === 307 &&
    redirectTarget(callbackBare).pathname === "/auth/confirm-error" &&
    redirectTarget(callbackBare).href.includes("reason=missing"),
  `status=${callbackBare.status} location=${callbackBare.headers.get("location")}`
);

const callbackNewUserJar = oauthCallbackJar();
const callbackNewUser = await visit("/auth/callback?code=ok-code", {
  jar: callbackNewUserJar,
});
assert(
  "a valid email confirmation establishes a session and enters /app for a new user",
  callbackNewUser.status === 307 &&
    redirectTarget(callbackNewUser).pathname === "/app" &&
    callbackNewUserJar.names().some((name) => name.includes("auth-token")),
  `status=${callbackNewUser.status} location=${callbackNewUser.headers.get("location")} cookies=${JSON.stringify(callbackNewUserJar.names())}`
);

const callbackInvalid = await visit("/auth/callback?code=invalid");
assert(
  "an invalid confirmation token shows the NEXUS error state, never a raw response",
  callbackInvalid.status === 307 &&
    redirectTarget(callbackInvalid).pathname === "/auth/confirm-error" &&
    !redirectTarget(callbackInvalid).href.includes("/login"),
  `status=${callbackInvalid.status} location=${callbackInvalid.headers.get("location")}`
);

const callbackRecover = await visit("/auth/callback?code=recover-code&next=/reset-password", {
  jar: oauthCallbackJar(),
});
assert(
  "a valid recovery link opens the password reset screen",
  callbackRecover.status === 307 &&
    redirectTarget(callbackRecover).pathname === "/reset-password" &&
    !redirectTarget(callbackRecover).href.includes("onboarding"),
  `status=${callbackRecover.status} location=${callbackRecover.headers.get("location")}`
);

const callbackRecoverInvalid = await visit(
  "/auth/callback?code=invalid&next=/reset-password"
);
assert(
  "an invalid recovery link opens a readable reset error",
  callbackRecoverInvalid.status === 307 &&
    redirectTarget(callbackRecoverInvalid).pathname === "/forgot-password" &&
    (callbackRecoverInvalid.headers.get("location") ?? "").includes("error="),
  `status=${callbackRecoverInvalid.status} location=${callbackRecoverInvalid.headers.get("location")}`
);

// ---- /auth/confirm (new NEXUS-branded email template endpoint) ----
const confirmBare = await visit("/auth/confirm");
assert(
  "a confirmation link without a token shows the NEXUS error state",
  confirmBare.status === 307 &&
    redirectTarget(confirmBare).pathname === "/auth/confirm-error",
  `status=${confirmBare.status} location=${confirmBare.headers.get("location")}`
);

const confirmFreshJar = createJar();
const confirmFresh = await visit(
  "/auth/confirm?token_hash=confirm-fresh&type=email",
  { jar: confirmFreshJar }
);
assert(
  "token_hash confirmation for a new user enters /app and writes a session",
  confirmFresh.status === 307 &&
    redirectTarget(confirmFresh).pathname === "/app" &&
    confirmFreshJar.names().some((name) => name.includes("auth-token")),
  `status=${confirmFresh.status} location=${confirmFresh.headers.get("location")} cookies=${JSON.stringify(confirmFreshJar.names())}`
);

const confirmCompleteJar = createJar();
const confirmComplete = await visit(
  "/auth/confirm?token_hash=confirm-onboarded&type=email",
  { jar: confirmCompleteJar }
);
assert(
  "token_hash confirmation for a complete-profile user enters /app",
  confirmComplete.status === 307 &&
    redirectTarget(confirmComplete).pathname === "/app" &&
    confirmCompleteJar.names().some((name) => name.includes("auth-token")),
  `status=${confirmComplete.status} location=${confirmComplete.headers.get("location")} cookies=${JSON.stringify(confirmCompleteJar.names())}`
);

const confirmExpired = await visit("/auth/confirm?token_hash=expired&type=email");
assert(
  "an expired verification token shows the NEXUS expired state",
  confirmExpired.status === 307 &&
    redirectTarget(confirmExpired).pathname === "/auth/confirm-error" &&
    redirectTarget(confirmExpired).href.includes("reason=expired"),
  `status=${confirmExpired.status} location=${confirmExpired.headers.get("location")}`
);

const confirmInvalid = await visit("/auth/confirm?token_hash=invalid&type=email");
assert(
  "an invalid verification token shows the NEXUS invalid state",
  confirmInvalid.status === 307 &&
    redirectTarget(confirmInvalid).pathname === "/auth/confirm-error" &&
    redirectTarget(confirmInvalid).href.includes("reason=invalid"),
  `status=${confirmInvalid.status} location=${confirmInvalid.headers.get("location")}`
);

const confirmRecovery = await visit(
  "/auth/confirm?token_hash=confirm-recovery&type=recovery",
  { jar: createJar() }
);
assert(
  "a recovery token_hash opens the password reset screen",
  confirmRecovery.status === 307 &&
    redirectTarget(confirmRecovery).pathname === "/reset-password",
  `status=${confirmRecovery.status} location=${confirmRecovery.headers.get("location")}`
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
  "/api/health is public and reports safe configuration metadata",
  health.status === 200 &&
    healthBody?.ok === true &&
    healthBody?.service === "nexus" &&
    healthBody?.configuration?.supabaseConfigured === true &&
    typeof healthBody?.configuration?.supabaseHost === "string" &&
    !JSON.stringify(healthBody).includes("stub-key"),
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
  "signup with an immediate session enters /app (no onboarding step)",
  signupBody?.redirectTo === "/app",
  JSON.stringify(signupBody)
);
assert(
  "signup confirmation email points at /auth/confirm, never /onboarding",
  (stub.redirectTos ?? []).length > 0 &&
    (stub.redirectTos ?? []).every((value) => String(value).endsWith("/auth/confirm")) &&
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
    confirmBody?.redirectTo === "/check-email" &&
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

// ============ 3. FIRST-VALUE JOURNEY (NO ONBOARDING GATE) ============
console.log("\n-- first-value journey (access first) -----------------");

// The brand-new signed-up user has NO completed profile (no name, no
// username). The dashboard must still open: profile completeness is UI
// guidance, never a gate.
const freshDashboard = await visit("/dashboard", { jar: signupJar });
const freshDashboardHtml = await freshDashboard.text();
assert(
  "a brand-new user with an incomplete profile enters /dashboard (no gate)",
  freshDashboard.status === 200,
  `status=${freshDashboard.status} location=${freshDashboard.headers.get("location")}`
);
assert(
  "the first dashboard visit shows the NEXUS welcome state",
  freshDashboardHtml.includes("Welcome to NEXUS.") &&
    freshDashboardHtml.includes("Your workspace is ready"),
  "welcome state copy missing"
);
assert(
  "the welcome state offers the first meaningful actions",
  freshDashboardHtml.includes("Create your first project") &&
    freshDashboardHtml.includes("Explore NEXUS Intelligence"),
  "welcome actions missing"
);
// Copy is asserted against the VISIBLE text: React inserts `<!-- -->`
// comment nodes between the greeting's text/expression boundaries and the
// prompt's summary, which raw-HTML matching would (incorrectly) treat as
// text. The browser renders none of that.
const freshDashboardText = visibleText(freshDashboardHtml);
assert(
  "the optional profile completion prompt is shown (non-blocking)",
  freshDashboardText.includes("Complete your profile") &&
    freshDashboardText.includes("Add your name and username"),
  "profile prompt copy missing"
);
assert(
  "a missing full name never renders an invented display name",
  /Good (morning|afternoon|evening|night)\./.test(freshDashboardText) &&
    !/Good (morning|afternoon|evening|night),\s*\S/.test(freshDashboardText),
  "unexpected name rendering"
);

// The legacy onboarding URL must no longer gate the product: authenticated
// visitors are simply sent into NEXUS.
const onboardingRedirect = await visit("/onboarding", { jar: signupJar });
assert(
  "authenticated /onboarding redirects into /app (wizard removed)",
  onboardingRedirect.status === 307 &&
    (onboardingRedirect.headers.get("location") ?? "").endsWith("/app"),
  `status=${onboardingRedirect.status} location=${onboardingRedirect.headers.get("location")}`
);

// The wizard's API route is gone: no 200, no raw error — a clean 404.
const stepOneGone = await visit("/api/onboarding/step-1", {
  jar: signupJar,
  method: "POST",
  body: { displayName: "Fresh Repaired", username: "fresh_repaired" },
});
assert(
  "the old /api/onboarding/step-1 route no longer exists",
  stepOneGone.status === 404,
  `status=${stepOneGone.status}`
);

// ============ 3b. PROFILE COMPLETION (OPTIONAL) ============
console.log("\n-- profile completion (optional) ----------------------");

const profileAnonymous = await visit("/api/profile", {
  method: "POST",
  body: { displayName: "Nobody", username: "nobody" },
});
assert(
  "profile save requires authentication (401)",
  profileAnonymous.status === 401,
  `status=${profileAnonymous.status}`
);

const profileInvalid = await visit("/api/profile", {
  jar: signupJar,
  method: "POST",
  body: { displayName: "Fresh Newcomer", username: "x" },
});
assert(
  "profile save rejects a malformed username (400, readable message)",
  profileInvalid.status === 400 && /3–32 characters/i.test(
    (await profileInvalid.json().catch(() => null))?.error ?? ""
  ),
  `status=${profileInvalid.status}`
);

// Profile save through the real server route: bootstrap RPC runs before any
// profile write (the production incident ordering), then the write lands.
const profileCallStart = stub.calls.length;
const profileSave = await visit("/api/profile", {
  jar: signupJar,
  method: "POST",
  body: { displayName: "Fresh Newcomer", username: "freshnewcomer" },
});
const profileSaveBody = await profileSave.json().catch(() => null);
const profileCalls = stub.calls.slice(profileCallStart);
const profileRpcIndex = profileCalls.findIndex((call) =>
  call.includes("/rest/v1/rpc/get_or_create_personal_workspace")
);
const profileFirstWriteIndex = profileCalls.findIndex((call) => {
  const method = call.split(" ")[0];
  return (method === "POST" || method === "PATCH" || method === "PUT") &&
    call.includes("/rest/v1/profiles");
});
assert(
  "profile save succeeds for the incomplete account",
  profileSave.status === 200 && profileSaveBody?.ok === true,
  JSON.stringify(profileSaveBody)
);
assert(
  "profile save ensures the workspace before persisting profile state",
  profileRpcIndex >= 0 && profileFirstWriteIndex > profileRpcIndex,
  JSON.stringify(profileCalls)
);

// The dashboard reflects the completed profile: the greeting now carries the
// real name and the completion prompt is gone.
const freshDashboardAfter = await visit("/dashboard", { jar: signupJar });
const freshDashboardAfterHtml = await freshDashboardAfter.text();
assert(
  "after profile save the dashboard greets the user by name",
  freshDashboardAfter.status === 200 && freshDashboardAfterHtml.includes("Fresh"),
  `status=${freshDashboardAfter.status}`
);
assert(
  "after profile save the completion prompt disappears",
  !freshDashboardAfterHtml.includes("Complete your profile"),
  "prompt still present after completion"
);

// Saving again remains idempotent (same row, no duplicate profile).
const profileRetry = await visit("/api/profile", {
  jar: signupJar,
  method: "POST",
  body: { displayName: "Fresh Newcomer", username: "freshnewcomer", bio: "New to NEXUS" },
});
assert(
  "repeating a profile save remains idempotent",
  profileRetry.status === 200 &&
    (await profileRetry.json().catch(() => null))?.ok === true,
  `status=${profileRetry.status}`
);

// ============ 4. LOGIN ============
console.log("\n-- login ----------------------------------------------");

const wrongPassword = await visit("/api/auth/signin", {
  method: "POST",
  body: { email: "owner@nexus.test", password: "wrong-password" },
});
const wrongBody = await wrongPassword.json().catch(() => null);
assert(
  "wrong password -> 401 with a readable message",
  wrongPassword.status === 401 && /email or password is incorrect/i.test(wrongBody?.error ?? ""),
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
  unknownEmail.status === 401 &&
    /email or password is incorrect/i.test(unknownBody?.error ?? ""),
  JSON.stringify(unknownBody)
);

const unconfirmed = await visit("/api/auth/signin", {
  method: "POST",
  body: { email: "unconfirmed@nexus.test", password: "supersecret" },
});
const unconfirmedBody = await unconfirmed.json().catch(() => null);
assert(
  "unconfirmed email -> actionable verification message",
  unconfirmed.status === 401 &&
    /verified/i.test(unconfirmedBody?.error ?? "") &&
    unconfirmedBody?.errorCode === "EMAIL_NOT_CONFIRMED",
  JSON.stringify(unconfirmedBody)
);

// Existing user with an INCOMPLETE profile (name present, username missing):
// login still lands on /app — the profile is completed from inside, later.
const incompleteLoginJar = createJar();
const incompleteLogin = await visit("/api/auth/signin", {
  jar: incompleteLoginJar,
  method: "POST",
  body: { email: "incomplete@nexus.test", password: "supersecret" },
});
const incompleteLoginBody = await incompleteLogin.json().catch(() => null);
assert(
  "existing user with an incomplete profile logs in and lands on /app",
  incompleteLogin.status === 200 &&
    incompleteLoginBody?.ok === true &&
    incompleteLoginBody?.redirectTo === "/app",
  JSON.stringify(incompleteLoginBody)
);
const incompleteDashboard = await visit("/dashboard", { jar: incompleteLoginJar });
const incompleteDashboardHtml = await incompleteDashboard.text();
assert(
  "the incomplete-profile user's dashboard stays fully accessible",
  incompleteDashboard.status === 200 &&
    incompleteDashboardHtml.includes("Halfway Hank"),
  `status=${incompleteDashboard.status}`
);
assert(
  "the incomplete-profile user still sees the profile prompt (missing username)",
  visibleText(incompleteDashboardHtml).includes("Complete your profile") &&
    visibleText(incompleteDashboardHtml).includes("Add your username"),
  "profile prompt missing for partial profile"
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
  "an onboarded user lands on /app",
  loginBody?.redirectTo === "/app",
  JSON.stringify(loginBody)
);

// ============ 5. AUTHENTICATED NAVIGATION ============
console.log("\n-- authenticated navigation ---------------------------");

const root = await visit("/", { jar });
assert(
  "the public homepage remains available once signed in",
  root.status === 200,
  `status=${root.status} location=${root.headers.get("location")}`
);
const authenticatedLogin = await visit("/login", { jar });
assert(
  "an authenticated Sign in route enters /app",
  authenticatedLogin.status === 307 &&
    (authenticatedLogin.headers.get("location") ?? "").endsWith("/app"),
  `status=${authenticatedLogin.status} location=${authenticatedLogin.headers.get("location")}`
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

// ============ 5b. OAUTH (CONTINUE WITH GOOGLE) ============
console.log("\n-- oauth (continue with google) -----------------------");
// The "Continue with Google" button reuses the same Supabase PKCE OAuth flow
// and the SAME /auth/callback route as email confirmation — it is not a second
// auth flow. These cases drive the callback's `source=oauth` branch for every
// account state, mirroring the scenarios that must never regress.

const loginPage = await visit("/login");
const loginPageHtml = await loginPage.text();
assert(
  "/login offers Continue with Google",
  loginPage.status === 200 && loginPageHtml.includes("Continue with Google"),
  "google button missing on /login"
);

const signupPage = await visit("/signup");
const signupPageHtml = await signupPage.text();
assert(
  "/signup offers Continue with Google",
  signupPage.status === 200 && signupPageHtml.includes("Continue with Google"),
  "google button missing on /signup"
);

// Google sign-up for a brand-new user -> /app. Google's identity metadata
// pre-fills the name via the signup trigger; the user is never asked again.
const oauthNew = await visit("/auth/callback?source=oauth&code=oauth-new", {
  jar: oauthCallbackJar(),
});
assert(
  "google sign-up for a new user enters /app",
  oauthNew.status === 307 &&
    redirectTarget(oauthNew).pathname === "/app" &&
    !redirectTarget(oauthNew).pathname.includes("login"),
  `status=${oauthNew.status} location=${oauthNew.headers.get("location")}`
);

// Google sign-in for a returning user with an incomplete profile -> /app.
const oauthIncomplete = await visit("/auth/callback?source=oauth&code=oauth-incomplete", {
  jar: oauthCallbackJar(),
});
assert(
  "google sign-in for an incomplete-profile user enters /app",
  oauthIncomplete.status === 307 &&
    redirectTarget(oauthIncomplete).pathname === "/app" &&
    !redirectTarget(oauthIncomplete).pathname.includes("login"),
  `status=${oauthIncomplete.status} location=${oauthIncomplete.headers.get("location")}`
);

// Google sign-in for a fully onboarded user -> /app (never /login, /signup).
const oauthOnboarded = await visit("/auth/callback?source=oauth&code=oauth-onboarded", {
  jar: oauthCallbackJar(),
});
assert(
  "google sign-in for an onboarded user opens the app",
  oauthOnboarded.status === 307 &&
    redirectTarget(oauthOnboarded).pathname === "/app",
  `status=${oauthOnboarded.status} location=${oauthOnboarded.headers.get("location")}`
);

// A failed exchange (provider rejected it) -> /login?error, as a clear NEXUS
// error state — never a raw server error.
const oauthError = await visit("/auth/callback?source=oauth&code=invalid");
assert(
  "a failed google exchange sends the visitor to /login with an error",
  oauthError.status === 307 &&
    redirectTarget(oauthError).pathname === "/login" &&
    (oauthError.headers.get("location") ?? "").includes("error=") &&
    (oauthError.headers.get("location") ?? "").includes("failed"),
  `status=${oauthError.status} location=${oauthError.headers.get("location")}`
);

// OAuth cancellation (user closed the Google consent screen; the provider
// reports it as error=access_denied) -> a DISTINCT "cancelled" message.
const oauthCancel = await visit(
  "/auth/callback?source=oauth&error=access_denied&error_description=Access%20denied"
);
assert(
  "a cancelled google sign-in shows a distinct cancelled error",
  oauthCancel.status === 307 &&
    redirectTarget(oauthCancel).pathname === "/login" &&
    (oauthCancel.headers.get("location") ?? "").toLowerCase().includes("cancelled"),
  `status=${oauthCancel.status} location=${oauthCancel.headers.get("location")}`
);

// Duplicate / replayed callback while ALREADY signed in: the single-use PKCE
// code can no longer be exchanged, but the visitor keeps their live session and
// is routed by their account state — an authenticated user never lands on /login.
const oauthReplay = await visit("/auth/callback?source=oauth&code=invalid", { jar });
assert(
  "a duplicate oauth callback with a live session routes by account state",
  oauthReplay.status === 307 &&
    redirectTarget(oauthReplay).pathname === "/app" &&
    !redirectTarget(oauthReplay).href.includes("/login"),
  `status=${oauthReplay.status} location=${oauthReplay.headers.get("location")}`
);

// Refresh after OAuth: the callback's 307 carries the new session cookies.
// A browser refresh (the next page load) must keep the user signed in, and
// an authenticated user must never be left on the login form.
const oauthSessionJar = oauthCallbackJar();
const oauthSession = await visit(
  "/auth/callback?source=oauth&code=oauth-onboarded",
  { jar: oauthSessionJar }
);
assert(
  "the successful google callback writes a session cookie",
  oauthSession.status === 307 &&
    oauthSessionJar.names().some((name) => name.includes("auth-token")),
  `status=${oauthSession.status} cookies=${JSON.stringify(oauthSessionJar.names())}`
);

const oauthRefresh = await visit("/dashboard", { jar: oauthSessionJar });
assert(
  "a refresh after google sign-in keeps the user signed in",
  oauthRefresh.status === 200,
  `status=${oauthRefresh.status}`
);

const oauthThenLogin = await visit("/login", { jar: oauthSessionJar });
assert(
  "an authenticated user is never left on /login after google sign-in",
  oauthThenLogin.status === 307 &&
    !redirectTarget(oauthThenLogin).pathname.endsWith("/login"),
  `status=${oauthThenLogin.status} location=${oauthThenLogin.headers.get("location")}`
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

const recoveryJar = createJar();
const recoveryConfirm = await visit(
  "/auth/confirm?token_hash=confirm-recovery&type=recovery",
  { jar: recoveryJar }
);
assert(
  "a recovery link opens /reset-password and writes a session",
  recoveryConfirm.status === 307 &&
    redirectTarget(recoveryConfirm).pathname === "/reset-password" &&
    recoveryJar.names().some((name) => name.includes("auth-token")),
  `status=${recoveryConfirm.status} cookies=${JSON.stringify(recoveryJar.names())}`
);

const updateWithSession = await visit("/api/auth/update-password", {
  jar: recoveryJar,
  method: "POST",
  body: { password: "newsecret" },
});
const updateSessionBody = await updateWithSession.json().catch(() => null);
assert(
  "password reset with a live recovery session succeeds and opens /app",
  updateWithSession.status === 200 &&
    updateSessionBody?.ok === true &&
    updateSessionBody?.redirectTo === "/app",
  JSON.stringify(updateSessionBody)
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

// Logout then Google sign-in again: the SAME single flow must work a second
// time — a fresh PKCE exchange, a fresh session, routing by account state.
const googleAgainJar = oauthCallbackJar();
const googleAgain = await visit(
  "/auth/callback?source=oauth&code=oauth-onboarded",
  { jar: googleAgainJar }
);
assert(
  "google sign-in after logout starts a fresh session and opens the app",
  googleAgain.status === 307 &&
    redirectTarget(googleAgain).pathname === "/app" &&
    googleAgainJar.names().some((name) => name.includes("auth-token")),
  `status=${googleAgain.status} location=${googleAgain.headers.get("location")} cookies=${JSON.stringify(googleAgainJar.names())}`
);

const googleAgainDashboard = await visit("/dashboard", { jar: googleAgainJar });
assert(
  "the dashboard is reachable after the second google sign-in",
  googleAgainDashboard.status === 200,
  `status=${googleAgainDashboard.status}`
);

await stub.close();

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
console.log(`(stub received ${stub.calls.length} Supabase calls, incl. ${
  stub.calls.filter((c) => c.includes("/auth/v1/")).length
} auth calls)`);

process.exit(failed === 0 ? 0 : 1);
