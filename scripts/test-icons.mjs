#!/usr/bin/env node
/**
 * NEXUS — ICON LANGUAGE STRUCTURAL TESTS
 * ======================================
 * Locks the PR2+ icon-system decisions: one wrapper (NexusIcon) fixing
 * stroke/size/a11y defaults, explicit tree-shakable Tabler imports, and
 * the per-zone migration state (navigation migrated in PR2; dashboard,
 * product, intelligence and command-menu surfaces in PR3; landing, auth,
 * legal and admin surfaces in PR4 — the migration is complete and the
 * lucide-react dependency has been removed).
 *
 * Run:  node scripts/test-icons.mjs   (or  npm run test:icon)
 * Exit: 0 = all invariants hold, 1 = at least one check failed.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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

// ------------------------------------------------------------------
console.log("Product + intelligence zones migrated (PR3)");
// ------------------------------------------------------------------
const PR3_ZONE = [
  "app/(app)/dashboard/page.tsx",
  "app/(app)/integrations/page.tsx",
  "app/(app)/settings/billing/page.tsx",
  "app/(app)/upgrade/page.tsx",
  "components/activity-list.tsx",
  "components/command-menu.tsx",
  "components/dashboard/active-projects.tsx",
  "components/dashboard/briefing-panel.tsx",
  "components/dashboard/kpi-grid.tsx",
  "components/dashboard/priority-queue.tsx",
  "components/dashboard/upcoming-panel.tsx",
  "components/goal-manager.tsx",
  "components/integrations/integration-platform.tsx",
  "components/integrations/integration-icon.tsx",
  "components/intelligence-panel.tsx",
  "components/intelligence/briefing-panel.tsx",
  "components/intelligence/context/context-node.tsx",
  "components/intelligence/explainable-intelligence.tsx",
  "components/intelligence/forecast-panel.tsx",
  "components/intelligence/health-panel.tsx",
  "components/intelligence/intelligence-ask.tsx",
  "components/intelligence/intelligence-closing.tsx",
  "components/intelligence/intelligence-signals.tsx",
  "components/intelligence/mission-panel.tsx",
  "components/intelligence/next-best-action.tsx",
  "components/intelligence/priority-focus.tsx",
  "components/intelligence/proactive-signals-panel.tsx",
  "components/intelligence/signal-card.tsx",
  "components/intelligence/signal-detail.tsx",
  "components/intelligence/signal-icons.tsx",
  "components/logout-button.tsx",
  "components/mobile-home/mobile-overview.tsx",
  "components/notification-center.tsx",
  "components/onboarding/checklist.tsx",
  "components/onboarding/help-center.tsx",
  "components/profile/profile-completion-modal.tsx",
  "components/profile/profile-completion-prompt.tsx",
  "components/project-manager.tsx",
  "components/task-manager.tsx",
  "components/tasks/nexus-kanban.tsx",
  "components/ui/confirm-dialog.tsx",
  "components/ui/create-button.tsx",
  "components/ui/modal.tsx",
  "components/ui/password-input.tsx",
  "components/ui/toast.tsx",
  "components/upgrade-prompt.tsx",
  "components/user-settings-panel.tsx",
  "components/workspace-status-banner.tsx",
];

for (const rel of PR3_ZONE) {
  const text = read(rel);
  check(`${rel}: Lucide-free`, !text.includes("lucide-react"));
  check(`${rel}: no LucideIcon type residue`, !text.includes("LucideIcon"));
  check(
    `${rel}: no one-off strokeWidth (wrapper default 1.75)`,
    !text.includes("strokeWidth={")
  );
}

check(
  "signal-icons: vocabulary typed on TablerIcon",
  read("components/intelligence/signal-icons.tsx").includes(
    "Record<SignalKind, TablerIcon>"
  )
);

check(
  "mission-panel: status map typed on TablerIcon",
  read("components/intelligence/mission-panel.tsx").includes(
    "Record<MissionStepStatus, TablerIcon>"
  )
);

check(
  "toast: tone map holds Tabler components",
  read("components/ui/toast.tsx").includes("success: IconCheck") &&
    read("components/ui/toast.tsx").includes("info: IconInfoCircle")
);

check(
  "command-menu: fully migrated (no Lucide tag renders, empty state at state size)",
  read("components/command-menu.tsx").includes(
    '<NexusIcon icon={IconSearch} size="state" />'
  )
);

// ------------------------------------------------------------------
console.log("Landing + auth + legal + admin zones migrated (PR4)");
// ------------------------------------------------------------------
const PR4_ZONE = [
  "app/admin/forgot-password/page.tsx",
  "app/admin/reset-password/page.tsx",
  "app/forgot-password/page.tsx",
  "app/how-it-works/page.tsx",
  "app/legal/page.tsx",
  "app/reset-password/page.tsx",
  "components/admin/admin-login-form.tsx",
  "components/auth/confirm-error.tsx",
  "components/auth/login-form.tsx",
  "components/auth/signup-form.tsx",
  "components/auth/verify-code.tsx",
  "components/landing/faq.tsx",
  "components/landing/features.tsx",
  "components/landing/final-cta.tsx",
  "components/landing/hero.tsx",
  "components/landing/integrations-section.tsx",
  "components/landing/intelligence-section.tsx",
  "components/landing/landing-nav.tsx",
  "components/landing/model-section.tsx",
  "components/landing/pricing.tsx",
  "components/landing/product-preview.tsx",
  "components/landing/trust.tsx",
  "components/legal/legal-card.tsx",
  "components/legal/legal-header.tsx",
  "components/legal/legal-navigation.tsx",
  "components/legal/legal-toc.tsx",
  "components/legal/legal-ui.tsx",
  "components/nexus-intelligence/nexus-intelligence-hero.tsx",
];

for (const rel of PR4_ZONE) {
  const text = read(rel);
  check(`${rel}: Lucide-free`, !text.includes("lucide-react"));
  check(`${rel}: no LucideIcon type residue`, !text.includes("LucideIcon"));
  check(
    `${rel}: no one-off strokeWidth (wrapper default 1.75)`,
    !text.includes("strokeWidth={")
  );
}

check(
  "product-preview: mock-nav map typed on TablerIcon",
  read("components/landing/product-preview.tsx").includes("icon: TablerIcon")
);

check(
  "landing-nav: menu toggle renders through NexusIcon at nav size",
  read("components/landing/landing-nav.tsx").includes(
    '<NexusIcon icon={IconMenu2} size="nav" />'
  )
);

check(
  "auth: Google-button spinners preserve the 18px glyph swap (no layout shift)",
  read("components/auth/login-form.tsx").includes(
    '<NexusIcon icon={IconLoader2} px={18} className="animate-spin" />'
  ) &&
    read("components/auth/signup-form.tsx").includes(
      '<NexusIcon icon={IconLoader2} px={18} className="animate-spin" />'
    )
);

console.log(`\n${passes} passed, ${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
