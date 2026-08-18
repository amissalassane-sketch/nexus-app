"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  FolderKanban,
  Bell,
  Settings2,
} from "lucide-react";
import { NexusLogo } from "@/components/nexus-logo";
import { LogoutButton } from "@/components/logout-button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Settings", href: "/settings", icon: Settings2 },
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

  return (
    <main className="min-h-screen bg-bg-base text-text-primary">
      <div className="flex min-h-screen">
        {/* SIDEBAR — Desktop only, 248px fixed */}
        <aside className="hidden w-[248px] shrink-0 border-r border-border-subtle bg-bg-subtle p-4 md:flex md:flex-col">
          {/* Logo + Brand */}
          <div className="mb-8 flex items-center gap-3 px-3 py-2">
            <NexusLogo size={28} className="text-text-primary" />
            <div>
              <div className="font-semibold text-text-primary tracking-tight text-sm">NEXUS</div>
              <div className="text-xs text-text-tertiary">Personal OS</div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {navigation.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm
                    transition duration-120
                    ${
                      active
                        ? "bg-bg-surface-2 text-text-primary"
                        : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                    }
                  `}
                >
                  <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                  <span>{item.name}</span>
                  {active && (
                    <div className="ml-auto h-2 w-2 rounded-full bg-volt" aria-hidden="true" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer — User section */}
          <div className="mt-auto space-y-2 border-t border-border-subtle pt-4">
            <div className="rounded-md bg-bg-surface px-3 py-2 text-sm">
              <div className="font-medium text-text-primary">{userName}</div>
              {username && <div className="text-xs text-text-tertiary">@{username}</div>}
            </div>
            <LogoutButton />
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <section className="flex min-w-0 flex-1 flex-col">
          {/* HEADER */}
          <header className="flex h-16 items-center justify-between border-b border-border-subtle px-6 md:px-8">
            <div>
              <div className="text-xs text-text-tertiary uppercase tracking-wide">Workspace</div>
              <div className="font-medium text-text-primary">{title}</div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/settings"
                className="rounded-md px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-surface hover:text-text-primary"
              >
                Settings
              </Link>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-surface text-sm font-medium text-text-primary">
                {userName.slice(0, 1).toUpperCase()}
              </div>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <div className="flex-1 p-6 md:p-8">
            {subtitle ? (
              <div className="mb-6">
                <p className="text-sm text-text-secondary">{subtitle}</p>
              </div>
            ) : null}
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
