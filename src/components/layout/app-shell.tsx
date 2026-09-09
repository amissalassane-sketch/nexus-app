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
import {
  MOBILE_NAV,
  breadcrumbFor,
  isNavActive,
} from "@/components/layout/nav-config";
import { ToastProvider } from "@/components/ui/toast";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { ProfileCompletionPrompt } from "@/components/profile/profile-completion-prompt";
import { ProfileCompletionModal } from "@/components/profile/profile-completion-modal";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/onboarding-provider";
import { PageTransition } from "@/components/motion/page-transition";
import { createClient } from "@/lib/supabase/client";
import {
  WorkspaceSidebar,
  type ShellCounts,
  type ShellPlan,
  type ShellUser,
  type ShellWorkspace,
} from "@/components/layout/workspace-sidebar";
import { NexusSpatialField } from "@/components/spatial/nexus-spatial-field";

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
    }, 200);
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
      <div className="relative flex h-dvh overflow-hidden bg-bg-base">
        {/* LAYER 0 — the spatial field. Fixed, behind everything, and
            pointer-events-none: it never intercepts clicks, scrolling,
            selection or dialogs. */}
        <NexusSpatialField />
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
          className="relative hidden w-[248px] shrink-0 border-r border-border-subtle bg-bg-subtle/60 lg:block"
        >
          <WorkspaceSidebar
            user={user}
            workspace={workspace}
            counts={counts}
            plan={plan}
          />
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <header
            className="shrink-0 border-b border-border-subtle bg-bg-base transition-[border-color,background-color] duration-200 ease-nexus lg:hidden sticky-nav"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex h-14 items-center gap-1.5 px-2 sm:px-3">
              <button
                type="button"
                onClick={openNav}
                aria-label="Open navigation"
                aria-expanded={navOpen}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-nav text-text-secondary transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:bg-accent-ghost-hover active:scale-[0.92] focus-visible:ring-1 focus-visible:ring-lavender-border will-change-transform"
              >
                <Menu size={19} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <p
                className="min-w-0 flex-1 truncate px-1 text-[14px] font-medium tracking-[-0.01em] text-text-primary transition-opacity duration-200 ease-nexus"
                aria-live="polite"
                key={pathname}
              >
                {breadcrumbFor(pathname).slice(-1)[0] ?? "NEXUS"}
              </p>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("nexus:open-command"))}
                  aria-label="Search NEXUS"
                  className="flex h-10 w-10 items-center justify-center rounded-nav text-text-secondary transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:bg-accent-ghost-hover active:scale-[0.92] focus-visible:ring-1 focus-visible:ring-lavender-border will-change-transform"
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
                <Link
                  href="/notifications"
                  aria-label={counts.unreadNotifications > 0 ? `Notifications, ${counts.unreadNotifications} unread` : "Notifications"}
                  className="relative flex h-10 w-10 items-center justify-center rounded-nav text-text-secondary transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:bg-accent-ghost-hover active:scale-[0.92] focus-visible:ring-1 focus-visible:ring-lavender-border will-change-transform"
                >
                  <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
                  {counts.unreadNotifications > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute right-2 top-2 h-1.5 w-1.5 rounded-pill bg-lavender animate-[signal-pulse_2.6s_var(--ease-nexus)_infinite]"
                    />
                  ) : null}
                </Link>
              </div>
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

          <main id="nexus-main" className="min-w-0 flex-1 overflow-y-auto scroll-smooth">
            <PageTransition>
              <div className="mx-auto w-full max-w-page px-4 pb-24 pt-6 sm:px-6 sm:pb-10 sm:pt-8">
                {!user.profileComplete && !tourActive && pathname !== "/dashboard" ? (
                  <div className="animate-[intelligence-state-in_320ms_var(--ease-nexus)_both]">
                    <ProfileCompletionPrompt
                      missingSummary={profileMissingSummary || "your identity"}
                      onOpen={openProfileModal}
                    />
                  </div>
                ) : null}
                {children}
              </div>
            </PageTransition>
          </main>

          <nav
            aria-label="Primary navigation"
            className="flex shrink-0 items-stretch gap-1 border-t border-border-subtle bg-bg-subtle/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden mobile-nav"
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
              className="flex min-h-(--chrome-tab-bar) min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-nav py-1.5 text-text-tertiary outline-none transition-[color,transform,background-color] duration-150 ease-nexus hover:text-text-primary active:scale-[0.94] focus-visible:ring-1 focus-visible:ring-lavender-border will-change-transform"
            >
              <Menu size={17} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[10.5px] leading-none">More</span>
            </button>
          </nav>
        </div>

        <ProfileCompletionModal
          open={profileModalOpen}
          onClose={closeProfileModal}
          initialName={user.name}
          initialUsername={user.username}
        />

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
                "absolute inset-0 bg-black/70 backdrop-blur-[2px] will-change-transform",
                navClosing
                  ? "animate-[fade-out_200ms_var(--ease-nexus)_both]"
                  : "animate-[fade-in_200ms_var(--ease-nexus)_both]"
              )}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className={cn(
                "absolute inset-y-0 left-0 flex w-[280px] max-w-[88vw] flex-col overflow-hidden border-r border-border-default bg-bg-subtle shadow-overlay will-change-transform",
                navClosing
                  ? "animate-[panel-out_200ms_var(--ease-nexus)_both]"
                  : "animate-[panel-in_320ms_var(--ease-nexus)_both]"
              )}
            >
              <div
                className="shrink-0 border-b border-border-subtle"
                style={{ paddingTop: "env(safe-area-inset-top)" }}
              >
                <div className="flex h-14 items-center justify-between px-4">
                  <NexusWordmark size={20} />
                  <button
                    type="button"
                    onClick={closeNav}
                    aria-label="Close navigation"
                    className="flex h-10 w-10 items-center justify-center rounded-nav text-text-secondary transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:scale-[0.9]"
                  >
                    <X size={17} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <WorkspaceSidebar
                  user={user}
                  workspace={workspace}
                  counts={counts}
                  plan={plan}
                  onNavigate={closeNav}
                />
              </div>
              <div className="shrink-0 border-t border-border-subtle bg-bg-surface/30 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      closeNav();
                      openProfileModal();
                    }}
                    className="inline-flex min-h-[40px] items-center gap-2.5 rounded-nav px-2.5 text-caption text-text-secondary transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:scale-[0.97]"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-pill border border-border-default bg-bg-surface-2 text-[9px] font-semibold text-text-primary">
                      {user.name?.trim() ? user.name.trim().slice(0, 1).toUpperCase() : <UserRound size={10} strokeWidth={2} aria-hidden="true" />}
                    </span>
                    <span>Account Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeNav();
                      openHelp();
                    }}
                    className="inline-flex min-h-[40px] items-center gap-2.5 rounded-nav px-2.5 text-caption text-text-secondary transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:scale-[0.97]"
                  >
                    <span className="flex h-6 w-6 items-center justify-center text-text-tertiary">
                      <LifeBuoy size={14} strokeWidth={1.75} />
                    </span>
                    <span>Help & Guide</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="inline-flex min-h-[40px] items-center gap-2.5 rounded-nav px-2.5 text-caption text-text-tertiary transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-danger-bg hover:text-danger active:scale-[0.97]"
                  >
                    <span className="flex h-6 w-6 items-center justify-center">
                      <LogOut size={13} strokeWidth={1.75} />
                    </span>
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
