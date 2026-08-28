"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

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
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-input border border-border-subtle bg-bg-subtle p-1 transition-colors duration-200 ease-nexus",
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
              "inline-flex h-7 shrink-0 items-center gap-2 rounded-[6px] px-3 text-button transition-[background-color,color,transform,box-shadow] duration-[160ms] ease-nexus will-change-transform active:scale-[0.96]",
              active
                ? "bg-accent-ghost-hover text-text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                : "text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
            )}
          >
            {item.icon ? <span className="transition-transform duration-150 ease-nexus">{item.icon}</span> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
