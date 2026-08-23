"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — BUTTON SYSTEM
// primary   : white surface, black label — one per screen
// secondary : dark surface + border
// ghost     : transparent
// danger    : muted red, outlined
// icon      : 32x32 square-ish, 8px radius
//
// Every variant implements hover, active, focus-visible, disabled and
// loading. Heights are locked to the control scale (28 / 32 / 36 / 40).
// ============================================================

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-input font-medium transition-[background-color,color,border-color,transform,box-shadow] duration-[140ms] ease-nexus select-none disabled:pointer-events-none disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover active:translate-y-px disabled:bg-bg-surface-2 disabled:text-text-quaternary",
  secondary:
    "border border-border-default bg-bg-surface/60 text-text-secondary hover:border-border-strong hover:bg-bg-surface hover:text-text-primary active:translate-y-px disabled:opacity-40",
  ghost:
    "bg-transparent text-text-secondary hover:bg-accent-ghost hover:text-text-primary active:translate-y-px disabled:opacity-40",
  danger:
    "border border-danger-border bg-transparent text-danger hover:bg-danger-bg active:translate-y-px disabled:opacity-40",
  icon: "h-8 w-8 shrink-0 bg-transparent text-text-tertiary hover:bg-accent-ghost hover:text-text-primary disabled:opacity-40",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-caption",
  sm: "h-8 px-3 text-caption",
  md: "h-9 px-3.5 text-button",
  lg: "h-10 px-4 text-button",
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

function Spinner() {
  return (
    <svg
      className="absolute h-3.5 w-3.5 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.6"
      />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows an inline spinner, keeps the label width and blocks interaction. */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading ? <Spinner /> : null}
      <span
        className={cn(
          "inline-flex items-center gap-2",
          loading && "opacity-0"
        )}
      >
        {children}
      </span>
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ref,
  ...props
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  /** React 19 forwards refs through props — used by callers that need
   *  the rendered anchor (e.g. to measure it for a motion effect). */
  ref?: React.Ref<HTMLAnchorElement>;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "ref">) {
  return (
    <Link
      href={href}
      ref={ref}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {children}
    </Link>
  );
}

/** Square icon-only control with a required accessible name. */
export function IconButton({
  label,
  size = "md",
  className,
  children,
  ...props
}: {
  label: string;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        base,
        "shrink-0 bg-transparent text-text-tertiary hover:bg-accent-ghost hover:text-text-primary disabled:opacity-40",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
