import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { AdminDataError } from "@/lib/admin/types";
import { AdminIcon, AdminIconTile } from "./admin-icons";

// ============================================================
// NEXUS ADMIN — EMPTY AND ERROR STATES
// ============================================================
// These components are the enforcement point of the "no fake data" rule.
// When a number cannot be produced, the screen shows one of these instead
// of a placeholder, a skeleton that never resolves, or — worst — a
// plausible-looking zero.
//
// Three distinct situations, three distinct messages:
//   * nothing measured yet   → "No data yet" + what would fill it
//   * the source is absent   → "Not connected" + what is missing
//   * the read failed        → what failed, and that nothing is shown
// ============================================================

export function AdminEmptyState({
  title,
  description,
  icon = "info",
  action,
  className,
  compact = false,
}: {
  title: string;
  description: string;
  icon?:
    | "info"
    | "activity"
    | "clock"
    | "database"
    | "cloud"
    | "shield"
    | "chart"
    | "check";
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
        className
      )}
    >
      <AdminIconTile name={icon} />
      <p className="mt-1 text-[13px] font-semibold leading-[18px] text-admin-text">
        {title}
      </p>
      <p className="max-w-[52ch] text-[12.5px] leading-[18px] text-admin-text-2">
        {description}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

const ERROR_COPY: Record<
  AdminDataError["code"],
  { title: string; description: string; icon: "shield" | "database" | "clock" | "info" }
> = {
  FORBIDDEN: {
    title: "Platform access required",
    description:
      "This account is not a platform admin, so no platform data is returned. Access is decided by the database, not by this page.",
    icon: "shield",
  },
  NOT_INSTALLED: {
    title: "Control plane not installed",
    description:
      "The admin functions are missing from this database. Apply supabase/migrations/026_admin_control_plane.sql, then grant yourself a row in platform_admins.",
    icon: "database",
  },
  TIMEOUT: {
    title: "The platform did not answer in time",
    description:
      "The aggregate read was cancelled rather than left hanging. Nothing is shown, because a partial number would be a wrong number.",
    icon: "clock",
  },
  UNAVAILABLE: {
    title: "Platform data unavailable",
    description:
      "The aggregate could not be read. No figures are estimated in its place.",
    icon: "info",
  },
  INVALID_PAYLOAD: {
    title: "Unexpected response from the database",
    description:
      "admin_overview() returned a shape this build does not recognise. The migration and the application are probably out of sync.",
    icon: "info",
  },
};

export function AdminErrorState({
  error,
  className,
}: {
  error: AdminDataError;
  className?: string;
}) {
  const copy = ERROR_COPY[error.code];

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-[10px] border border-admin-danger-border bg-admin-danger-bg px-4 py-4 sm:flex-row sm:items-start",
        className
      )}
    >
      <AdminIconTile name={copy.icon} tone="danger" className="shrink-0" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-[18px] text-admin-text">
          {copy.title}
        </p>
        <p className="mt-1 max-w-[72ch] text-[12.5px] leading-[18px] text-admin-text-2">
          {copy.description}
        </p>
        {error.message ? (
          <p className="mt-2 font-mono text-[11.5px] leading-[16px] text-admin-text-3">
            {error.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Inline "not measured" marker for a single field inside a dense list.
 *  Keeps the row honest without turning it into an error. */
export function AdminNotMeasured({ reason }: { reason?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-admin-text-3"
      title={reason ?? "No measurement exists for this value."}
    >
      <AdminIcon name="clock" size="action" />
      Not measured
    </span>
  );
}
