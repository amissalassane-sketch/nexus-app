"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS V3 — PILL TABS
// Container #111111 with 4px padding, active item = white pill.
// ============================================================

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
};

export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-pill border border-border-subtle bg-bg-subtle p-1",
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-2 rounded-pill px-3.5 text-button transition-colors duration-150 ease-nexus",
              active
                ? "bg-accent text-accent-fg"
                : "text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
