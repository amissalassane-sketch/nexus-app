"use client";

// ============================================================
// NEXUS — UI PRIMITIVES (P2/P4)
// Encoded rules (not decorations):
//  - 4px spacing scale, sections gap-6, cards p-5, rows min-h-11
//  - Buttons: 120ms hover, active:scale-[0.98], visible focus ring,
//    sober disabled state (transparent bg, 8% border, tertiary text)
//  - Cards/rows: elevation + border on hover, 160ms
//  - Progress bars: width animated 500ms
//  - Checkboxes: fill + strike transitions, 160ms
//  - Loading: skeletons at real dimensions — never a screen spinner
// ============================================================

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { Check } from "lucide-react";

// -- Button ---------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-primary text-accent-primary-fg hover:bg-accent-primary-hover font-medium disabled:border disabled:border-white/10 disabled:bg-transparent disabled:text-text-tertiary",
  secondary:
    "border border-border-default bg-bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-40",
  ghost:
    "text-text-secondary hover:bg-bg-surface hover:text-text-primary disabled:opacity-40",
  danger:
    "border border-danger-border bg-transparent text-danger-fg hover:bg-danger-bg disabled:opacity-40",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-button transition-all duration-[120ms] ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40 disabled:cursor-not-allowed disabled:active:scale-100 md:min-h-9 ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  );
}

// -- Card -----------------------------------------------------

export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border-default bg-bg-surface p-5 ${
        interactive
          ? "cursor-pointer transition-all duration-[160ms] ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-sm"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// -- Row (list line, min-h-11) --------------------------------

export function Row({
  children,
  className = "",
  interactive = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      {...rest}
      className={`flex min-h-11 items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface px-4 transition-all duration-[160ms] ease-out ${
        interactive ? "cursor-pointer hover:border-border-strong hover:bg-bg-surface-2" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// -- Section header -------------------------------------------

export function SectionHeader({
  label,
  title,
  action,
}: {
  label?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4 border-b border-border-subtle pb-2">
      <div className="flex min-w-0 items-center gap-2">
        {label ? (
          <span className="font-mono text-h3-mono uppercase text-text-tertiary">{label}</span>
        ) : null}
        {label ? <span className="font-mono text-text-quaternary">/</span> : null}
        <h2 className="truncate text-body font-semibold text-text-primary">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// -- Animated checkbox (task completion) ----------------------

export function TaskCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all duration-[160ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40 active:scale-90"
      style={{
        borderColor: checked ? "var(--color-volt)" : "var(--color-border-strong)",
        backgroundColor: checked ? "var(--color-volt)" : "transparent",
      }}
    >
      <Check
        size={12}
        strokeWidth={3}
        className="text-volt-fg transition-opacity duration-[160ms] ease-out"
        style={{ opacity: checked ? 1 : 0 }}
      />
    </button>
  );
}

// -- Progress bar (width animated 500ms) ----------------------

export function ProgressBar({
  value,
  className = "",
  tone = "volt",
}: {
  value: number;
  className?: string;
  tone?: "volt" | "accent" | "warning";
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const toneClass =
    tone === "volt" ? "bg-volt" : tone === "warning" ? "bg-warning-fg" : "bg-accent-primary";
  return (
    <div
      className={`h-1 overflow-hidden rounded-full bg-bg-surface-3 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${toneClass} transition-all duration-500 ease-out`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// -- Stat card ------------------------------------------------

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-danger-fg"
      : tone === "warning"
        ? "text-warning-fg"
        : "text-text-primary";
  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-5 transition-all duration-[160ms] ease-out hover:border-border-strong">
      <div className="text-small text-text-tertiary">{label}</div>
      <div className={`mt-3 font-mono text-display font-semibold ${valueClass}`}>{value}</div>
      {hint ? <div className="mt-2 text-caption text-text-quaternary">{hint}</div> : null}
    </div>
  );
}

// -- Skeletons (real dimensions) ------------------------------

export function SkeletonRow() {
  return <div className="skeleton min-h-11 w-full rounded-lg" />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  );
}

export function SkeletonBlock({ className = "h-24 w-full" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />;
}

// -- Empty / error states -------------------------------------

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-default px-6 py-8 text-center">
      {icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-bg-surface text-text-tertiary">
          {icon}
        </div>
      ) : null}
      <div className="text-body font-medium text-text-primary">{title}</div>
      {hint ? <p className="mt-1 max-w-sm text-small text-text-secondary">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="animate-fade-in rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-small text-danger-fg"
    >
      {message}
    </div>
  );
}

// -- Form fields ----------------------------------------------

const FIELD_CLASS =
  "w-full min-h-11 rounded-md border border-border-default bg-bg-subtle px-3 text-body text-text-primary outline-none transition-all duration-[160ms] ease-out placeholder:text-text-quaternary focus:border-border-focus focus-visible:ring-2 focus-visible:ring-volt/30 disabled:opacity-50";

export function Field({
  label,
  hint,
  className = "",
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="block">
      {label ? <span className="mb-2 block text-label text-text-secondary">{label}</span> : null}
      <input ref={ref} {...props} className={`${FIELD_CLASS} ${className}`} />
      {hint ? <span className="mt-1 block text-caption text-text-quaternary">{hint}</span> : null}
    </label>
  );
}

export function TextArea({
  label,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <span className="mb-2 block text-label text-text-secondary">{label}</span> : null}
      <textarea {...props} className={`${FIELD_CLASS} py-2.5 ${className}`} />
    </label>
  );
}

export function Select({
  label,
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <span className="mb-2 block text-label text-text-secondary">{label}</span> : null}
      <select {...props} className={`${FIELD_CLASS} ${className}`}>
        {children}
      </select>
    </label>
  );
}

// -- Badges ---------------------------------------------------

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "volt" | "warning" | "danger" | "success" | "info";
}) {
  const tones: Record<string, string> = {
    neutral: "border-border-default bg-bg-surface-2 text-text-tertiary",
    volt: "border-volt-border bg-volt-subtle text-volt",
    warning: "border-warning-border bg-warning-bg text-warning-fg",
    danger: "border-danger-border bg-danger-bg text-danger-fg",
    success: "border-success-border bg-success-bg text-success-fg",
    info: "border-info-border bg-info-bg text-info-fg",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// -- Inline edit (double-click title) -------------------------

export function InlineEdit({
  value,
  onSave,
  inputClassName = "",
  ariaLabel,
}: {
  value: string;
  onSave: (next: string) => void;
  className?: string;
  inputClassName?: string;
  ariaLabel: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      defaultValue={value}
      autoFocus
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onSave((event.target as HTMLInputElement).value.trim());
        } else if (event.key === "Escape") {
          (event.target as HTMLInputElement).blur();
          onSave(value);
        }
      }}
      onBlur={(event) => onSave(event.target.value.trim() || value)}
      className={`rounded border border-border-focus bg-bg-subtle px-1.5 py-0.5 outline-none ${inputClassName}`}
    />
  );
}
