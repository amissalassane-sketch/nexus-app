#!/usr/bin/env node
/**
 * NEXUS — SLIDE LABEL CONTRACT (cross-product)
 * ============================================
 * The slide interaction is one CSS contract, one presentational component
 * and three Button variants. It is easy to get subtly wrong in ways no
 * screenshot would catch, and easy to spread to buttons where it stops
 * meaning anything. This file pins both.
 *
 *   SLIDE-01  implementation          one stylesheet contract, one
 *                                     component, no JS, no dependency
 *   SLIDE-02  motion                 200ms --ease-standard, transform
 *                                     only, no entrance animation, no
 *                                     bounce/elastic/scale token
 *   SLIDE-03  trigger                :hover AND :focus-visible on the
 *                                     owning group — a keyboard visitor
 *                                     gets the same reveal
 *   SLIDE-04  reduced motion         no travel, primary label readable
 *   SLIDE-05  accessibility          the incoming label is aria-hidden,
 *                                     so the accessible name never
 *                                     changes and is never read twice
 *   SLIDE-06  tokens                 the slide variants are the canonical
 *                                     recipes plus the group marker —
 *                                     colour, border, radius, focus and
 *                                     disabled states come from the
 *                                     existing variant, not from new CSS
 *   SLIDE-07  scope                  the adopters are exactly the
 *                                     allow-list: no accidental spread
 *                                     to forms, tables or dense actions
 *   SLIDE-08  cross-product          NEXUS Admin carries the same
 *                                     interaction through the same
 *                                     component, with no Admin-only copy
 *
 * Run:  node scripts/test-slide-text.mjs
 * Exit: 0 = all invariants hold, 1 = at least one check failed.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const info = statSync(full);
    if (info.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- SLIDE-01
console.log("\nSLIDE-01 — one interaction, one implementation");

const labelPath = "components/ui/slide-label.tsx";
const css = read("app/globals.css");
const label = existsSync(src(labelPath)) ? read(labelPath) : "";
check("the slide label component exists", !!label, labelPath);
check(
  "it is a server component — no client boundary, no state, no effect",
  !label.includes('"use client"') &&
    !label.includes("useState") &&
    !label.includes("useEffect")
);
check(
  "it depends on nothing but the class merger",
  /import \{ cn \} from "@\/lib\/cn"/.test(label) &&
    (label.match(/^import /gm) ?? []).length <= 2,
  "no motion library, no icon set, no design-system import"
);
check(
  "the stylesheet owns the motion — one transformed layer",
  css.includes(".slide-label-inner {") &&
    css.includes("transition: transform var(--duration-small) var(--ease-standard);")
);
check(
  "the clipped box is one line tall and as wide as the longer label",
  css.includes(".slide-label-inner > * {") &&
    css.includes("grid-area: 1 / 1;") &&
    /\.slide-label \{[^}]*overflow: hidden;/s.test(css)
);
check(
  "no JavaScript measures, clones or swaps the labels",
  !label.includes("cloneElement") && !label.includes("getBoundingClientRect")
);

// ---------------------------------------------------------------- SLIDE-02
console.log("\nSLIDE-02 — motion budget");

/** Everything from the SLIDE LABEL banner to the end of its reduced-motion
 *  block — the whole surface this contract owns. */
const slideSection = css.slice(css.indexOf("SLIDE LABEL"));
const slideSectionPre = slideSection.slice(0, slideSection.indexOf("@media"));

