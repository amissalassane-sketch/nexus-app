import Link from "next/link";
import type { ServiceHealth } from "@/lib/admin/types";
import { formatLatency, formatRelativeTime } from "@/lib/admin/format";
import { cn } from "@/lib/cn";
import { AdminIcon } from "./admin-icons";
import { AdminServiceStatus } from "./status";

// ============================================================
// NEXUS ADMIN — PLATFORM HEALTH LIST
// ============================================================
// One row per service: status, what was actually observed, and when
// it was checked. A row with no measurement says "Not measured" and
// explains why there is nothing to measure — which is more useful
// than a green dot nobody verified. When a probe knows the next
// action (configure, reconnect, inspect), the row links to it.
// ============================================================

export function HealthList({ services }: { services: ServiceHealth[] }) {
  return (
    <ul className="divide-y divide-admin-border">
      {services.map((service) => (
        <li
          key={service.id}
          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                service.status === "operational"
                  ? "bg-admin-success"
                  : service.status === "degraded" || service.status === "stale"
                    ? "bg-admin-warning"
                    : service.status === "error"
                      ? "bg-admin-danger"
                      : service.status === "not_configured"
                        ? "bg-admin-info"
                        : "bg-admin-text-3"
              )}
            />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-body-medium text-admin-text">
                {service.label}
                <span className="sm:hidden">
                  <AdminServiceStatus status={service.status} />
                </span>
              </p>
              <p className="mt-1 max-w-[76ch] text-small text-admin-text-2">
                {service.detail}
              </p>
              {service.action ? (
                // Internal destinations only — client navigation keeps the
                // page entrance animation and the operator's scroll intent.
                // Deliberately not a slide label: this is a secondary action
                // inside a dense status row.
                <Link
                  href={service.action.href}
                  className="mt-1.5 inline-flex min-h-6 items-center text-small font-medium text-admin-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
                >
                  {service.action.label}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 pl-5 sm:pl-0">
            <span className="hidden sm:block">
              <AdminServiceStatus status={service.status} />
            </span>
            {typeof service.latencyMs === "number" ? (
              <span
                className="inline-flex items-center gap-1.5 mono-meta tabular-nums text-admin-text-2"
                title="Measured round trip for this check"
              >
                <AdminIcon name="clock" size="action" className="text-admin-text-3" />
                {formatLatency(service.latencyMs)}
              </span>
            ) : null}
            <span className="mono-meta text-admin-text-3">
              {formatRelativeTime(service.checkedAt)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
