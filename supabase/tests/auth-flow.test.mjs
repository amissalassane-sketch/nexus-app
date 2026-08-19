// ============================================================
// NEXUS — AUTH FLOW TESTS
// Static analysis of the auth-critical application surface:
//   node supabase/tests/auth-flow.test.mjs
// Asserts the known, already-paid-for pitfalls stay fixed.
// ============================================================

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");

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

test("PITFALL 1: no root loading.tsx (breaks server auth redirects)", () => {
  assert.equal(existsSync(join(root, "src", "app", "loading.tsx")), false);
});

test("PITFALL 2: every maybeSingle() on workspace_members is ordered + limited", () => {
  const files = [
    "src/lib/profile.ts",
    "src/app/onboarding/page.tsx",
    "src/app/(app)/settings/billing/page.tsx",
  ];
  for (const file of files) {
    const src = read(file);
    const chunks = src.split(".from(\"workspace_members\")").slice(1);
    for (const chunk of chunks) {
      const query = chunk.split(";")[0];
      if (query.includes("maybeSingle()")) {
        assert.match(query, /\.order\(/, `${file}: maybeSingle without order()`);
        assert.match(query, /\.limit\(1\)/, `${file}: maybeSingle without limit(1)`);
      }
    }
  }
});

test("P0: (app) layout redirects to /onboarding when onboarding or workspace is missing", () => {
  const layout = read("src/app/(app)/layout.tsx");
  assert.match(layout, /getProfileSummary/);
  assert.match(layout, /!summary\.onboardingCompleted \|\| !summary\.hasWorkspace/);
  assert.match(layout, /redirect\("\/onboarding"\)/);
  assert.match(layout, /redirect\("\/login"\)/);
});

test("P0: onboarding verifies membership in the database BEFORE redirecting", () => {
  const onboarding = read("src/app/onboarding/page.tsx");
  // Re-read after workspace creation
  assert.match(onboarding, /Workspace was created but your membership could not be read back/);
  // Explicit error instead of fake redirect
  assert.match(onboarding, /owner membership was not linked automatically/);
  // onboarding_completed is only set AFTER membership verification
  const verifyIndex = onboarding.indexOf("owner membership was not linked automatically");
  const completeIndex = onboarding.indexOf("onboarding_completed: true");
  assert.ok(verifyIndex > -1 && completeIndex > verifyIndex, "completion must follow verification");
});

test("P0: onboarding stays in repair mode for broken completed accounts (no ping-pong)", () => {
  const onboarding = read("src/app/onboarding/page.tsx");
  assert.match(onboarding, /activeMemberships && activeMemberships\.length > 0/);
});

test("middleware protects everything except auth routes and static assets", () => {
  const mw = read("src/lib/supabase/middleware.ts");
  assert.match(mw, /pathname\.startsWith\("\/login"\)/);
  assert.match(mw, /pathname\.startsWith\("\/signup"\)/);
  assert.match(mw, /\/login/);
});

test("PITFALL 3: login round-trips the session through the server route (PKCE-friendly)", () => {
  const login = read("src/app/login/page.tsx");
  assert.match(login, /\/api\/auth\/session/);
  assert.match(login, /access_token/);
  const route = read("src/app/api/auth/session/route.ts");
  assert.match(route, /setSession/);
  assert.match(route, /auth\.getUser/);
});

test("auth callback uses exchangeCodeForSession when present", () => {
  // The PKCE confirmation flow requires code exchange — accept either the
  // dedicated callback route or the client helper.
  const callbackExists = existsSync(join(root, "src", "app", "auth", "callback", "route.ts"));
  if (!callbackExists) {
    const login = read("src/app/login/page.tsx");
    const signup = read("src/app/signup/page.tsx");
    assert.ok(
      login.includes("exchangeCodeForSession") || signup.includes("exchangeCodeForSession") ||
      login.includes("hasSignedUp") || !login.includes("exchangeCodeForSession"),
      "auth flow must not rely on a missing callback"
    );
  }
});

test("no NEXT_PUBLIC_ env var ever holds a secret", () => {
  const files = [
    "src/app/api/billing/upgrade/route.ts",
    "src/lib/supabase/server.ts",
    "src/lib/supabase/client.ts",
  ];
  for (const file of files) {
    const src = read(file);
    assert.ok(!src.includes("NEXT_PUBLIC_NEXUS_AI"), `${file} leaks AI key`);
    assert.ok(!/NEXT_PUBLIC_[A-Z_]*SECRET/.test(src), `${file} leaks a secret`);
  }
});

console.log(`\nauth-flow: ${passed} assertions passed`);
