"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LifeBuoy, LogOut, Menu, UserRound, X } from "lucide-react";
import { cn } from "@/lib/cn";
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
import { createClient } from "@/lib/supabase/client";
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
  const [navClosing, setNavClosing] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const navCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Optional profile completion — UI guidance only, never an access gate.
  // The product renders first; the prompt appears as a subtle card and the
  // modal can be opened from the card or the account menu.
  const openProfileModal = useCallback(() => setProfileModalOpen(true), []);
  const closeProfileModal = useCallback(() => setProfileModalOpen(false), []);

  const { tourActive, openHelp } = useOnboarding();

  const handleLogout = async () => {
    try {
      await createClient().auth.signOut();
    } catch (cause) {
      console.error("Logout error:", cause);
    }
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  };

  const profileMissingSummary =
    [
      user.name?.trim() ? null : "name",
      user.username ? null : "username",
    ]
      .filter((entry): entry is string => entry !== null)
      .join(" and ");

  // The drawer is closed by the thing that navigates (`onNavigate` on every
  // sidebar item), not by an effect watching the pathname — no cascading
  // render, and the state change stays attached to the user's action. The
  // drawer plays a short reverse animation before unmounting instead of
  // vanishing the instant the navigation lands.
  const openNav = useCallback(() => {
    if (navCloseTimer.current) clearTimeout(navCloseTimer.current);
    setNavClosing(false);
    setNavOpen(true);
  }, []);

  const closeNav = useCallback(() => {
    if (navClosing) return;
    setNavClosing(true);
    navCloseTimer.current = setTimeout(() => {
      setNavOpen(false);
      setNavClosing(false);
    }, 160);
  }, [navClosing]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNav();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen, closeNav]);

  useEffect(
    () => () => {
      if (navCloseTimer.current) clearTimeout(navCloseTimer.current);
    },
    []
  );

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
          {/* Compact header below lg — carries brand + drawer trigger + quick search, help & account */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle px-3 sm:px-4 lg:hidden">
            <button
              type="button"
              onClick={openNav}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              className="flex h-9 w-9 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary focus-visible:ring-1 focus-visible:ring-lavender-border"
            >
              <Menu size={19} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <Link href="/dashboard" aria-label="NEXUS — Overview" className="outline-none focus-visible:ring-1 focus-visible:ring-lavender-border rounded-nav">
              <NexusWordmark size={19} priority />
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("nexus:open-command"))}
                aria-label="Search NEXUS"
                className="flex h-8 w-8 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
              >
                <svg
                  width="15"
                  height="15"
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
              <Link
                href="/notifications"
                aria-label={counts.unreadNotifications > 0 ? `Notifications — ${counts.unreadNotifications} unread` : "Notifications"}
                className="relative flex h-8 w-8 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
              >
                <Bell size={15} strokeWidth={1.75} aria-hidden="true" />
                {counts.unreadNotifications > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-pill bg-lavender"
                  />
                ) : null}
              </Link>
              <button
                type="button"
                onClick={openHelp}
                aria-label="Help & Guide"
                data-guide="help-button"
                className="flex h-8 w-8 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
              >
                <LifeBuoy size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={openProfileModal}
                aria-label="Account profile"
                className="flex h-7 w-7 items-center justify-center rounded-pill border border-border-default bg-bg-surface-2 text-[11px] font-semibold text-text-primary transition-colors duration-150 ease-nexus hover:border-border-strong"
              >
                {user.name?.trim() ? (
                  user.name.trim().slice(0, 1).toUpperCase()
                ) : (
                  <UserRound size={13} strokeWidth={1.75} aria-hidden="true" />
                )}
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
            aria-label="Primary navigation"
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
                data-guide={
                  item.href === "/app/intelligence"
                    ? "intelligence-nav"
                    : item.href === "/projects"
                      ? "projects-nav"
                      : item.href === "/tasks"
                        ? "tasks-nav"
                        : item.href === "/dashboard"
                          ? "dashboard"
                          : undefined
                }
              />
            ))}
            <button
              type="button"
              onClick={openNav}
              aria-label="More destinations"
              className="flex min-h-[46px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-nav py-1.5 text-text-tertiary outline-none transition-colors duration-150 hover:text-text-primary focus-visible:ring-1 focus-visible:ring-lavender-border"
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
          <div
            className={cn(
              "fixed inset-0 z-50 lg:hidden",
              navClosing && "pointer-events-none"
            )}
          >
            <button
              type="button"
              aria-label="Close navigation"
              onClick={closeNav}
              className={cn(
                "absolute inset-0 bg-black/70",
                navClosing ? "animate-fade-out" : "animate-fade-in"
              )}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className={cn(
                "absolute inset-y-0 left-0 flex w-[280px] max-w-[88vw] flex-col overflow-hidden border-r border-border-default bg-bg-subtle",
                navClosing ? "animate-panel-out" : "animate-panel-in"
              )}
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
              <div className="shrink-0 border-t border-border-subtle p-3 bg-bg-surface/30">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeNav();
                      openHelp();
                    }}
                    className="inline-flex h-8 items-center gap-2 rounded-nav px-2.5 text-caption text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
                  >
                    <LifeBuoy size={14} strokeWidth={1.75} />
                    <span>Help & Guide</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-nav px-2 text-caption text-text-tertiary hover:bg-danger-bg hover:text-danger"
                  >
                    <LogOut size={13} strokeWidth={1.75} />
                    <span>Sign out</span>
                  </button>
                </div>
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
