"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS V3 — BUTTON
// Primary  : white pill, black text
// Secondary: transparent + border 8%
// Ghost    : transparent, hover 6%
// Danger   : desaturated red, outlined
// Icon     : 32x32 round
// ============================================================

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,border-color,transform] duration-150 ease-nexus disabled:pointer-events-none disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  primary:
    "rounded-pill bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.98]",
  secondary:
    "rounded-pill border border-border-default bg-transparent text-text-secondary hover:bg-accent-ghost hover:text-text-primary",
  ghost:
    "rounded-pill bg-transparent text-text-secondary hover:bg-accent-ghost hover:text-text-primary",
  danger:
    "rounded-pill border border-danger-border bg-transparent text-danger hover:bg-danger-bg",
  icon: "h-8 w-8 rounded-pill bg-transparent text-text-secondary hover:bg-accent-ghost hover:text-text-primary",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-caption",
  md: "h-9 px-4 text-button",
  lg: "h-11 px-5 text-button",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(base, variants[variant], variant !== "icon" && sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link
      href={href}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {children}
    </Link>
  );
}
