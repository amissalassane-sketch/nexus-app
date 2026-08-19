"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckSquare,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
import { NexusLogo } from "@/components/nexus-logo";
import { RailItem } from "@/components/ui/navigation";

// ============================================================
// NEXUS — LEVEL 1 NAVIGATION (RAIL)
// 56px, global destinations only, icons + tooltips.
// Settings sits in its own group at the bottom.
// ============================================================

export const RAIL_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

const RAIL_BOTTOM = [
  { href: "/upgrade", label: "Upgrade", icon: Sparkles },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppRail({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/settings" && pathname.startsWith(`${href}/`));

  return (
    <aside
      aria-label="Global navigation"
      className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-border-subtle bg-bg-subtle py-3 lg:flex"
    >
      <Link
        href="/dashboard"
        aria-label="NEXUS — Dashboard"
        className="mb-2 flex h-9 w-9 items-center justify-center rounded-nav"
      >
        <NexusLogo size={26} priority />
      </Link>

      <nav aria-label="Sections" className="flex flex-col items-center gap-1">
        {RAIL_ITEMS.map((item) => (
          <RailItem
            key={item.href}
            href={item.href}
            label={item.label}
            active={isActive(item.href)}
            badge={item.href === "/notifications" ? unreadCount : undefined}
            icon={<item.icon size={18} strokeWidth={1.75} />}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1">
        <span className="mb-1 h-px w-6 bg-border-subtle" aria-hidden="true" />
        {RAIL_BOTTOM.map((item) => (
          <RailItem
            key={item.href}
            href={item.href}
            label={item.label}
            active={pathname === item.href}
            icon={<item.icon size={18} strokeWidth={1.75} />}
          />
        ))}
      </div>
    </aside>
  );
}