check(
  "the duration is on the motion scale, referenced by token",
  slideSectionPre.includes("transform var(--duration-small) var(--ease-standard)") ||
    (slideSectionPre.includes("var(--duration-small)") &&
      !/slide[\s\S]{0,2000}?transition[^;]*\d+ms/.test(slideSectionPre)),
  "no improvised millisecond value inside the interaction"
);
check(
  "the reveal uses the neutral ease-in-out curve",
  css.includes("--ease-standard: cubic-bezier(0.2, 0, 0, 1)")
);
check(
  "only transform moves — no opacity flash on the moving layer",
  !/\.slide-label-inner \{[^}]*opacity/s.test(css) &&
    !/\.slide-label \{ [^}]*animation/.test(css)
);
check(
  "no entrance animation is imported from the reference component",
  !label.includes("initial={{") && !label.includes("motion/react")
);
check(
  "no bounce / elastic / overshoot easing is used by the interaction",
  !/slide[\s\S]{0,3000}?ease-spring/.test(css) && !/slide[\s\S]{0,3000}?scale\(/.test(css)
);
check(
  "the button box never translates — only the inner label layer does",
  !/\.slide-label \{[^}]*translate/.test(css) &&
    /\.slide-label-hover \{\s*transform: translateY\(100%\);/.test(css)
);

// ---------------------------------------------------------------- SLIDE-03
console.log("\nSLIDE-03 — pointer and keyboard reach the same state");

check(
  "hover triggers the reveal through the owning group",
  css.includes(".group\\/slide:hover .slide-label-inner")
);
check(
  "keyboard focus triggers the same reveal",
  css.includes(".group\\/slide:focus-visible .slide-label-inner")
);
check(
  "the owner marker is a named group — an ancestor group cannot fire it",
  (read("components/ui/button.tsx").match(/"group\/slide border/g) ?? []).length === 3,
  "primary / ghost / intelligence recipes each declare one"
);
check(
  "the interaction is decoration, not function — nothing depends on hover",
  !label.includes("onMouseEnter") && !label.includes("onFocus")
);

// ---------------------------------------------------------------- SLIDE-04
console.log("\nSLIDE-04 — reduced motion");

const reducedBlock =
  /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/.exec(slideSection)?.[0] ?? "";
check(
  "reduced motion cancels the travel",
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.slide-label-inner,[\s\S]*?transform: none;/.test(
    reducedBlock
  )
);
check(
  "reduced motion keeps the primary label alone (no duplicate text)",
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.slide-label-hover \{\s*display: none;/.test(
    reducedBlock
  )
);
check(
  "hover and focus states themselves are untouched by reduced motion",
  !reducedBlock.includes("hover:bg-") && !reducedBlock.includes(":focus-visible { outline")
);

// ---------------------------------------------------------------- SLIDE-05
console.log("\nSLIDE-05 — accessibility");

check(
  "the incoming label is hidden from assistive technology",
  label.includes('className="slide-label-hover" aria-hidden="true"')
);
check(
  "the visible resting label is not aria-hidden (it is the name)",
  !/className="" aria-hidden="true">\s*\{text\}/.test(label) &&
    label.includes("<span>{text}</span>")
);
check(
  "the wrapper does not fake a button role",
  !label.includes('role="button"') && !label.includes("tabIndex")
);
check(
  "labels cannot wrap mid-reveal (nowrap is enforced by the primitive)",
  label.includes("slide-label whitespace-nowrap")
);

// ---------------------------------------------------------------- SLIDE-06
console.log("\nSLIDE-06 — the variants inherit the canonical recipes");

const button = read("components/ui/button.tsx");
const recipe = (name) => {
  const m = new RegExp(`\\n  "?${name}"?:\\s*\\n?\\s*"([^"]+)"`).exec(button);
  return m ? m[1] : "";
};
const slide = recipe("slide");
const slideGhost = recipe("slide-ghost");
const slideIntelligence = recipe("slide-intelligence");
check(
  'variant="slide" is the primary recipe plus group',
  slide.replace("group/slide ", "") === recipe("primary"),
  slide
);
check(
  'variant="slide-ghost" is the ghost recipe plus group',
  slideGhost.replace("group/slide ", "") === recipe("ghost"),
  slideGhost
);
check(
  'variant="slide-intelligence" is the intelligence recipe plus group',
  slideIntelligence.replace("group/slide ", "") === recipe("intelligence"),
  slideIntelligence
);
check(
  "no new colour, radius, shadow or focus rule was added for the slide",
  !/slide[\s\S]{0,200}?rounded-(?!control)/.test(css) &&
    !read("components/ui/button.tsx").includes("shadow-")
);
check(
  "the slide variants are declared, exported and typed",
  button.includes('| "slide"') &&
    button.includes("export const SLIDE_VARIANTS") &&
    button.includes("export function isSlideVariant")
);
check(
  "the string form is sugar over the component, never a second implementation",
  button.includes("resolveSlideChild") &&
    button.includes("<SlideLabel text={children} hoverText={hoverText} />")
);

// ---------------------------------------------------------------- SLIDE-07
console.log("\nSLIDE-07 — scope: the adopters are exactly the allow-list");

const ALLOWED = new Set([
  "src/app/(app)/dashboard/page.tsx",
  "src/app/admin/overview/page.tsx",
  "src/app/how-it-works/page.tsx",
  "src/app/intelligence/page.tsx",
  "src/app/showcase/page.tsx",
  "src/components/intelligence/intelligence-closing.tsx",
  "src/components/landing/final-cta.tsx",
  "src/components/landing/hero.tsx",
  "src/components/nexus-intelligence/nexus-intelligence-hero.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/slide-label.tsx",
]);

const adopters = new Set();
for (const file of walk(src(""))) {
  const text = readFileSync(file, "utf8");
  if (!/SlideLabel|variant="slide|slide-ghost|slide-intelligence/.test(text)) continue;
  adopters.add(relative(ROOT, file).split("\\").join("/"));
}
const unexpected = [...adopters].filter((f) => !ALLOWED.has(f));
check(
  "the slide interaction has not spread beyond the audited pages",
  unexpected.length === 0,
  unexpected.join(", ")
);

// Denied surfaces: nothing that submits, confirms, deletes or repeats per row.
const DENIED_FILES = [
  "src/components/admin/admin-login-form.tsx",
  "src/app/admin/forgot-password/page.tsx",
  "src/app/admin/reset-password/page.tsx",
  "src/components/admin/admin-command-menu.tsx",
  "src/components/admin/admin-shell.tsx",
];
check(
  "no auth surface, navigation chrome or command palette slides its label",
  DENIED_FILES.every((f) => !readFileSync(join(ROOT, f), "utf8").includes("SlideLabel"))
);
check(
  "no slide variant sits on a submit control",
  !/type="submit"[\s\S]{0,200}?variant="slide/.test(button) &&
    (read("app/(app)/dashboard/page.tsx").match(/type="submit"/g) ?? []).length === 0
);
check(
  "the dashboard reveals one slide CTA, not a field of them",
  (read("app/(app)/dashboard/page.tsx").match(/variant="slide"/g) ?? []).length === 4,
  "four first-run branches of the same single dominant CTA"
);

// Pairs must be meaningful: no label that slides into itself.
const PAIR_SOURCES = [
  "src/components/ui/button.tsx",
  ...ALLOWED,
];
const identicalPairs = [];
for (const rel of PAIR_SOURCES) {
  if (rel === "src/components/ui/slide-label.tsx") continue;
  const text = existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), "utf8") : "";
  for (const m of text.matchAll(/text="([^"]+)"\s+hoverText="([^"]+)"/g)) {
    if (m[1].toLowerCase() === m[2].toLowerCase()) identicalPairs.push(`${rel}:${m[1]}`);
  }
}
check(
  'no label slides into itself ("Submit" → "Submit")',
  identicalPairs.length === 0,
  identicalPairs.join(", ")
);

// ---------------------------------------------------------------- SLIDE-08
console.log("\nSLIDE-08 — cross-product coverage");

const adminOverview = read("app/admin/overview/page.tsx");
check(
  "NEXUS Admin uses the shared component, not an Admin copy",
  adminOverview.includes('from "@/components/ui/slide-label"') &&
    !existsSync(src("components/admin/slide-label.tsx"))
);
check(
  "the Admin action is a Link (client navigation), not a full page reload",
  /<Link\s+href=\{action\.href\}/.test(adminOverview) &&
    !/<a\s+href=\{action\.href\}/.test(adminOverview)
);
check(
  "the Admin variant is only taken when a second label exists",
  adminOverview.includes("{action.hoverLabel ? (") &&
    adminOverview.includes("<SlideLabel")
);
const attention = read("lib/admin/attention.ts");
check(
  "every recommended Admin action carries its outcome wording",
  (attention.match(/label: "/g) ?? []).length ===
    (attention.match(/hoverLabel: "/g) ?? []).length,
  `${(attention.match(/hoverLabel: "/g) ?? []).length} of ${
    (attention.match(/label: "/g) ?? []).length
  }`
);
check(
  "the Admin attention pairs are inspect → open, never a synonym",
  /label: "Inspect workspaces",\s*hoverLabel: "Open workspaces",/.test(attention) &&
    /label: "Read the setup guide",\s*hoverLabel: "Open security",/.test(attention)
);
check(
  "the optional second label is typed, not free-form string passing",
  read("lib/admin/types.ts").includes("hoverLabel?: string;")
);
check(
  "Admin keeps its own token namespace — no product Button import leaked in",
  !adminOverview.includes('from "@/components/ui/button"')
);
check(
  "the shared primitive carries no colour of its own (usable in both products)",
  !/bg-|text-(?!center|left|right)[a-z]|border-/.test(
    label.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
  )
);

// ---------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed\n`);
process.exit(failures ? 1 : 0);
