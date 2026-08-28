"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — NAVIGATION PRIMITIVES
// Enhanced with motion: active feels anchored, hover reacts
// immediately, pressed feels physical. GPU-friendly transforms.
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
        "group relative flex h-10 items-center gap-2.5 rounded-nav border px-2.5 text-[13px] outline-none transition-[background-color,border-color,color,transform,box-shadow] duration-[160ms] ease-nexus focus-visible:border-border-focus focus-visible:ring-1 focus-visible:ring-lavender-border lg:h-[34px] will-change-transform",
        active
          ? "border-border-subtle bg-accent-ghost-hover font-medium text-text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
          : "border-transparent text-text-secondary hover:border-border-subtle/40 hover:bg-accent-ghost hover:text-text-primary active:bg-accent-ghost-hover active:scale-[0.98]",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-[-9px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-pill bg-lavender transition-[opacity,transform] duration-[220ms] ease-nexus will-change-transform",
          active
            ? "scale-y-100 opacity-90"
            : "scale-y-0 opacity-0 group-hover:opacity-30 group-hover:scale-y-50"
        )}
      />
      <span
        className={cn(
          "shrink-0 transition-[color,transform] duration-[150ms] ease-nexus",
          active
            ? "text-text-primary"
            : "text-text-tertiary group-hover:text-text-secondary group-active:scale-[0.92]"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate transition-transform duration-[150ms] ease-nexus group-active:translate-x-[0.5px]">
        {label}
      </span>
      {count !== undefined && count > 0 ? (
        <span
          className={cn(
            "shrink-0 font-mono text-mono tabular-nums transition-[color,transform,opacity] duration-[200ms] ease-nexus",
            countTone === "accent"
              ? "text-lavender font-medium"
              : "text-text-quaternary",
            active && "text-text-primary"
          )}
        >
          {count}
        </span>
      ) : null}
      {active ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-nav bg-gradient-to-r from-white/[0.04] to-transparent opacity-60"
        />
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
        "relative flex min-h-[46px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-nav py-1.5 outline-none transition-[color,transform,background-color] duration-[160ms] ease-nexus focus-visible:ring-1 focus-visible:ring-lavender-border active:scale-[0.94]",
        active
          ? "font-medium text-text-primary"
          : "text-text-tertiary hover:text-text-secondary active:text-text-primary",
        className
      )}
    >
      <span className="relative transition-transform duration-[160ms] ease-nexus group-active:scale-[0.92]">
        {icon}
        {badge !== undefined && badge > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-pill bg-lavender animate-[signal-pulse_2.6s_var(--ease-nexus)_infinite]"
          />
        ) : null}
      </span>
      <span className="max-w-full truncate text-[11px] leading-none transition-transform duration-[150ms] ease-nexus">
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "absolute -top-px h-[2px] w-8 rounded-pill bg-lavender transition-[opacity,transform] duration-[220ms] ease-nexus will-change-transform",
          active
            ? "opacity-90 scale-x-100"
            : "opacity-0 scale-x-50"
        )}
      />
    </Link>
  );
}
