"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  FolderKanban,
  Bell,
  Settings2,
  Plus,
  SquarePen,
  FolderPlus,
  Crosshair,
  Sparkles,
} from "lucide-react";
import { NexusLogo } from "@/components/nexus-logo";
import { LogoutButton } from "@/components/logout-button";
import { CommandPalette } from "@/components/command-palette";

// ============================================================
// NEXUS — SHELL
// Design QA (P4):
//  - One page container (max-w-[1180px], identical padding everywhere)
//  - Exactly one h1 per page (the header title)
//  - Sidebar: animated active indicator (160ms), grouped nav
//  - Create dropdown: anchored to its trigger, same width,
//    z-index above the sidebar, shadow + scale-in
//  - Touch targets ≥ 44px on mobile for primary actions
// ============================================================

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Focus",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { name: "Tasks", href: "/tasks", icon: CheckSquare, exact: true },
      { name: "Goals", href: "/goals", icon: Target, exact: true },
      { name: "Projects", href: "/projects", icon: FolderKanban, exact: true },
    ],
  },
  {
    label: "Activity",
    items: [
      { name: "Intelligence", href: "/intelligence", icon: Sparkles, exact: true },
      { name: "Notifications", href: "/notifications", icon: Bell, exact: true },
      { name: "Settings", href: "/settings", icon: Settings2 },
    ],
  },
];

const CREATE_ITEMS = [
  { label: "New task", href: "/tasks?new=1", icon: SquarePen },
  { label: "New project", href: "/projects?new=1", icon: FolderPlus },
  { label: "New goal", href: "/goals?new=1", icon: Crosshair },
];

export function NexusShell({
  title,
  subtitle,
  userName,
  username,
  children,
}: {
  title: string;
  subtitle?: string;
  userName: string;
  username?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const createWrapRef = useRef<HTMLDivElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  // Close the Create dropdown on Escape / outside click.
  useEffect(() => {
    if (!createOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCreateOpen(false);
        createButtonRef.current?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!createWrapRef.current?.contains(event.target as Node)) {
        setCreateOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [createOpen]);

  return (
    <main className="min-h-screen bg-bg-base text-text-primary">
      <div className="flex min-h-screen">
        {/* SIDEBAR — desktop only, 248px fixed */}
        <aside className="hidden w-[248px] shrink-0 border-r border-border-subtle bg-bg-subtle p-4 md:flex md:flex-col">
          {/* Logo + Brand — never redrawn, official mark only */}
          <div className="mb-8 flex items-center gap-3 px-3 py-2">
            <NexusLogo size={28} className="text-text-primary" />
            <div>
              <div className="font-semibold text-text-primary tracking-tight text-sm">NEXUS</div>
              <div className="text-xs text-text-tertiary">Personal OS</div>
            </div>
          </div>

          {/* Search / ⌘K — always visible, never a hidden-only shortcut */}
          <div className="mb-6">
            <CommandPalette />
          </div>

          {/* Navigation — grouped, animated active indicator */}
          <nav className="space-y-6" aria-label="Main">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-quaternary">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`
                          group relative flex min-h-11 md:min-h-0 w-full items-center gap-3 rounded-md
                          px-3 py-2 text-sm transition-all duration-[160ms] ease-out
                          ${
                            active
                              ? "bg-bg-surface-2 text-text-primary"
                              : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                          }
                        `}
                      >
                        {/* Animated active indicator — slides in from the left edge */}
                        <span
                          aria-hidden="true"
                          className={`
                            absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-volt
                            transition-all duration-[160ms] ease-out
                            ${
                              active
                                ? "scale-y-100 opacity-100"
                                : "scale-y-0 opacity-0 group-hover:scale-y-50 group-hover:opacity-40"
                            }
                          `}
                        />
                        <Icon
                          size={18}
                          strokeWidth={1.75}
                          className={`shrink-0 transition-colors duration-[160ms] ${
                            active ? "text-text-primary" : "text-text-tertiary group-hover:text-text-secondary"
                          }`}
                        />
                        <span>{item.name}</span>
                        {active ? (
                          <span
                            className="ml-auto h-1.5 w-1.5 rounded-full bg-volt"
                            aria-hidden="true"
                          />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar footer — user section */}
          <div className="mt-auto space-y-2 border-t border-border-subtle pt-4">
            <div className="flex items-center gap-3 rounded-md bg-bg-surface px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-surface-2 text-xs font-medium text-text-primary">
                {userName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-text-primary">{userName}</div>
                {username ? (
                  <div className="truncate text-xs text-text-tertiary">@{username}</div>
                ) : null}
              </div>
            </div>
            <LogoutButton />
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <section className="flex min-w-0 flex-1 flex-col">
          {/* HEADER — the page title is THE h1 of each page */}
          <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-border-subtle bg-bg-base/95 px-6 backdrop-blur md:px-8">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
                Workspace
              </div>
              <h1 className="truncate text-h3 font-semibold text-text-primary">{title}</h1>
            </div>

            <div className="flex items-center gap-2">
              {/* CREATE dropdown — anchored to the trigger, same width,
                  above the sidebar, shadow + scale-in */}
              <div ref={createWrapRef} className="relative">
                <button
                  ref={createButtonRef}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={createOpen}
                  onClick={() => setCreateOpen((open) => !open)}
                  className="flex h-11 w-[132px] items-center justify-between gap-2 rounded-md border border-border-default bg-bg-surface px-3 text-button text-text-primary transition-all duration-[120ms] ease-out hover:border-border-strong hover:bg-bg-surface-2 active:scale-[0.98] md:h-9 md:w-[120px]"
                >
                  <span className="flex items-center gap-2">
                    <Plus size={15} strokeWidth={2} className="text-volt" />
                    Create
                  </span>
                </button>

                {createOpen ? (
                  <div
                    role="menu"
                    aria-label="Create"
                    className="animate-scale-in absolute left-0 top-full z-50 mt-2 w-full min-w-[180px] overflow-hidden rounded-lg border border-border-default bg-bg-surface shadow-md"
                  >
                    {CREATE_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          role="menuitem"
                          href={item.href}
                          onClick={() => setCreateOpen(false)}
                          className="flex min-h-11 items-center gap-3 border-b border-border-subtle px-3 text-left text-body text-text-secondary transition-colors duration-[120ms] last:border-b-0 hover:bg-bg-surface-2 hover:text-text-primary"
                        >
                          <Icon size={15} strokeWidth={1.75} className="text-text-tertiary" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <Link
                href="/settings"
                aria-label="Settings"
                className="hidden h-9 items-center rounded-md px-3 text-sm text-text-secondary transition-all duration-[120ms] ease-out hover:bg-bg-surface hover:text-text-primary sm:flex"
              >
                Settings
              </Link>

              <div
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border-default bg-bg-surface text-sm font-medium text-text-primary"
              >
                {userName.slice(0, 1).toUpperCase()}
              </div>
            </div>
          </header>

          {/* PAGE CONTENT — one container, identical everywhere (optical alignment) */}
          <div className="flex-1 p-6 md:p-8">
            <div className="mx-auto w-full max-w-[1180px]">
              {subtitle ? (
                <p className="mb-6 text-small text-text-secondary">{subtitle}</p>
              ) : (
                <div className="mb-6" />
              )}
              {children}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
