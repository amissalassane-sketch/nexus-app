"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
};

// ============================================================
// NEXUS — SEGMENTED CONTROL (canonical)
// ============================================================
// One segmented control for view switching everywhere (task views, board
// views, calendar ranges, capture stages, settings sections).
//
//   track    L1 chrome surface, hairline, 8px radius
//   segment  28px desktop / 32px touch, 6px inner radius
//   active   raise surface + primary label — position is the signal,
//            never a glow, never an inverted (white) segment
//
// Below 480px the control scrolls horizontally rather than wrapping:
// wrapping changes its height and moves the content under the thumb.
// ============================================================

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
  size = "md",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-control border border-border-subtle bg-bg-subtle p-0.5",
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
              "inline-flex shrink-0 items-center gap-1.5 rounded-[6px] px-2.5 text-button transition-[background-color,color] duration-[120ms] ease-nexus outline-none focus-visible:ring-1 focus-visible:ring-lavender-border",
              size === "sm" ? "h-6" : "h-8 sm:h-7",
              active
                ? "bg-bg-surface-2 text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            )}
          >
            {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** @deprecated Use SegmentedControl — kept for existing imports. */
export const PillTabs = SegmentedControl;
