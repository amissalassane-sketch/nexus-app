"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  IconBell,
  IconBolt,
  IconChecklist,
  IconChevronRight,
  IconCommand,
  IconLayoutDashboard,
  IconLifebuoy,
  IconRadar,
  IconSearch,
  IconUser,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { breadcrumbFor } from "@/components/layout/nav-config";
import { useCommandKeyLabel } from "@/hooks/use-command-key";
import {
  SHOWCASE_USER,
  SHOWCASE_WORKSPACE,
  SHOWCASE_COUNTS,
  SHOWCASE_PLAN,
} from "@/lib/showcase/mock-data";

// ============================================================
// NEXUS — SHOWCASE SHELL
// ============================================================
// The visual reference environment: the real workspace shell (248px
// sidebar, 56px topbar, real WorkspaceSidebar) wrapped around five
// deterministic presentation states.
//
// Layer discipline (this is what makes the screens capturable in
// Figma / Butter): the shell paints three discrete layers, each marked
// with a data attribute so a capture can hide any of them individually:
//
//   data-dashboard-root      the page substrate          z 0
//   data-dashboard-chrome    sidebar / topbar / content  z 1
//   data-showcase-switcher   the screen switcher overlay z 70
//
// Geometry is fixed by contract: --layout-sidebar-w 248px,
// --layout-topbar-h 56px, content padding 16 / 24 / 32.
// ============================================================

export type ShowcaseTab = {
  href: string;
  label: string;
  icon: typeof IconLayoutDashboard;
  badge?: string;
};

export const SHOWCASE_TABS: ShowcaseTab[] = [
  { href: "/showcase/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/showcase/command", label: "Command", icon: IconCommand, badge: "⌘K" },
  { href: "/showcase/intelligence", label: "Intelligence", icon: IconRadar },
  { href: "/showcase/tasks", label: "Tasks", icon: IconChecklist },
  { href: "/showcase/capture", label: "Capture", icon: IconBolt, badge: "NLP" },
];

function ShowcaseTopbar() {
  const pathname = usePathname();
  const crumbs = breadcrumbFor(pathname);
  const commandKey = useCommandKeyLabel();

  return (
    <header
      data-dashboard-chrome="topbar"
      className="flex h-(--layout-topbar-h) shrink-0 items-center gap-3 border-b border-border-subtle bg-bg-base px-4 sm:px-6"
    >
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb} className="flex min-w-0 items-center gap-1.5">
                {index > 0 ? (
                  <NexusIcon
                    icon={IconChevronRight}
                    px={14}
                    className="text-text-quaternary"
                  />
                ) : null}
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn(
                    "truncate text-[13px]",
                    last ? "font-medium text-text-primary" : "text-text-tertiary"
                  )}
                >
                  {crumb}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Omnibar — same recipe as the product topbar */}
      <div className="hidden h-8 w-[260px] items-center gap-2 rounded-control border border-border-subtle bg-bg-surface-2 px-2.5 text-small text-text-tertiary md:flex xl:w-[320px]">
        <NexusIcon icon={IconSearch} className="text-text-quaternary" />
        <span className="min-w-0 flex-1 truncate">Search NEXUS…</span>
        <kbd className="mono-token shrink-0 rounded-xs border border-border-subtle px-1 py-0.5 text-text-quaternary">
          {commandKey}
        </kbd>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="hidden items-center gap-1.5 rounded-pill border border-border-subtle px-2 py-1 lg:inline-flex">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-pill bg-success"
          />
          <span className="eyebrow text-text-tertiary">Observing</span>
        </span>

        <span className="relative flex size-8 items-center justify-center rounded-control text-text-tertiary">
          <NexusIcon icon={IconBell} size="toolbar" />
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 size-1.5 rounded-pill bg-lavender"
          />
        </span>

        <span className="flex size-8 items-center justify-center rounded-control text-text-tertiary">
          <NexusIcon icon={IconLifebuoy} size="toolbar" />
        </span>

        <span className="ml-1 flex size-7 items-center justify-center rounded-pill border border-border-default bg-bg-surface-2 text-[11px] font-semibold text-text-primary">
          {SHOWCASE_USER.name ? (
            SHOWCASE_USER.name.slice(0, 1).toUpperCase()
          ) : (
            <NexusIcon icon={IconUser} />
          )}
        </span>
      </div>
    </header>
  );
}

export function ShowcaseShell({
  children,
  activeTab,
  showSwitcher = true,
}: {
  children: React.ReactNode;
  activeTab?: string;
  showSwitcher?: boolean;
}) {
  const pathname = usePathname();
  const activeIndex = SHOWCASE_TABS.findIndex(
    (tab) =>
      (activeTab && tab.href.endsWith(activeTab)) ||
      pathname === tab.href ||
      (pathname === "/showcase" && tab.href === "/showcase/dashboard")
  );

  return (
    <div
      data-dashboard-root="true"
      data-theme="dark"
      className="dark relative flex h-dvh overflow-hidden bg-bg-base text-text-primary selection:bg-lavender/25 selection:text-white"
    >
      {/* ============================================================
          LAYER 70 — SHOWCASE SWITCHER
          One floating control, one surface recipe (overlay). No blur:
          a glass bar over a near-black canvas reads as a smudge, and
          it is the first thing that has to be hidden in a capture.
          ============================================================ */}
      {showSwitcher && (
        <aside
          aria-label="Showcase screen switcher"
          data-showcase-switcher="true"
          className="fixed bottom-4 left-1/2 z-[70] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-overlay surface-overlay p-1"
        >
          <span className="hidden shrink-0 items-center gap-2 border-r border-border-subtle pr-2 pl-1.5 sm:flex">
            <span className="mono-token text-text-quaternary">SCREENS</span>
            <span className="mono-token text-text-tertiary">
              {String(Math.max(activeIndex, 0) + 1).padStart(2, "0")}/05
            </span>
          </span>
          {SHOWCASE_TABS.map((tab, index) => {
            const isActive = index === activeIndex;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-control px-2 text-caption font-medium outline-none transition-[background-color,color] duration-[120ms] ease-nexus focus-visible:ring-1 focus-visible:ring-lavender-border",
                  isActive
                    ? "bg-bg-surface-2 text-text-primary"
                    : "text-text-tertiary hover:bg-accent-ghost hover:text-text-secondary"
                )}
              >
                <NexusIcon icon={tab.icon} className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge ? (
                  <span className="mono-token hidden text-text-quaternary md:inline">
                    {tab.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </aside>
      )}

      {/* ============================================================
          LAYER 1 — SHELL CHROME
          Sidebar 248px · topbar 56px · content column. Untouched
          geometry by contract.
          ============================================================ */}
      <aside
        aria-label="Workspace navigation"
        data-dashboard-chrome="sidebar"
        className="relative hidden w-(--layout-sidebar-w) shrink-0 border-r border-border-subtle bg-bg-base lg:block"
      >
        <WorkspaceSidebar
          counts={SHOWCASE_COUNTS}
          plan={SHOWCASE_PLAN}
          user={SHOWCASE_USER}
          workspace={SHOWCASE_WORKSPACE}
        />
      </aside>

      <div
        data-dashboard-chrome="column"
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-bg-base"
      >
        <ShowcaseTopbar />
        <div
          id="nexus-main"
          data-dashboard-chrome="main"
          className="flex-1 overflow-y-auto bg-bg-base p-4 sm:p-6 lg:p-8"
        >
          <div data-dashboard-chrome="content" className="mx-auto w-full max-w-page">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
