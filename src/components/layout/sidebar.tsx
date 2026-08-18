"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CheckSquare,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  Settings2,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoutButton } from "@/components/logout-button";
import { NexusWordmark } from "@/components/nexus-logo";

// ============================================================
// NEXUS V3 — SIDEBAR
// 220px, transparent, no heavy right border, padding 16px 12px.
// Items: 32px, radius 10px, icon 18px, text 13px.
// Active: white background, #0A0A0A text, weight 500.
// Mobile: same list inside a slide-in drawer.
// ============================================================

export const NAVIGATION = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Settings", href: "/settings", icon: Settings2 },
];

const SECONDARY = [
  { name: "Billing", href: "/settings/billing", icon: CreditCard },
  { name: "Upgrade", href: "/upgrade", icon: Sparkles },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const renderItem = (item: {
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
  }) => {
    const active =
      pathname === item.href ||
      (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
    const Icon = item.icon;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-8 items-center gap-2.5 rounded-nav px-2.5 text-[13px] transition-colors duration-150 ease-nexus",
            active
              ? "bg-accent font-medium text-accent-fg"
              : "text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
          )}
        >
          <Icon size={18} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">{item.name}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-0.5">{NAVIGATION.map(renderItem)}</ul>
      <div className="my-3 h-px bg-border-subtle" aria-hidden="true" />
      <ul className="flex flex-col gap-0.5">{SECONDARY.map(renderItem)}</ul>
    </nav>
  );
}

export function Sidebar({
  userName,
  username,
}: {
  userName: string;
  username?: string;
}) {
  return (
    <aside className="fixed left-0 top-14 hidden h-[calc(100vh-56px)] w-[220px] flex-col px-3 py-4 md:flex">
      <NavList />

      <div className="mt-auto">
        <div className="rounded-nav px-2.5 py-2">
          <p className="truncate text-small text-text-primary">{userName}</p>
          {username ? (
            <p className="truncate font-mono text-mono text-text-tertiary">
              @{username}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({
  open,
  onClose,
  userName,
  username,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  username?: string;
}) {
  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 animate-fade-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-border-subtle bg-bg-base px-3 py-4 animate-scale-in"
      >
        <div className="mb-4 flex items-center justify-between px-1.5">
          <NexusWordmark size={28} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-8 w-8 items-center justify-center rounded-pill text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <NavList onNavigate={onClose} />

        <div className="mt-auto space-y-2">
          <div className="rounded-nav px-2.5 py-2">
            <p className="truncate text-small text-text-primary">{userName}</p>
            {username ? (
              <p className="truncate font-mono text-mono text-text-tertiary">
                @{username}
              </p>
            ) : null}
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
