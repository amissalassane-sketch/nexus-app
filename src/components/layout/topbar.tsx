"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  IconChevronRight,
  IconCreditCard,
  IconKey,
  IconLifebuoy,
  IconLogout,
  IconSearch,
  IconSettings,
  IconShield,
  IconUser,
  IconUserCheck,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
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
import { NotificationPreview } from "@/components/notification-preview";

export function Topbar({
  user,
  workspace,
  unreadCount,
  userId,
  workspaceId,
  isPlatformAdmin,
  solidBackground,
  onOpenProfileModal,
  onOpenHelp,
}: {
  user: ShellUser;
  workspace: ShellWorkspace;
  unreadCount: number;
  userId: string;
  workspaceId: string | null;
  /** Verified server-side (platform_admin_context). When false the Admin
      entry is not rendered at all — it never appears in the HTML for a
      regular user. The /admin server guard stays the real protection. */
  isPlatformAdmin: boolean;
  /** Dashboard route only: opaque pure-black bar, no translucency. */
  solidBackground?: boolean;
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
    <header
      data-dashboard-chrome="topbar"
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4 sm:px-6 transition-[border-color,background-color] duration-200 ease-nexus sticky-nav",
        solidBackground && "bg-[#000000]"
      )}
    >
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb} className="flex min-w-0 items-center gap-1.5">
                {index > 0 ? (
                  <NexusIcon icon={IconChevronRight} px={14} className="text-text-quaternary transition-transform duration-150 ease-nexus" />
                ) : null}
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn(
                    "truncate text-[13px] transition-[color,opacity,transform] duration-[200ms] ease-nexus",
                    last ? "font-medium text-text-primary animate-[intelligence-state-in_200ms_var(--ease-nexus)_both]" : "text-text-tertiary"
                  )}
                >
                  {crumb}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("nexus:open-command"))}
        aria-label="Search NEXUS, command palette"
        className="hidden h-8 w-[260px] items-center gap-2 rounded-nav border border-border-subtle bg-bg-surface/40 px-2.5 text-left text-[12.5px] text-text-tertiary transition-[border-color,background-color,color,transform] duration-150 ease-nexus hover:border-border-default hover:bg-bg-surface hover:text-text-secondary active:scale-[0.98] md:flex xl:w-[320px] will-change-transform"
      >
        <NexusIcon icon={IconSearch} className="transition-transform duration-150 ease-nexus group-hover:scale-105" />
        <span className="min-w-0 flex-1 truncate">Search NEXUS…</span>
        <kbd className="shrink-0 rounded-[4px] border border-border-subtle px-1 font-mono text-[10px] leading-[15px] text-text-quaternary"> {commandKey} </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <span className="hidden items-center gap-1.5 rounded-pill border border-border-subtle px-2 py-1 transition-colors duration-200 ease-nexus hover:border-border-default lg:inline-flex">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-success animate-[signal-pulse_2.6s_var(--ease-nexus)_infinite]" />
          <span className="eyebrow text-text-tertiary">Observing</span>
        </span>

        <NotificationPreview
          userId={userId}
          workspaceId={workspaceId}
          unreadCount={unreadCount}
        />

        <button
          type="button"
          onClick={onOpenHelp}
          aria-label="NEXUS Guide and help"
          data-guide="help-button"
          className="flex h-8 w-8 items-center justify-center rounded-nav text-text-tertiary outline-none transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:scale-[0.9] focus-visible:ring-1 focus-visible:ring-lavender-border will-change-transform"
        >
          <NexusIcon icon={IconLifebuoy} size="toolbar" />
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
              aria-label={hasName ? `Account: ${user.name}` : "Account: complete profile"}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-pill border border-border-default bg-bg-surface-2 text-[11px] font-semibold text-text-primary outline-none transition-[border-color,background-color,transform] duration-150 ease-nexus hover:border-border-strong active:scale-[0.9] focus-visible:ring-1 focus-visible:ring-lavender-border will-change-transform"
              {...ariaProps}
            >
              {hasName ? initial : <NexusIcon icon={IconUser} />}
            </button>
          )}
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-body-medium text-text-primary">{hasName ? user.name : "Complete profile"}</p>
            <p className="truncate font-mono text-mono text-text-tertiary">{user.email ?? (user.username ? `@${user.username}` : "")}</p>
          </div>
          <DropdownSeparator />
          {!user.profileComplete && onOpenProfileModal ? (
            <DropdownItem icon={<NexusIcon icon={IconUserCheck} />} onSelect={() => onOpenProfileModal()}>
              Complete profile
            </DropdownItem>
          ) : null}
          <DropdownLink href="/settings?tab=profile" icon={<NexusIcon icon={IconUser} />}>
            Profile
          </DropdownLink>
          <DropdownLink href="/settings?tab=account" icon={<NexusIcon icon={IconKey} />}>
            Security
          </DropdownLink>
          <DropdownLink href="/settings?tab=workspace" icon={<NexusIcon icon={IconSettings} />}>
            {workspace.name ? `${workspace.name} settings` : "Workspace settings"}
          </DropdownLink>
          <DropdownLink href="/settings/billing" icon={<NexusIcon icon={IconCreditCard} />}>
            Billing
          </DropdownLink>
          {isPlatformAdmin ? (
            <>
              <DropdownSeparator />
              <DropdownLink href="/admin" icon={<NexusIcon icon={IconShield} />}>
                Admin
              </DropdownLink>
            </>
          ) : null}
          <DropdownSeparator />
          <DropdownItem icon={<NexusIcon icon={IconLogout} />} onSelect={() => void handleLogout()}>
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
