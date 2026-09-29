import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { NexusIcon } from "@/components/nexus-icon";
import { IconSearch } from "@tabler/icons-react";

// ============================================================
// NEXUS — FORM CONTROLS (canonical)
// ============================================================
// One field recipe for the whole product:
//
//   surface   one step above its container (raise) — a control is
//             always the brightest matte surface in the panel
//   border    1px hairline default → strong on hover
//   focus     the single lavender ring, never border + ring + glow
//   error     driven by aria-invalid, spelled out by the message
//   height    sm 28 · md 32 · lg 40 (mobile: 16px text, ≥36px box)
//
// The auth screens keep their pill shape (brand decision, `shape="pill"`).
// ============================================================

const field =
  "w-full rounded-control border border-border-default bg-bg-surface-2 px-2.5 text-body text-text-primary transition-[border-color,background-color,box-shadow] duration-[120ms] ease-nexus placeholder:text-text-placeholder hover:border-border-strong focus:border-border-focus focus:outline-none focus:shadow-[0_0_0_3px_var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-secondary aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_var(--color-danger-border)]";

// Auth "pill" field. Token-based (was white-alpha, which rendered
// white-on-white in the light theme). Disabled uses a distinct surface
// and text colour instead of an opacity veil; invalid state is driven by
// aria-invalid so errors are visible without relying on colour alone.
const pillField =
  "w-full min-h-12 rounded-pill border border-border-strong bg-bg-surface px-4 py-3 text-[15px] leading-5 text-text-primary placeholder:text-text-placeholder transition-[border-color,box-shadow] duration-150 ease-nexus hover:border-text-muted focus:outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-secondary aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_var(--color-danger-border)]";

const heights = {
  sm: "h-7 text-small",
  md: "h-8",
  lg: "h-10",
} as const;

export function Input({
  className,
  size = "md",
  shape = "default",
  ...props
}: Omit<ComponentPropsWithRef<"input">, "size"> & {
  size?: keyof typeof heights;
  shape?: "default" | "pill";
}) {
  return (
    <input
      className={cn(
        shape === "pill" ? pillField : cn(field, heights[size]),
        className
      )}
      {...props}
    />
  );
}

/**
 * SearchField — the one filter/search control.
 * Same recipe as Input, with a leading icon and an optional keyboard hint.
 * Used by every list filter in the product (tasks, projects, activity,
 * command-adjacent surfaces) so a search box is never re-invented.
 */
export function SearchField({
  className,
  inputClassName,
  size = "md",
  hint,
  ...props
}: Omit<ComponentPropsWithRef<"input">, "size"> & {
  size?: "sm" | "md";
  inputClassName?: string;
  hint?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-control border border-border-default bg-bg-surface-2 px-2.5 transition-[border-color,background-color,box-shadow] duration-[120ms] ease-nexus hover:border-border-strong focus-within:border-border-focus focus-within:shadow-[0_0_0_3px_var(--focus-ring)]",
        size === "sm" ? "h-7" : "h-8",
        className
      )}
    >
      <NexusIcon
        icon={IconSearch}
        px={14}
        className="shrink-0 text-text-quaternary"
      />
      <input
        type="search"
        className={cn(
          "min-w-0 flex-1 bg-transparent text-small text-text-primary outline-none placeholder:text-text-placeholder",
          inputClassName
        )}
        {...props}
      />
      {hint ? (
        <span className="mono-token shrink-0 text-text-quaternary">{hint}</span>
      ) : null}
    </div>
  );
}

export function Textarea({
  className,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      className={cn(field, "min-h-20 py-2", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  size = "md",
  children,
  ...props
}: Omit<ComponentPropsWithRef<"select">, "size"> & {
  size?: "sm" | "md";
}) {
  return (
    <select
      className={cn(
        field,
        "cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238F8F8F%22 stroke-width=%221.75%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:14px_14px] bg-[right_8px_center] bg-no-repeat pr-8",
        size === "sm" ? "h-7 text-small" : "h-8",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
  action,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-caption font-medium text-text-secondary"
        >
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint ? <p className="text-caption text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-xs border transition-[background-color,border-color,color] duration-[160ms] ease-nexus disabled:cursor-not-allowed disabled:opacity-40",
        checked
          ? "border-accent bg-accent text-accent-fg"
          : "border-border-strong bg-transparent hover:border-border-focus hover:bg-bg-surface-2",
        className
      )}
    >
      {checked ? (
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 6.2l2.4 2.4L9.6 3.9" />
        </svg>
      ) : null}
    </button>
  );
}
