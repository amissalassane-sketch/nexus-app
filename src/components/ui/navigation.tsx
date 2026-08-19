"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — NAVIGATION PRIMITIVES
// SectionLabel + NavItem + RailItem, shared by the rail, the workspace
// sidebar and the mobile drawer. One definition, one behaviour.
// ============================================================

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1.5 pt-4 font-mono text-mono uppercase tracking-[0.1em] text-text-quaternary">
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
        "group flex h-8 items-center gap-2.5 rounded-nav px-2.5 text-[13px] transition-colors duration-150 ease-nexus",
        active
          ? "bg-accent-ghost-hover font-medium text-text-primary"
          : "text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
      )}
    >
      <span
        className={cn(
          "shrink-0 transition-colors duration-150",
          active ? "text-text-primary" : "text-text-tertiary group-hover:text-text-secondary"
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

export function RailItem({
  href,
  label,
  icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-nav transition-colors duration-150 ease-nexus",
        active
          ? "bg-accent-ghost-hover text-text-primary"
          : "text-text-tertiary hover:bg-accent-ghost hover:text-text-secondary"
      )}
    >
      {icon}
      {badge !== undefined && badge > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-pill bg-lavender"
        />
      ) : null}
    </Link>
  );
}
