"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — NAVIGATION PRIMITIVES
// SectionLabel + NavItem, shared by the sidebar, the mobile drawer and
// the settings navigation. One definition, one behaviour.
//
// Active state = subtle surface + subtle border + white text + brighter
// icon + a 2px intelligence accent. Inactive = muted text and icon.
// ============================================================

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="eyebrow px-2.5 pb-1.5 pt-5 text-text-quaternary select-none">
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
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  count?: number;
  countTone?: "muted" | "accent";
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-[34px] items-center gap-2.5 rounded-nav border px-2.5 text-[13px] transition-colors duration-150 ease-nexus",
        active
          ? "border-border-subtle bg-accent-ghost-hover font-medium text-text-primary"
          : "border-transparent text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-[-9px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-pill bg-lavender transition-[opacity,transform] duration-[200ms] ease-nexus",
          active ? "scale-y-100 opacity-90" : "scale-y-0 opacity-0"
        )}
      />
      <span
        className={cn(
          "shrink-0 transition-colors duration-150",
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
            "shrink-0 font-mono text-mono tabular-nums",
            countTone === "accent" ? "text-lavender" : "text-text-quaternary"
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/** Compact bottom-navigation item used below `md`. */
export function MobileNavItem({
  href,
  label,
  icon,
  active,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-nav py-1.5 transition-colors duration-150 ease-nexus",
        active ? "text-text-primary" : "text-text-tertiary"
      )}
    >
      <span className="relative">
        {icon}
        {badge !== undefined && badge > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-pill bg-lavender"
          />
        ) : null}
      </span>
      <span className="max-w-full truncate text-[10.5px] leading-none">{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "absolute -top-px h-[2px] w-8 rounded-pill bg-lavender transition-opacity duration-150",
          active ? "opacity-80" : "opacity-0"
        )}
      />
    </Link>
  );
}
