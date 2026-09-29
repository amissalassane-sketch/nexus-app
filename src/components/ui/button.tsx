"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { SlideLabel } from "./slide-label";

// ============================================================
// NEXUS — BUTTON SYSTEM (canonical)
// ============================================================
// One button primitive for the whole operating system. Variants express
// role, never decoration:
//
//   primary       white surface, black label — the single decisive action
//                 of a screen (one per view, not one per panel)
//   secondary     hairline + raised surface — the ordinary action
//   ghost         transparent until intent — tertiary / toolbar actions
//   intelligence  lavender hairline + lavender label — actions NEXUS
//                 itself proposes. The AI layer's only button. It is a
//                 hairline and a label, never a fill and never a glow.
//   danger        danger hairline, quiet until hover (destructive, gated)
//   icon          square, transparent until intent
//
// Three of those recipes also carry the slide interaction (label swap on
// hover / keyboard focus) and otherwise look exactly like their base
// variant — same surface, border, radius, focus ring, disabled state:
//
//   slide              = primary  + slide
//   slide-ghost        = ghost    + slide
//   slide-intelligence = intelligence + slide
//
// They exist for high-intent navigation and entry CTAs only (see the
// SlideLabel header for the two call shapes). Everything else in the
// control plane keeps a still label on purpose: the reveal is worth
// something precisely because it is rare.
//
// Geometry is the control ladder: 28 / 32 / 36 / 40px, radius 8 (control).
// Touch devices get one step more height below `sm` (44px target for the
// primary reach actions), per the mobile invariants.
//
// Motion budget: background / border / colour in 90–140ms, and a 1px
// press translate. No scale bounce, no glow, no shimmer.
// ============================================================

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "intelligence"
  | "danger"
  | "icon"
  | "slide"
  | "slide-ghost"
  | "slide-intelligence";

/** The variants that own the slide interaction. Used by the callers that
 *  need to know whether a label is expected to move. */
export const SLIDE_VARIANTS: readonly ButtonVariant[] = [
  "slide",
  "slide-ghost",
  "slide-intelligence",
];

export function isSlideVariant(variant: ButtonVariant): boolean {
  return SLIDE_VARIANTS.includes(variant);
}
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const base =
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-[background-color,color,border-color,opacity] duration-[120ms] ease-nexus select-none outline-none focus-visible:ring-1 focus-visible:ring-lavender-border disabled:pointer-events-none disabled:cursor-not-allowed active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-accent text-accent-fg hover:bg-accent-hover disabled:bg-bg-surface-2 disabled:text-text-quaternary",
  secondary:
    "border border-border-default bg-bg-surface-2 text-text-secondary hover:border-border-strong hover:text-text-primary disabled:border-border-subtle disabled:text-text-quaternary",
  ghost:
    "border border-transparent text-text-secondary hover:bg-accent-ghost hover:text-text-primary disabled:text-text-quaternary",
  intelligence:
    "border border-lavender-border bg-lavender-subtle text-lavender hover:border-lavender/50 hover:bg-lavender/[0.14] disabled:border-border-subtle disabled:bg-transparent disabled:text-text-quaternary",
  danger:
    "border border-danger-border bg-transparent text-danger hover:bg-danger-bg disabled:border-border-subtle disabled:text-text-quaternary",
  // 44px hit area on touch screens, 32px where a precise pointer exists.
  icon: "h-11 w-11 border border-transparent bg-transparent text-text-tertiary hover:bg-accent-ghost hover:text-text-primary sm:h-8 sm:w-8",
  // Slide variants: the base recipe, unchanged, plus the `group/slide`
  // marker the stylesheet hooks the reveal on — named, so an ancestor that
  // carries a plain `group` class can never trigger it. The visual difference between
  // `primary` and `slide` is zero until the pointer or the keyboard
  // arrives.
  slide:
    "group/slide border border-transparent bg-accent text-accent-fg hover:bg-accent-hover disabled:bg-bg-surface-2 disabled:text-text-quaternary",
  "slide-ghost":
    "group/slide border border-transparent text-text-secondary hover:bg-accent-ghost hover:text-text-primary disabled:text-text-quaternary",
  "slide-intelligence":
    "group/slide border border-lavender-border bg-lavender-subtle text-lavender hover:border-lavender/50 hover:bg-lavender/[0.14] disabled:border-border-subtle disabled:bg-transparent disabled:text-text-quaternary",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-caption",
  sm: "h-9 px-2.5 text-caption sm:h-7 sm:px-2",
  md: "h-10 px-3.5 text-button sm:h-8 sm:px-3",
  lg: "h-11 px-4 text-button sm:h-10",
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
    <span className="absolute inset-0 flex items-center justify-center">
      <svg
        className="h-3.5 w-3.5 animate-spin"
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
    </span>
  );
}

function SuccessIcon() {
  return (
    <span className="absolute inset-0 flex items-center justify-center animate-[badge-in_180ms_var(--ease-nexus)_both]">
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-success"
      >
        <path d="M3 8l3 3 7-7" />
      </svg>
    </span>
  );
}

/** The child of a slide-variant button. A plain string takes the sugar
 *  form and is wrapped automatically; anything composed (a trailing icon,
 *  a counter) is rendered as given, so the caller can place a <SlideLabel>
 *  exactly where the moving text belongs. */
function resolveSlideChild(
  children: ReactNode,
  hoverText?: string
): ReactNode {
  if (!hoverText || typeof children !== "string" || children.trim() === "") {
    return children;
  }
  return <SlideLabel text={children} hoverText={hoverText} />;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows an inline spinner, keeps the label width and blocks interaction. */
  loading?: boolean;
  /** Shows success state with check animation */
  success?: boolean;
  /** Shows error state with shake */
  error?: boolean;
  /** The label revealed on hover / keyboard focus, for `slide*` variants.
   *  Ignored by every other variant. Requires a plain string child; for
   *  composed children pass a <SlideLabel> instead. */
  hoverText?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  loading = false,
  success = false,
  error = false,
  disabled,
  children,
  hoverText,
  ...props
}: ButtonProps) {
  const isBusy = loading || success;
  return (
    <button
      type={type}
      disabled={disabled || isBusy}
      aria-busy={isBusy || undefined}
      data-success={success || undefined}
      data-error={error || undefined}
      className={cn(
        buttonClasses({ variant, size, className }),
        success && "border-success-border bg-success-bg text-success",
        error && "feedback-shake border-danger-border bg-danger-bg text-danger",
        loading && "btn-loading"
      )}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {success ? <SuccessIcon /> : null}
      <span
        className={cn(
          "inline-flex items-center gap-2 transition-opacity duration-150 ease-nexus",
          (loading || success) && "opacity-0"
        )}
      >
        {resolveSlideChild(children, hoverText)}
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
  hoverText,
  ref,
  ...props
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** The label revealed on hover / keyboard focus, for `slide*` variants.
   *  Ignored by every other variant. */
  hoverText?: string;
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
      {resolveSlideChild(children, hoverText)}
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
        "shrink-0 border border-transparent bg-transparent text-text-tertiary hover:bg-accent-ghost hover:text-text-primary disabled:text-text-quaternary sm:h-8 sm:w-8",
        size === "sm" ? "h-10 w-10" : "h-11 w-11",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
