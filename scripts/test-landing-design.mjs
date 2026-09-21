#!/usr/bin/env node
/**
 * NEXUS — LANDING DESIGN & ACCESSIBILITY STRUCTURAL TESTS
 * =======================================================
 * Static verification of the senior design audit invariants, in the same
 * style as the rest of the suite (no browser stack: these are the
 * source-level guarantees a visual/device pass relies on).
 *
 * Covered:
 *   1. contrast      — every text token clears WCAG AA (4.5:1) on every
 *                      real surface, and the palette keeps its hierarchy
 *   2. typography    — the public type ladder has real intermediate steps
 *   3. depth         — sections are framed, not floating on uniform black
 *   4. honesty       — pricing entitlements come from plan-limits.ts, and
 *                      no landing copy invents a capability
 *   5. severity      — severity is never carried by colour alone
 *   6. motion        — every new landing animation is gated by
 *                      prefers-reduced-motion and has a no-JS fallback
 *   7. mobile        — 44px targets, horizontal diagrams become vertical
 *                      flows, no fixed widths that can overflow
 *   8. performance   — no heavy animation/WebGL library was added
 *
 * Run:  node scripts/test-landing-design.mjs   (or  npm run test:landing)
 * Exit: 0 = all invariants hold, 1 = at least one check failed.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const src = (rel) => join(ROOT, "src", rel);
const read = (rel) => readFileSync(src(rel), "utf8");
const readRoot = (rel) => readFileSync(join(ROOT, rel), "utf8");

let failures = 0;
let passes = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passes += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✘ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ------------------------------------------------------------------
// WCAG contrast maths
// ------------------------------------------------------------------
function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  const value = hex.trim().replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}

function contrast(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

// ------------------------------------------------------------------
console.log("\nNEXUS landing design — structural invariants\n");
console.log("Contrast (WCAG AA — 4.5:1 on every real surface)");
// ------------------------------------------------------------------
const globals = read("app/globals.css");

function themeColor(token) {
  const match = globals.match(
    new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`)
  );
  return match ? match[1] : null;
}

// Every surface text is actually painted on, darkest to lightest.
const SURFACES = ["#000000", "#0f0f0f", "#151515", "#1c1c1c"];
const TEXT_TOKENS = [
  "text-primary",
  "text-secondary",
  "text-tertiary",
  "text-quaternary",
];

const ramp = {};
for (const token of TEXT_TOKENS) {
  const value = themeColor(token);
  check(`globals.css: --color-${token} is defined`, Boolean(value));
  if (!value) continue;
  ramp[token] = value;

  const worst = Math.min(...SURFACES.map((s) => contrast(value, s)));
  check(
    `--color-${token} (${value}) clears AA on all surfaces`,
    worst >= 4.5,
    `worst ratio ${worst.toFixed(2)}:1 (needs 4.5:1)`
  );
}

check(
  "the text ramp keeps four distinct, descending steps",
  ramp["text-primary"] &&
    luminance(ramp["text-primary"]) > luminance(ramp["text-secondary"]) &&
    luminance(ramp["text-secondary"]) > luminance(ramp["text-tertiary"]) &&
    luminance(ramp["text-tertiary"]) > luminance(ramp["text-quaternary"]),
  "primary > secondary > tertiary > quaternary"
);

check(
  "focus ring reaches 3:1 non-text contrast",
  (() => {
    // rgba(233,228,255,0.6) composited on #000000
    const alpha = 0.6;
    const [r, g, b] = [233, 228, 255];
    const over = [0, 0, 0];
    const comp = [r, g, b].map((c, i) => Math.round(c * alpha + over[i] * (1 - alpha)));
    const hex = `#${comp.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    return contrast(hex, "#1c1c1c") >= 3;
  })(),
  "the lavender focus ring must be visible on the lightest surface"
);

// Low-opacity text is the failure mode the audit called out.
const LANDING_FILES = [
  "components/landing/hero.tsx",
  "components/landing/value-band.tsx",
  "components/landing/model-section.tsx",
  "components/landing/intelligence-section.tsx",
  "components/landing/how-it-works.tsx",
  "components/landing/features.tsx",
  "components/landing/trust.tsx",
  "components/landing/pricing.tsx",
  "components/landing/faq.tsx",
  "components/landing/final-cta.tsx",
  "components/landing/footer.tsx",
  "components/landing/product-preview.tsx",
];

for (const file of LANDING_FILES) {
  const text = read(file);
  const dimmed = text.match(/text-(?:white|text-primary|text-secondary)\/([0-9]{1,2})\b/g);
  check(
    `${file}: no low-opacity text (opacity is not a hierarchy tool)`,
    !dimmed,
    dimmed ? `found ${dimmed.join(", ")}` : ""
  );
}

// ------------------------------------------------------------------
console.log("Typography — intermediate steps exist");
// ------------------------------------------------------------------
for (const token of [
  "--text-eyebrow",
  "--text-h4",
  "--text-lead",
  "--text-xl",
  "--text-display-lg",
  "--text-display-xl",
]) {
  check(`globals.css: ${token} is defined`, globals.includes(`${token}:`));
}

const heading = read("components/landing/section-heading.tsx");
check(
  "section-heading: eyebrow / h2 / lead are three separate steps",
  heading.includes("nexus-eyebrow-pill") &&
    heading.includes("<h2") &&
    heading.includes("nexus-lead")
);

// ------------------------------------------------------------------
console.log("Depth — sections are framed, not floating");
// ------------------------------------------------------------------
for (const cls of ["nexus-band", "nexus-panel", "nexus-rule", "nexus-panel-quiet"]) {
  check(`globals.css: .${cls} exists`, globals.includes(`.${cls}`));
}
for (const file of ["components/landing/trust.tsx", "components/landing/pricing.tsx"]) {
  check(`${file}: framed with .nexus-band`, read(file).includes("nexus-band"));
}

// ------------------------------------------------------------------
console.log("Severity is never colour alone");
// ------------------------------------------------------------------
const intel = read("components/landing/intelligence-section.tsx");
const signalCount = (intel.match(/data-severity=/g) || []).length;
const badgeCount = (intel.match(/<Badge tone=/g) || []).length;
check(
  "intelligence-section: every signal card carries a text severity badge",
  signalCount > 0 && badgeCount >= signalCount,
  `${signalCount} signal cards / ${badgeCount} badges`
);
check(
  "globals.css: signal severity lives in a custom property, not in `color`",
  /\.nexus-signal\s*\{[^}]*--signal-color/.test(globals)
);

// ------------------------------------------------------------------
console.log("Honesty — marketing never invents a capability");
// ------------------------------------------------------------------
const pricing = read("components/landing/pricing.tsx");
check(
  "pricing: entitlements are imported from src/lib/plan-limits.ts",
  pricing.includes('from "@/lib/plan-limits"') &&
    pricing.includes("PLAN_LIMITS") &&
    pricing.includes("PLAN_FEATURES")
);
check(
  "pricing: no hand-written limit numbers",
  !/\b\d+\s+workspaces?\b/.test(pricing),
  "limits must be derived from PLAN_LIMITS"
);
for (const phrase of ["AI agents", "Workflow orchestration", "Team intelligence"]) {
  check(`pricing: does not claim “${phrase}”`, !pricing.includes(phrase));
}
check(
  "pricing: each plan answers who / what / why",
  pricing.includes("Who it is for") &&
    pricing.includes("What you get") &&
    pricing.includes("Why upgrade")
);

const trust = read("components/landing/trust.tsx");
for (const phrase of ["SOC 2", "GDPR compliant", "ISO 27001", "99.9%"]) {
  check(`trust: does not claim “${phrase}”`, !trust.includes(phrase));
}

// ------------------------------------------------------------------
console.log("Motion — gated and never required for content");
// ------------------------------------------------------------------
const auditBlock = globals.slice(globals.indexOf("LANDING — DESIGN AUDIT SYSTEM"));
for (const cls of [
  "nexus-chain-rail",
  "nexus-chain-marker",
  "nexus-chain-step",
  "nexus-cascade-link",
  "nexus-cascade-step",
  "nexus-faq-answer",
]) {
  const reduced = auditBlock.indexOf("prefers-reduced-motion: reduce");
  check(
    `globals.css: .${cls} is disabled under prefers-reduced-motion`,
    reduced > -1 &&
      auditBlock.slice(reduced).includes(`.${cls}`),
    "the class must appear in the reduced-motion block"
  );
}
check(
  "globals.css: a @media (scripting: none) fallback reveals chained content",
  auditBlock.includes("scripting: none")
);
check(
  "landing-reveal: still uses IntersectionObserver (no scroll listeners)",
  read("components/landing/landing-reveal.tsx").includes("IntersectionObserver")
);

// ------------------------------------------------------------------
console.log("Mobile — 44px targets, vertical flows, no overflow");
// ------------------------------------------------------------------
const hero = read("components/landing/hero.tsx");
check(
  "hero: primary and secondary CTA are size lg (44px on phones)",
  (hero.match(/size="lg"/g) || []).length >= 2
);
check(
  "hero: CTAs stack full-width on phones",
  /flex-col items-stretch/.test(hero) && /sm:flex-row/.test(hero)
);
check(
  "hero: states the proposition before anything else",
  hero.indexOf("NEXUS reads the work.") < hero.indexOf("Free to start")
);

const chain = read("components/landing/how-it-works.tsx");
check(
  "four moves: the rail only exists where the chain is horizontal",
  chain.includes("nexus-chain-rail hidden lg:block")
);
check(
  "four moves: a vertical connector replaces the rail below lg",
  chain.includes("lg:hidden") && chain.includes("w-px")
);

const trustMobile = read("components/landing/trust.tsx");
check(
  "trust: the constellation becomes a vertical rail on small screens",
  trustMobile.includes("hidden lg:block") && trustMobile.includes("lg:hidden")
);

console.log("Accessibility — navigation, focus, targets");
// ------------------------------------------------------------------
const nav = read("components/landing/landing-nav.tsx");
check(
  "landing-nav: a skip link jumps to #main",
  nav.includes('href="#main"') && nav.includes("focus:not-sr-only")
);
for (const page of [
  "app/page.tsx",
  "app/pricing/page.tsx",
  "app/how-it-works/page.tsx",
  "app/intelligence/page.tsx",
]) {
  check(`${page}: <main> carries id="main"`, read(page).includes('id="main"'));
}
check(
  "landing-nav: the mobile menu trigger is a 44px target on phones",
  /h-11 w-11/.test(nav) && /sm:h-9 sm:w-9/.test(nav)
);
check(
  "landing-nav: mobile menu links are 48px rows",
  nav.includes("h-12 items-center")
);
check(
  "faq: uses native <details>/<summary> (keyboard + no-JS safe)",
  read("components/landing/faq.tsx").includes("<details") &&
    read("components/landing/faq.tsx").includes("<summary")
);
check(
  "hero: the decorative flow strip is a labelled list, not loose text",
  hero.includes('aria-label="How NEXUS works"')
);

const pricingMobile = read("components/landing/pricing.tsx");
// Four plan columns need tablet-landscape width, not the 640px `sm`
// stop — between 640 and 833 the table was ~148px per column, so the
// switch moved to `tablet` (834px) and stacked blocks now cover every
// phone *and* tablet-portrait width.
check(
  "pricing: the comparison table is replaced by stacked blocks below tablet",
  pricingMobile.includes(
    "hidden overflow-hidden rounded-card border border-border-subtle tablet:block"
  ) && pricingMobile.includes("tablet:hidden")
);
check(
  "pricing: the table has a caption and scoped headers",
  pricingMobile.includes("<caption") && pricingMobile.includes('scope="col"')
);

for (const file of LANDING_FILES) {
  const text = read(file);
  // `max-w-[…]` and `min-w-[…]` are safe; a bare fixed width is not.
  const fixed = [
    ...text.matchAll(/(?<![-\w])w-\[([5-9][0-9]{2}|[1-9][0-9]{3,})px\]/g),
  ].map((m) => m[0]);
  check(
    `${file}: no bare fixed width that can overflow a small viewport`,
    fixed.length === 0,
    fixed.length ? `found ${fixed.join(", ")}` : ""
  );
}

// ------------------------------------------------------------------
console.log("Performance — no heavy dependency was added");
// ------------------------------------------------------------------
const pkg = JSON.parse(readRoot("package.json"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
for (const banned of ["gsap", "lottie-react", "aos", "animejs", "motion"]) {
  check(`package.json: ${banned} was not added`, !deps[banned]);
}
// framer-motion is allowed for the 21st.dev sign-in flow at /login, but it
// must never leak into the public landing pages.
check(
  "landing: no framer-motion import in landing components",
  !readdirSync(src("components/landing")).some((file) =>
    read(`components/landing/${file}`).includes("framer-motion")
  )
);
// The sign-in canvas used to live in components/ui/sign-in-flow-1.tsx; the
// auth shell was consolidated and it now lazy-loads from the shared auth
// layout (components/auth/auth-layout.tsx). The invariant is unchanged:
// the canvas must never render on the server.
check(
  "login: the sign-in canvas stays lazy-loaded (ssr: false)",
  read("components/auth/auth-layout.tsx").includes("ssr: false")
);
check(
  "landing: the hero field is still lazy-loaded (ssr: false)",
  read("components/landing/hero-field.tsx").includes("ssr: false")
);
check(
  "landing: no <video> or autoplaying media on the public page",
  !read("app/page.tsx").includes("<video")
);

// ------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed\n`);
if (failures > 0) process.exit(1);
