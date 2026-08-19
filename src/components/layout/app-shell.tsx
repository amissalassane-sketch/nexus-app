"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NexusWordmark } from "@/components/nexus-logo";
import { CommandMenu } from "@/components/command-menu";
import { AppRail } from "@/components/layout/app-rail";
import {
  WorkspaceSidebar,
  type ShellCounts,
  type ShellPlan,
  type ShellUser,
  type ShellWorkspace,
} from "@/components/layout/workspace-sidebar";

// ============================================================
// NEXUS — APPLICATION SHELL
// Three separated surfaces floating on the dot-grid base:
//   rail (56px) · workspace sidebar (248px) · content panel
// Only the content scrolls; the navigation stays anchored.
// Below `lg` the two navigation levels collapse into one drawer.
// ============================================================

export function AppShell({
  user,
  workspace,
  counts,
  plan,
  children,
}: {
  user: ShellUser;
  workspace: ShellWorkspace;
  counts: ShellCounts;
  plan: ShellPlan;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-dvh gap-2 overflow-hidden bg-bg-base p-2 lg:gap-2.5 lg:p-2.5">
      <CommandMenu />
      <AppRail unreadCount={counts.unreadNotifications} />

      <aside
        aria-label="Workspace navigation"
        className="hidden w-[248px] shrink-0 overflow-visible rounded-[20px] border border-border-subtle bg-bg-subtle/70 lg:block"
      >
        <WorkspaceSidebar
          user={user}
          workspace={workspace}
          counts={counts}
          plan={plan}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-border-subtle bg-bg-subtle/40">
        {/* Compact header: only below lg, where the rail is hidden */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="flex h-8 w-8 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
          <Link href="/dashboard" aria-label="NEXUS — Dashboard">
            <NexusWordmark size={24} priority />
          </Link>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-8 sm:py-9">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile drawer: both navigation levels in a single panel */}
      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-black/70 animate-fade-in"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-2 left-2 flex w-[272px] max-w-[85vw] flex-col overflow-hidden rounded-[20px] border border-border-default bg-bg-subtle animate-scale-in"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4">
              <NexusWordmark size={24} />
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation"
                className="flex h-8 w-8 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <WorkspaceSidebar
                user={user}
                workspace={workspace}
                counts={counts}
                plan={plan}
                onNavigate={() => setNavOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
