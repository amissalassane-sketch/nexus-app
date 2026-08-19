"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS V3 — CREATE BUTTON
// 36px height, pill, white bg, black fg,
// padding 4px 14px 4px 4px, internal 28x28 lavender badge (#EDE8FF),
// 16px plus icon, label 13px/500.
// Variants: Create · New Task · New Project · New Goal
// ============================================================

const shell =
  "group inline-flex h-9 items-center gap-2.5 rounded-pill bg-accent py-1 pl-1 pr-3.5 text-button font-medium text-accent-fg transition-[background-color,transform] duration-150 ease-nexus hover:bg-accent-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

function Badge({ icon }: { icon?: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-accent-badge text-accent-fg"
    >
      {icon ?? <Plus size={16} strokeWidth={1.75} />}
    </span>
  );
}

export function CreateButton({
  label = "Create",
  onClick,
  icon,
  className,
  disabled,
  ariaLabel,
  ...rest
}: {
  label?: string;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "className">) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className={cn(shell, className)}
      {...rest}
    >
      <Badge icon={icon} />
      <span>{label}</span>
    </button>
  );
}

export function CreateButtonLink({
  href,
  label = "Create",
  icon,
  className,
}: {
  href: string;
  label?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(shell, className)}>
      <Badge icon={icon} />
      <span>{label}</span>
    </Link>
  );
}

/** Trigger used inside a Dropdown (same visual structure, forwarded ref). */
export function CreateButtonTrigger({
  label = "Create",
  triggerRef,
  className,
  ...props
}: {
  label?: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      ref={triggerRef}
      className={cn(shell, className)}
      {...props}
    >
      <Badge />
      <span>{label}</span>
    </button>
  );
}
