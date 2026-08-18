import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS V3 — SURFACES
// Cards: radius 16px, bg #111111, border 6-8%. No glass, no glow.
// ============================================================

export function Card({
  children,
  className,
  as: Tag = "div",
  interactive,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-card border border-border-subtle bg-bg-subtle",
        interactive &&
          "transition-colors duration-150 ease-nexus hover:border-border-default hover:bg-bg-surface",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex items-center justify-between gap-3 border-b border-border-subtle pb-2",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {eyebrow ? (
          <>
            <span className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
              {eyebrow}
            </span>
            <span className="font-mono text-mono text-text-quaternary">/</span>
          </>
        ) : null}
        <h2 className="truncate text-h3 text-text-primary">{title}</h2>
      </div>
      {action}
    </div>
  );
}
