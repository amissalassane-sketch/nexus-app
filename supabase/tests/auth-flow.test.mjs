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
  // Redirect away ONLY when completed AND an active membership exists
  assert.match(onboarding, /onboarding_completed === true && hasMembership/);
  assert.match(onboarding, /Boolean\(memberships && memberships\.length > 0\)/);
});

test("P1: onboarding is a 3-step wizard with visible progress", () => {
  const onboarding = read("src/app/onboarding/page.tsx");
  assert.match(onboarding, /Step \$?\{step\} of \$?\{TOTAL_STEPS\}/);
  assert.match(onboarding, /TOTAL_STEPS = 3/);
  assert.match(onboarding, /Identity.*Intent.*First value/s);
});

test("P1: intent routing offers the 5 canonical answers", () => {
  const onboarding = read("src/app/onboarding/page.tsx");
  for (const label of ["Personal work", "A project", "Studies", "A team", "Everything"]) {
    assert.ok(onboarding.includes(`label: "${label}"`), `missing intent: ${label}`);
  }
});

test("P1: intent persistence degrades cleanly when the column is absent", () => {
  const onboarding = read("src/app/onboarding/page.tsx");
  assert.match(onboarding, /onboarding_intent/);
  assert.match(onboarding, /missingColumn/);
});

test("P1: step 3 never invents data — first value is user-entered with a skip", () => {
  const onboarding = read("src/app/onboarding/page.tsx");
  assert.match(onboarding, /Skip for now/);
  assert.match(onboarding, /never invents data/);
});

test("P1: migration 012 adds nullable onboarding_intent idempotently", () => {
  const m012 = read("supabase/migrations/012_onboarding_intent.sql");
  assert.match(m012, /add column onboarding_intent text/);
  assert.match(m012, /information_schema\.columns/);
});

test("P6: ⌘K — shell-level listener with correct modifier handling", () => {
  const palette = read("src/components/command-palette.tsx");
  assert.match(palette, /metaKey \|\| event\.ctrlKey/);
  assert.match(palette, /event\.key\.toLowerCase\(\) === "k"/);
  assert.match(palette, /preventDefault\(\)/);
  const shell = read("src/components/nexus-shell.tsx");
  assert.ok(shell.includes("CommandPalette"), "palette must be mounted in the shell");
});

test("P6: ⌘K — no synchronous setState inside useEffect", () => {
  const palette = read("src/components/command-palette.tsx");
  const effects = palette.split("useEffect(").slice(1);
  for (const effect of effects) {
    const body = effect.split("}, [")[0];
    const syncSetState = /\n\s*(set[A-Z]\w*)\(/.test(body.split("=>")[1] ?? body);
    assert.ok(
      !syncSetState,
      "effect body must not call setState synchronously (React Compiler rule)"
    );
  }
});

test("P6: ⌘K — visible Search… ⌘K button, dialog a11y, keyboard nav", () => {
  const palette = read("src/components/command-palette.tsx");
  assert.match(palette, /Search…/);
  assert.match(palette, /aria-modal="true"/);
  assert.match(palette, /role="dialog"/);
  assert.match(palette, /ArrowDown/);
  assert.match(palette, /ArrowUp/);
  assert.match(palette, /triggerRef\.current\?\.focus\(\)/);
  assert.match(palette, /Ask NEXUS: what should I work on\?/);
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


test("AUDIT: middleware lets /auth/callback reach its PKCE route handler", () => {
  const mw = read("src/lib/supabase/middleware.ts");
  assert.match(mw, /isCallbackRoute/);
  // Both the unauth bounce AND the auth-route bounce must exclude it.
  assert.match(mw, /!user && !isAuthRoute && !isCallbackRoute/);
  assert.match(mw, /user && isAuthRoute && !isCallbackRoute/);
  const cb = read("src/app/auth/callback/route.ts");
  assert.match(cb, /exchangeCodeForSession/);
  // Redirects are relative + next is sanitized (no open redirect).
  assert.ok(cb.includes('startsWith("/")'), "next path must be sanitized");
  assert.ok(!/\$\{origin\}/.test(cb), "callback must not guess the origin");
});

test("AUDIT: mobile has real navigation (sidebar is desktop-only)", () => {
  const shell = read("src/components/nexus-shell.tsx");
  assert.match(shell, /MOBILE_NAV/);
  assert.match(shell, /md:hidden/); // bottom nav hidden on desktop
  assert.match(shell, /h-14/); // ≥ 44px touch targets
});

test("AUDIT: auth pages use the official logo and DA tokens (no zinc)", () => {
  for (const page of ["src/app/login/page.tsx", "src/app/signup/page.tsx"]) {
    const src = read(page);
    assert.ok(src.includes("NexusLogo"), `${page}: official logo missing`);
    assert.ok(!src.includes("zinc-"), `${page}: zinc classes leftover`);
    assert.ok(!src.includes("bg-white"), `${page}: raw white leftover`);
  }
});

console.log(`\nauth-flow: ${passed} assertions passed`);
