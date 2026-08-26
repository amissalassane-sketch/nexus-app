"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  CreditCard,
  KeyRound,
  LifeBuoy,
  LogOut,
  Search,
  Settings2,
  User,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { useCommandKeyLabel } from "@/hooks/use-command-key";
import {
  Dropdown,
  DropdownItem,
  DropdownLink,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { breadcrumbFor } from "@/components/layout/nav-config";
import type { ShellUser, ShellWorkspace } from "@/components/layout/workspace-sidebar";

// ============================================================
// NEXUS — TOP BAR
// Left: contextual breadcrumb. Centre: the command interface.
// Right: workspace status, notifications, help, account.
// ============================================================

export function Topbar({
  user,
  workspace,
  unreadCount,
  onOpenProfileModal,
  onOpenHelp,
}: {
  user: ShellUser;
  workspace: ShellWorkspace;
  unreadCount: number;
  /** Opens the optional profile completion modal (account menu entry). */
  onOpenProfileModal?: () => void;
  onOpenHelp?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = breadcrumbFor(pathname);
  const hasName = Boolean(user.name?.trim());
  const initial = (user.name ?? "").trim().slice(0, 1).toUpperCase();
  const commandKey = useCommandKeyLabel();

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

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4 sm:px-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb} className="flex min-w-0 items-center gap-1.5">
                {index > 0 ? (
                  <ChevronRight
                    size={13}
                    strokeWidth={1.75}
                    className="shrink-0 text-text-quaternary"
                    aria-hidden="true"
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

      {/* Command interface */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("nexus:open-command"))}
        aria-label="Search NEXUS — Command palette"
        className="hidden h-8 w-[260px] items-center gap-2 rounded-nav border border-border-subtle bg-bg-surface/40 px-2.5 text-left text-[12.5px] text-text-tertiary transition-colors duration-150 ease-nexus hover:border-border-default hover:bg-bg-surface hover:text-text-secondary md:flex xl:w-[320px]"
      >
        <Search size={14} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">Search NEXUS…</span>
        <kbd className="shrink-0 rounded-[4px] border border-border-subtle px-1 font-mono text-[10px] leading-[15px] text-text-quaternary">
          {commandKey}
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        {/* Workspace status — reflects the real signal state of the shell */}
        <span
          className="hidden items-center gap-1.5 rounded-pill border border-border-subtle px-2 py-1 lg:inline-flex"
          title="NEXUS is watching this workspace"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-pill bg-success signal-pulse"
          />
          <span className="eyebrow text-text-tertiary">Observing</span>
        </span>

        <Link
          href="/notifications"
          aria-label={
            unreadCount > 0
              ? `Notifications — ${unreadCount} unread`
              : "Notifications"
          }
          className="relative flex h-8 w-8 items-center justify-center rounded-nav text-text-tertiary outline-none transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary focus-visible:ring-1 focus-visible:ring-lavender-border"
        >
          <Bell size={15} strokeWidth={1.75} aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-pill bg-lavender"
            />
          ) : null}
        </Link>

        <button
          type="button"
          onClick={onOpenHelp}
          aria-label="NEXUS Guide and help"
          data-guide="help-button"
          className="flex h-8 w-8 items-center justify-center rounded-nav text-text-tertiary outline-none transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary focus-visible:ring-1 focus-visible:ring-lavender-border"
        >
          <LifeBuoy size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>

        <Dropdown
          label="Account"
          align="end"
          width={248}
          trigger={({ toggle, ref, ariaProps }) => (
            <button
              type="button"
              ref={ref}
              onClick={toggle}
              aria-label={
                hasName ? `Account — ${user.name}` : "Account — complete profile"
              }
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-pill border border-border-default bg-bg-surface-2 text-[11px] font-semibold text-text-primary outline-none transition-colors duration-150 ease-nexus hover:border-border-strong focus-visible:ring-1 focus-visible:ring-lavender-border"
              {...ariaProps}
            >
              {hasName ? (
                initial
              ) : (
                <UserRound size={13} strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          )}
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-body-medium text-text-primary">
              {hasName ? user.name : "Complete profile"}
            </p>
            <p className="truncate font-mono text-mono text-text-tertiary">
              {user.email ?? (user.username ? `@${user.username}` : "")}
            </p>
          </div>
          <DropdownSeparator />
          {!user.profileComplete && onOpenProfileModal ? (
            <DropdownItem
              icon={<UserRoundCheck size={15} strokeWidth={1.75} />}
              onSelect={() => onOpenProfileModal()}
            >
              Complete profile
            </DropdownItem>
          ) : null}
          <DropdownLink
            href="/settings?tab=profile"
            icon={<User size={15} strokeWidth={1.75} />}
          >
            Profile
          </DropdownLink>
          <DropdownLink
            href="/settings?tab=account"
            icon={<KeyRound size={15} strokeWidth={1.75} />}
          >
            Security
          </DropdownLink>
          <DropdownLink
            href="/settings?tab=workspace"
            icon={<Settings2 size={15} strokeWidth={1.75} />}
          >
            {workspace.name ? `${workspace.name} settings` : "Workspace settings"}
          </DropdownLink>
          <DropdownLink
            href="/settings/billing"
            icon={<CreditCard size={15} strokeWidth={1.75} />}
          >
            Billing
          </DropdownLink>
          <DropdownSeparator />
          <DropdownItem
            icon={<LogOut size={15} strokeWidth={1.75} />}
            onSelect={() => void handleLogout()}
          >
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
