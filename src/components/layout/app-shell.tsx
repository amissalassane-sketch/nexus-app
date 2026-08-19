"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NexusWordmark } from "@/components/nexus-logo";
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
// Two-level navigation (icon rail + workspace sidebar) and a content
// surface, in a fixed-height desktop layout where only the content
// scrolls. Below `lg` the two levels collapse into a single drawer.
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
    <div className="flex h-dvh overflow-hidden bg-bg-base">
      <AppRail unreadCount={counts.unreadNotifications} />

      <aside
        aria-label="Workspace navigation"
        className="hidden w-[244px] shrink-0 border-r border-border-subtle lg:block"
      >
        <WorkspaceSidebar
          user={user}
          workspace={workspace}
          counts={counts}
          plan={plan}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile / tablet header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="flex h-8 w-8 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
          <Link href="/dashboard" aria-label="NEXUS — Dashboard">
            <NexusWordmark size={26} priority />
          </Link>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="mx-auto min-h-full w-full max-w-[1180px] rounded-[18px] border border-border-subtle bg-bg-subtle/40 px-4 py-6 sm:px-7 sm:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile drawer: both navigation levels in one panel */}
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
            className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-border-subtle bg-bg-base animate-scale-in"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4">
              <NexusWordmark size={26} />
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
