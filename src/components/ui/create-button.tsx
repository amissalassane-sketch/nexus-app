"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — CREATE BUTTON
// The single primary action of a page: 36px, 8px radius, white surface.
// Same geometry as Button/primary so headers stay on one baseline.
// ============================================================

const shell =
  "group inline-flex h-9 items-center gap-2 rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-[background-color,transform] duration-[140ms] ease-nexus hover:bg-accent-hover active:translate-y-px disabled:pointer-events-none disabled:opacity-40";

function Badge({ icon }: { icon?: ReactNode }) {
  return (
    <span aria-hidden="true" className="shrink-0">
      {icon ?? <Plus size={15} strokeWidth={2} />}
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
