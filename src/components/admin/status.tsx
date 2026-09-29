import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ServiceStatus } from "@/lib/admin/types";
import { AdminIcon } from "./admin-icons";

// ============================================================
// NEXUS ADMIN — STATUS
// ============================================================
// A status is a word plus a dot, never a dot alone. Colour is redundant
// with the label on every variant here, because an operator reading the
// panel at 07:00 should not have to remember what amber meant yesterday.
//
// The pill IS the canonical Tag of the design system: 20px tall, radius 4,
// uppercase monospace 10.5 at +0.06em. There is exactly one of these in
// the control plane — a badge here and a badge in a table are the same
// object, which is why nothing else in admin/ declares a chip class.
// ============================================================

export type AdminTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

const TONES: Record<AdminTone, string> = {
  neutral: "border-admin-border bg-admin-surface-2 text-admin-text-2",
  success: "border-admin-success-border bg-admin-success-bg text-admin-success",
  warning: "border-admin-warning-border bg-admin-warning-bg text-admin-warning",
  danger: "border-admin-danger-border bg-admin-danger-bg text-admin-danger",
  info: "border-admin-info-border bg-admin-info-bg text-admin-info",
  accent: "border-admin-accent-border bg-admin-accent-bg text-admin-accent",
};

const DOT: Record<AdminTone, string> = {
  neutral: "bg-admin-text-3",
  success: "bg-admin-success",
  warning: "bg-admin-warning",
  danger: "bg-admin-danger",
  info: "bg-admin-info",
  accent: "bg-admin-accent",
};

export function AdminStatusPill({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: AdminTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs border px-1.5 mono-token leading-none",
        TONES[tone],
        className
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}

export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  error: "Error",
  not_configured: "Not configured",
  not_measured: "Not measured",
  stale: "Stale",
  blocked: "Blocked",
};

export const SERVICE_STATUS_TONE: Record<ServiceStatus, AdminTone> = {
  operational: "success",
  degraded: "warning",
  error: "danger",
  not_configured: "info",
  not_measured: "neutral",
  stale: "warning",
  blocked: "neutral",
};

export function AdminServiceStatus({ status }: { status: ServiceStatus }) {
  return (
    <AdminStatusPill tone={SERVICE_STATUS_TONE[status]}>
      {SERVICE_STATUS_LABEL[status]}
    </AdminStatusPill>
  );
}

/** Severity glyph for the "Needs attention" list. The severity is always
 *  written out next to it as well. */
export function AdminSeverityIcon({
  severity,
}: {
  severity: "danger" | "warning" | "info";
}) {
  const map = {
    danger: { name: "cross" as const, className: "text-admin-danger" },
    warning: { name: "warning" as const, className: "text-admin-warning" },
    info: { name: "info" as const, className: "text-admin-info" },
  }[severity];

  return <AdminIcon name={map.name} size="action" className={map.className} />;
}
