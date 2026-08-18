"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CheckSquare,
  FolderKanban,
  LogOut,
  Menu,
  Settings2,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import { NexusWordmark } from "@/components/nexus-logo";
import { CreateButtonTrigger } from "@/components/ui/create-button";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownLink,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// NEXUS V3 — TOP BAR
// 56px, fixed, #0A0A0A/80 + 12px blur, bottom border 6%.
// Left: locked logo 28px + wordmark. Right: Create pill + avatar menu.
// ============================================================

export function TopBar({
  userName,
  username,
  pageTitle,
  onOpenNav,
}: {
  userName: string;
  username?: string;
  pageTitle?: string;
  onOpenNav: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error.message);
      return;
    }

    router.push("/login");
    router.refresh();
  };

  const initial = (userName || "U").trim().slice(0, 1).toUpperCase();

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border-subtle bg-bg-base/80 px-4 backdrop-blur-[12px]">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="flex h-8 w-8 items-center justify-center rounded-pill text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary md:hidden"
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>

        <Link
          href="/dashboard"
          className="flex items-center rounded-nav"
          aria-label="NEXUS — Dashboard"
        >
          <NexusWordmark size={28} priority />
        </Link>

        {pageTitle ? (
          <span className="hidden min-w-0 items-center gap-2 sm:flex">
            <span className="font-mono text-mono text-text-quaternary" aria-hidden="true">
              /
            </span>
            <span className="truncate text-small text-text-secondary">{pageTitle}</span>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Dropdown
          label="Create"
          width={280}
          trigger={({ toggle, ref, ariaProps }) => (
            <CreateButtonTrigger
              label="Create"
              triggerRef={ref}
              onClick={toggle}
              {...ariaProps}
            />
          )}
        >
          <DropdownLabel>Create</DropdownLabel>
          <DropdownLink
            href="/tasks?create=1"
            icon={<CheckSquare size={16} strokeWidth={1.75} />}
            active={pathname === "/tasks"}
          >
            New Task
          </DropdownLink>
          <DropdownLink
            href="/projects?create=1"
            icon={<FolderKanban size={16} strokeWidth={1.75} />}
            active={pathname === "/projects"}
          >
            New Project
          </DropdownLink>
          <DropdownLink
            href="/goals?create=1"
            icon={<Target size={16} strokeWidth={1.75} />}
            active={pathname === "/goals"}
          >
            New Goal
          </DropdownLink>
        </Dropdown>

        <Dropdown
          label="Account"
          width={240}
          trigger={({ toggle, ref, ariaProps }) => (
            <button
              type="button"
              ref={ref}
              onClick={toggle}
              aria-label={`Account menu — ${userName}`}
              className="flex h-8 w-8 items-center justify-center rounded-pill border border-border-subtle bg-bg-surface text-caption font-medium text-text-primary transition-colors duration-150 ease-nexus hover:border-border-strong"
              {...ariaProps}
            >
              {initial}
            </button>
          )}
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-body-medium text-text-primary">{userName}</p>
            {username ? (
              <p className="truncate font-mono text-mono text-text-tertiary">
                @{username}
              </p>
            ) : null}
          </div>
          <DropdownSeparator />
          <DropdownLink
            href="/settings"
            icon={<User size={16} strokeWidth={1.75} />}
            active={pathname === "/settings"}
          >
            Profile
          </DropdownLink>
          <DropdownLink
            href="/settings"
            icon={<Settings2 size={16} strokeWidth={1.75} />}
          >
            Settings
          </DropdownLink>
          <DropdownLink
            href="/notifications"
            icon={<Bell size={16} strokeWidth={1.75} />}
            active={pathname === "/notifications"}
          >
            Notifications
          </DropdownLink>
          <DropdownLink
            href="/upgrade"
            icon={<Sparkles size={16} strokeWidth={1.75} />}
            active={pathname === "/upgrade"}
          >
            Upgrade
          </DropdownLink>
          <DropdownSeparator />
          <DropdownItem
            icon={<LogOut size={16} strokeWidth={1.75} />}
            onSelect={() => void handleLogout()}
          >
            Log out
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
