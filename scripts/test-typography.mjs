#!/usr/bin/env node
/**
 * NEXUS — TYPOGRAPHY FOUNDATION STRUCTURAL TESTS
 * =============================================
 * Locks the PR1 design-system decisions: Instrument Sans as the single UI
 * voice (self-hosted, no CDN), Geist Mono reserved for technical data,
 * one documented type scale, labels/eyebrows in sans.
 *
 * Run:  node scripts/test-typography.mjs   (or  npm run test:type)
 * Exit: 0 = all invariants hold, 1 = at least one check failed.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const src = (rel) => join(ROOT, "src", rel);
const read = (rel) => readFileSync(src(rel), "utf8");

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

console.log("\nNEXUS typography foundation — structural invariants\n");

// ------------------------------------------------------------------
console.log("Single UI voice: Instrument Sans, self-hosted");
// ------------------------------------------------------------------
const layout = read("app/layout.tsx");

check(
  "layout: Instrument Sans loaded via next/font/local",
  layout.includes("InstrumentSans-Variable.woff2") &&
    layout.includes('from "next/font/local"')
);

check(
  "layout: no Inter variable referenced anymore",
  !layout.includes("Inter-Variable") && !layout.includes("--font-inter")
);

check(
  "fonts: Instrument Sans variable file vendored",
  existsSync(src("fonts/InstrumentSans-Variable.woff2"))
);

check(
  "fonts: Inter variable file removed",
  !existsSync(src("fonts/Inter-Variable.woff2"))
);

const css = read("app/globals.css");

check(
  "--font-sans resolves to Instrument Sans",
  css.includes("--font-instrument") &&
    css.includes('"Instrument Sans"')
);

// ------------------------------------------------------------------
console.log("Mono reserved for technical data");
// ------------------------------------------------------------------
check(
  "--font-mono still resolves to Geist Mono",
  css.includes("--font-geist-mono") && css.includes('"Geist Mono"')
);

check(
  "eyebrow utility uses sans, not mono (labels are ordinary text)",
  /@utility eyebrow \{[^}]*font-family: var\(--font-sans\)/s.test(css)
);

check(
  "nexus-eyebrow classes use sans, not mono",
  !/\.nexus-eyebrow(-pill)? \{[^}]*font-family: var\(--font-mono\)/s.test(css)
);

// ------------------------------------------------------------------
console.log("One documented scale");
// ------------------------------------------------------------------
for (const token of [
  "--text-display:",
  "--text-h1:",
  "--text-h2:",
  "--text-h3:",
  "--text-h4:",
  "--text-body:",
  "--text-small:",
  "--text-caption:",
  "--text-button:",
  "--text-mono:",
  "--text-eyebrow:",
]) {
  check(`scale token present: ${token}`, css.includes(token));
}

console.log(`\n${passes} passed, ${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
