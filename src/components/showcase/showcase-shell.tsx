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
  IconSparkles,
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

export type ShowcaseTab = {
  href: string;
  label: string;
  icon: typeof IconLayoutDashboard;
  badge?: string;
};

export const SHOWCASE_TABS: ShowcaseTab[] = [
  { href: "/showcase/dashboard", label: "1. Dashboard", icon: IconLayoutDashboard },
  { href: "/showcase/command", label: "2. Command Center", icon: IconCommand, badge: "⌘K" },
  { href: "/showcase/intelligence", label: "3. AI Intelligence", icon: IconRadar },
  { href: "/showcase/tasks", label: "4. Tasks Kanban", icon: IconChecklist },
  { href: "/showcase/capture", label: "5. Capture & NLP", icon: IconBolt, badge: "NLP" },
];

function ShowcaseTopbar() {
  const pathname = usePathname();
  const crumbs = breadcrumbFor(pathname);
  const commandKey = useCommandKeyLabel();

  return (
    <header
      data-dashboard-chrome="topbar"
      className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle bg-[#000000] px-4 sm:px-6 transition-[border-color,background-color] duration-200 ease-nexus"
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
                    className="text-text-quaternary transition-transform duration-150 ease-nexus"
                  />
                ) : null}
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn(
                    "truncate text-[13px] transition-[color,opacity,transform] duration-[200ms] ease-nexus",
                    last
                      ? "font-medium text-text-primary animate-[intelligence-state-in_200ms_var(--ease-nexus)_both]"
                      : "text-text-tertiary"
                  )}
                >
                  {crumb}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Omnibar Search */}
      <button
        type="button"
        aria-label="Search NEXUS, command palette"
        className="hidden h-8 w-[260px] items-center gap-2 rounded-nav border border-border-subtle bg-bg-surface/40 px-2.5 text-left text-[12.5px] text-text-tertiary transition-[border-color,background-color,color,transform] duration-150 ease-nexus hover:border-border-default hover:bg-bg-surface hover:text-text-secondary active:scale-[0.98] md:flex xl:w-[320px] will-change-transform"
      >
        <NexusIcon
          icon={IconSearch}
          className="transition-transform duration-150 ease-nexus group-hover:scale-105"
        />
        <span className="min-w-0 flex-1 truncate">Search NEXUS…</span>
        <kbd className="shrink-0 rounded-[4px] border border-border-subtle px-1 font-mono text-[10px] leading-[15px] text-text-quaternary">
          {" "}
          {commandKey}{" "}
        </kbd>
      </button>

      {/* Right Controls */}
      <div className="flex shrink-0 items-center gap-0.5">
        <span className="hidden items-center gap-1.5 rounded-pill border border-border-subtle px-2 py-1 transition-colors duration-200 ease-nexus hover:border-border-default lg:inline-flex">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-pill bg-success animate-[signal-pulse_2.6s_var(--ease-nexus)_infinite]"
          />
          <span className="eyebrow text-text-tertiary">Observing</span>
        </span>

        {/* Notifications Icon with Badge */}
        <div className="relative flex h-8 w-8 items-center justify-center rounded-nav text-text-tertiary transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary">
          <NexusIcon icon={IconBell} size="toolbar" />
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-lavender opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lavender" />
          </span>
        </div>

        {/* Help button */}
        <button
          type="button"
          aria-label="NEXUS Guide and help"
          className="flex h-8 w-8 items-center justify-center rounded-nav text-text-tertiary outline-none transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:scale-[0.9] focus-visible:ring-1 focus-visible:ring-lavender-border will-change-transform"
        >
          <NexusIcon icon={IconLifebuoy} size="toolbar" />
        </button>

        {/* User Avatar */}
        <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-pill border border-border-default bg-bg-surface-2 text-[11px] font-semibold text-text-primary outline-none transition-[border-color,background-color,transform] duration-150 ease-nexus hover:border-border-strong">
          {SHOWCASE_USER.name ? (
            SHOWCASE_USER.name.slice(0, 1).toUpperCase()
          ) : (
            <NexusIcon icon={IconUser} />
          )}
        </div>
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

  return (
    <div
      data-dashboard-root="true"
      data-theme="dark"
      className="dark relative flex h-dvh overflow-hidden bg-[#000000] text-text-primary selection:bg-white/20 selection:text-white"
    >
      {/* ============================================================
          SHOWCASE PRESENTATION SWITCHER
          Allows jumping between the 5 motion design presentation states
          ============================================================ */}
      {showSwitcher && (
        <aside
          aria-label="Showcase scene switcher"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-1 rounded-pill border border-white/10 bg-[#171717]/90 px-2 py-1.5 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        >
          <span className="flex items-center gap-1.5 px-2 text-[11px] font-mono uppercase tracking-wider text-text-quaternary border-r border-white/10 mr-1">
            <NexusIcon icon={IconSparkles} className="text-lavender size-3" />
            <span>Showcase</span>
          </span>
          {SHOWCASE_TABS.map((tab) => {
            const isActive =
              (activeTab && tab.href.endsWith(activeTab)) ||
              pathname === tab.href ||
              (pathname === "/showcase" && tab.href === "/showcase/dashboard");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-pill px-3 text-[12px] font-medium transition-all duration-150 ease-nexus",
                  isActive
                    ? "bg-white text-black shadow-sm font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                )}
              >
                <NexusIcon icon={tab.icon} className="size-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={cn(
                      "rounded-[4px] px-1 py-0.2 font-mono text-[9px] leading-tight",
                      isActive
                        ? "bg-black/10 text-black font-bold"
                        : "bg-white/10 text-text-tertiary"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </aside>
      )}

      {/* Real Workspace Sidebar (fixed at left: w-[248px]) */}
      <aside
        aria-label="Workspace navigation"
        data-dashboard-chrome="sidebar"
        className="relative hidden w-[248px] shrink-0 border-r border-border-subtle bg-[#000000] lg:block"
      >
        <WorkspaceSidebar
          counts={SHOWCASE_COUNTS}
          plan={SHOWCASE_PLAN}
          user={SHOWCASE_USER}
          workspace={SHOWCASE_WORKSPACE}
        />
      </aside>

      {/* Main Content Column */}
      <div
        data-dashboard-chrome="column"
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#000000]"
      >
        <ShowcaseTopbar />
        <div
          id="nexus-main"
          className="flex-1 overflow-y-auto bg-[#000000] p-4 sm:p-6 lg:p-8"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
