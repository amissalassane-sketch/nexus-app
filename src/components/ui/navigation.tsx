"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — NAVIGATION PRIMITIVES (canonical)
// ============================================================
// Sidebar item: one geometry for every destination.
//   44px on touch / 32px on desktop (laptop pointer) — dense, but never
//   below the touch target when a finger is the input device.
//   Resting  transparent
//   Hover    accent-ghost wash, label steps up
//   Active   L3 raise surface + primary label + the 2px lavender rail
//
// The rail is the only lavender in the chrome. It marks "this is where
// you are" and nothing else.
// ============================================================

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="eyebrow px-2.5 pt-5 pb-1.5 text-text-quaternary select-none">
      {children}
    </p>
  );
}

export function NavItem({
  href,
  label,
  icon,
  active,
  count,
  countTone = "muted",
  onNavigate,
  className,
  ...rest
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  count?: number;
  countTone?: "muted" | "accent";
  onNavigate?: () => void;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      {...rest}
      className={cn(
        "group relative flex h-11 items-center gap-2.5 rounded-control px-2.5 text-[13px] outline-none transition-[background-color,color] duration-[120ms] ease-nexus focus-visible:ring-1 focus-visible:ring-lavender-border lg:h-8",
        active
          ? "bg-bg-surface-2 font-medium text-text-primary"
          : "text-text-secondary hover:bg-accent-ghost hover:text-text-primary",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute -left-2 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-pill bg-lavender transition-opacity duration-[160ms] ease-nexus",
          active ? "opacity-90" : "opacity-0"
        )}
      />
      <span
        className={cn(
          "shrink-0 transition-colors duration-[120ms] ease-nexus",
          active
            ? "text-text-primary"
            : "text-text-tertiary group-hover:text-text-secondary"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 ? (
        <span
          className={cn(
            "mono-meta shrink-0 transition-colors duration-[120ms] ease-nexus",
            countTone === "accent" ? "text-lavender" : "text-text-quaternary",
            active && "text-text-secondary"
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/** Compact bottom-navigation item used below `lg`. */
export function MobileNavItem({
  href,
  label,
  icon,
  active,
  badge,
  onNavigate,
  className,
  ...rest
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  badge?: number;
  onNavigate?: () => void;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      {...rest}
      className={cn(
        // 56px: the bottom-nav height from the platform comparatif
        // (iOS tab bar 56 / Android bottom nav 56). The platform-specific
        // parts below it — iOS home indicator 34pt, Android system nav
        // 48px — come from env(safe-area-inset-bottom) on the bar
        // container, never from the bar itself.
        "relative flex min-h-(--chrome-tab-bar) min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-control py-1.5 outline-none transition-[color,background-color] duration-[120ms] ease-nexus focus-visible:ring-1 focus-visible:ring-lavender-border active:bg-accent-ghost",
        active ? "font-medium text-text-primary" : "text-text-tertiary",
        className
      )}
    >
      <span className="relative">
        {icon}
        {badge !== undefined && badge > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-1 h-1.5 w-1.5 rounded-pill bg-lavender"
          />
        ) : null}
      </span>
      <span className="max-w-full truncate text-[11px] leading-none">
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "absolute -top-px h-0.5 w-8 rounded-pill bg-lavender transition-opacity duration-[160ms] ease-nexus",
          active ? "opacity-90" : "opacity-0"
        )}
      />
    </Link>
  );
}
