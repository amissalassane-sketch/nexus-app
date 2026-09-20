#!/usr/bin/env node
/**
 * NEXUS — ICON LANGUAGE STRUCTURAL TESTS
 * ======================================
 * Locks the PR2+ icon-system decisions: one wrapper (NexusIcon) fixing
 * stroke/size/a11y defaults, explicit tree-shakable Tabler imports, and
 * the per-zone migration state (navigation migrated in PR2; product,
 * intelligence and admin surfaces follow in PR3–PR4).
 *
 * Run:  node scripts/test-icons.mjs   (or  npm run test:icon)
 * Exit: 0 = all invariants hold, 1 = at least one check failed.
 */

import { readFileSync, readdirSync } from "node:fs";
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

function walk(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, "src", dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(tsx?|mts|cts)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

console.log("\nNEXUS icon language — structural invariants\n");

// ------------------------------------------------------------------
console.log("NexusIcon foundation");
// ------------------------------------------------------------------
const wrapper = read("components/nexus-icon.tsx");

check(
  "NexusIcon: size scale is nav/toolbar 18, action 16, state 24/32",
  wrapper.includes("nav: 18") &&
    wrapper.includes("toolbar: 18") &&
    wrapper.includes("action: 16") &&
    wrapper.includes("state: 24") &&
    wrapper.includes("stateLg: 32")
);

check(
  "NexusIcon: stroke defaults to 1.75",
  wrapper.includes("stroke = 1.75")
);

check(
  "NexusIcon: inherits context color by default",
  wrapper.includes('color="currentColor"')
);

check(
  "NexusIcon: decorative by default, named when labelled",
  wrapper.includes("aria-hidden={label ? undefined : true}") &&
    wrapper.includes('role={label ? "img" : undefined}')
);

check(
  "NexusIcon: no Lucide inside the wrapper",
  !wrapper.includes("lucide-react")
);

// ------------------------------------------------------------------
console.log("Tree-shaking discipline (no global/dynamic Tabler imports)");
// ------------------------------------------------------------------
const files = walk("").map((rel) => ({ rel, text: read(rel) }));

check(
  "no namespace import of the icon library anywhere",
  !files.some(({ text }) => /import\s+\*\s+as\s+\w+\s+from\s+"@tabler\/icons-react"/.test(text))
);

check(
  "no string-resolved icon lookup anywhere",
  !files.some(({ text }) => /Icon\[\s*\w/.test(text))
);

// ------------------------------------------------------------------
console.log("Navigation zone migrated (PR2)");
// ------------------------------------------------------------------
const NAV_ZONE = [
  "components/layout/nav-config.ts",
  "components/layout/workspace-sidebar.tsx",
  "components/layout/topbar.tsx",
  "components/layout/app-shell.tsx",
  "components/notification-preview.tsx",
];

for (const rel of NAV_ZONE) {
  check(`${rel}: Lucide-free`, !read(rel).includes("lucide-react"));
}

check(
  "nav-config: model holds Tabler component references",
  read("components/layout/nav-config.ts").includes("icon: TablerIcon")
);

const sidebar = read("components/layout/workspace-sidebar.tsx");
check(
  "sidebar: both nav renders go through NexusIcon at nav size",
  (sidebar.match(/<NexusIcon icon=\{item\.icon\} size="nav" \/>/g) ?? []).length === 2
);

check(
  "app-shell: mobile nav renders through NexusIcon at nav size",
  read("components/layout/app-shell.tsx").includes(
    '<NexusIcon icon={item.icon} size="nav" />'
  )
);

check(
  "command-menu: page entries render through NexusIcon",
  read("components/command-menu.tsx").includes("<NexusIcon icon={entry.icon} />")
);

console.log(`\n${passes} passed, ${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
