import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — FORM CONTROLS
// 40px (44px on auth), 8px radius, near-black surface, 8% border.
// Labels are always present — placeholders never carry the meaning.
// Focus is a border shift plus a restrained lavender ring.
// ============================================================

const field =
  "w-full rounded-input border border-border-default bg-bg-surface px-3 text-body text-text-primary transition-colors duration-150 ease-nexus placeholder:text-text-quaternary focus:border-border-focus focus:outline-none focus:shadow-[0_0_0_3px_rgba(233,228,255,0.14)] disabled:cursor-not-allowed disabled:opacity-50";

export function Input({
  className,
  size = "md",
  ...props
}: Omit<ComponentPropsWithRef<"input">, "size"> & {
  size?: "md" | "lg";
}) {
  return (
    <input
      className={cn(field, size === "lg" ? "h-11" : "h-10", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  return <textarea className={cn(field, "min-h-20 py-2.5", className)} {...props} />;
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
        "cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238F8F8F%22 stroke-width=%221.75%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:14px_14px] bg-[right_10px_center] bg-no-repeat pr-8",
        size === "sm" ? "h-8 text-small" : "h-10",
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
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150 ease-nexus disabled:cursor-not-allowed disabled:opacity-40",
        checked
          ? "border-accent bg-accent text-accent-fg"
          : "border-border-strong bg-transparent hover:border-border-focus",
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
