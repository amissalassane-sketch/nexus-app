"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NexusWordmark } from "@/components/nexus-logo";
import { CommandMenu } from "@/components/command-menu";
import { Topbar } from "@/components/layout/topbar";
import { MobileNavItem } from "@/components/ui/navigation";
import { MOBILE_NAV, isNavActive } from "@/components/layout/nav-config";
import { ToastProvider } from "@/components/ui/toast";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { ProfileCompletionPrompt } from "@/components/profile/profile-completion-prompt";
import { ProfileCompletionModal } from "@/components/profile/profile-completion-modal";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/onboarding-provider";
import {
  WorkspaceSidebar,
  type ShellCounts,
  type ShellPlan,
  type ShellUser,
  type ShellWorkspace,
} from "@/components/layout/workspace-sidebar";

// ============================================================
// NEXUS — APPLICATION SHELL
// A professional desktop layout: fixed sidebar (248px) + top bar +
// scrolling content. Below `lg` the sidebar becomes a drawer and a
// compact bottom navigation carries the primary destinations.
// ============================================================

function AppShellInner({
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
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const pathname = usePathname();

  // Optional profile completion — UI guidance only, never an access gate.
  // The product renders first; the prompt appears as a subtle card and the
  // modal can be opened from the card or the account menu.
  const openProfileModal = useCallback(() => setProfileModalOpen(true), []);
  const closeProfileModal = useCallback(() => setProfileModalOpen(false), []);

  const { tourActive, openHelp } = useOnboarding();

  const profileMissingSummary =
    [
      user.name?.trim() ? null : "name",
      user.username ? null : "username",
    ]
      .filter((entry): entry is string => entry !== null)
      .join(" and ");

  // The drawer is closed by the thing that navigates (`onNavigate` on every
  // sidebar item), not by an effect watching the pathname — no cascading
  // render, and the state change stays attached to the user's action.
  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNav();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen, closeNav]);

  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden bg-bg-base">
        <CommandMenu />
        <KeyboardShortcuts />

        <a
          href="#nexus-main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[90] focus:rounded-nav focus:bg-accent focus:px-3 focus:py-2 focus:text-caption focus:font-medium focus:text-accent-fg"
        >
          Skip to content
        </a>

        <aside
          aria-label="Workspace navigation"
          className="hidden w-[248px] shrink-0 border-r border-border-subtle bg-bg-subtle/60 lg:block"
        >
          <WorkspaceSidebar
            user={user}
            workspace={workspace}
            counts={counts}
            plan={plan}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Compact header below lg — carries brand + drawer trigger */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4 lg:hidden">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              className="flex h-8 w-8 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
            >
              <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <Link href="/dashboard" aria-label="NEXUS — Overview">
              <NexusWordmark size={20} priority />
            </Link>
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("nexus:open-command"))}
                aria-label="Search NEXUS"
                className="flex h-8 w-8 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </button>
            </div>
          </header>

          <div className="hidden lg:block">
            <Topbar
              user={user}
              workspace={workspace}
              unreadCount={counts.unreadNotifications}
              onOpenProfileModal={openProfileModal}
              onOpenHelp={openHelp}
            />
          </div>

          <main id="nexus-main" className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 sm:px-7 sm:pb-10 sm:pt-8">
              {!user.profileComplete && !tourActive ? (
                <ProfileCompletionPrompt
                  missingSummary={profileMissingSummary || "your identity"}
                  onOpen={openProfileModal}
                />
              ) : null}
              {children}
            </div>
          </main>

          {/* Compact bottom navigation — below lg only */}
          <nav
            aria-label="Primary"
            className="flex shrink-0 items-stretch gap-1 border-t border-border-subtle bg-bg-subtle/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
          >
            {MOBILE_NAV.map((item) => (
              <MobileNavItem
                key={item.href}
                href={item.href}
                label={item.label}
                active={isNavActive(pathname, item.href)}
                badge={
                  item.count === "unreadNotifications"
                    ? counts.unreadNotifications
                    : undefined
                }
                icon={<item.icon size={17} strokeWidth={1.75} />}
              />
            ))}
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="More destinations"
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-nav py-1.5 text-text-tertiary transition-colors duration-150 hover:text-text-primary"
            >
              <Menu size={17} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[10.5px] leading-none">More</span>
            </button>
          </nav>
        </div>

        {/* Optional profile completion — reachable from the prompt card
            and the account menu. Never auto-opens. */}
        <ProfileCompletionModal
          open={profileModalOpen}
          onClose={closeProfileModal}
          initialName={user.name}
          initialUsername={user.username}
        />

        {/* Drawer — the full sidebar below lg */}
        {navOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={closeNav}
              className="absolute inset-0 bg-black/70 animate-fade-in"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 flex w-[272px] max-w-[86vw] flex-col overflow-hidden border-r border-border-default bg-bg-subtle animate-panel-in"
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4">
                <NexusWordmark size={20} />
                <button
                  type="button"
                  onClick={closeNav}
                  aria-label="Close navigation"
                  className="flex h-8 w-8 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
                >
                  <X size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <WorkspaceSidebar
                  user={user}
                  workspace={workspace}
                  counts={counts}
                  plan={plan}
                  onNavigate={closeNav}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ToastProvider>
  );
}

export function AppShell({
  user,
  workspace,
  counts,
  plan,
  userId,
  children,
}: {
  user: ShellUser;
  workspace: ShellWorkspace;
  counts: ShellCounts;
  plan: ShellPlan;
  userId: string;
  children: ReactNode;
}) {
  return (
    <OnboardingProvider
      userId={userId}
      projectCount={counts.projects}
      taskCount={counts.tasks}
      goalCount={counts.goals}
      profileComplete={user.profileComplete}
    >
      <AppShellInner user={user} workspace={workspace} counts={counts} plan={plan}>
        {children}
      </AppShellInner>
    </OnboardingProvider>
  );
}
