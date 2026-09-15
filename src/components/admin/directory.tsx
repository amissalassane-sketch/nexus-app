import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime, NOT_AVAILABLE } from "@/lib/admin/format";

// ============================================================
// NEXUS ADMIN — SHARED DIRECTORY PRESENTATION (PR 2)
// ============================================================
// The three atoms the directory screens repeat constantly:
//
//   AdminSubject   — a person or a workspace, rendered as
//                    "real name → @username → email → truncated id",
//                    first available wins. This is the anti-fabrication
//                    rule made structural: there is no code path here
//                    that invents a label for something it cannot name.
//   AdminTimeCell  — <time> element, relative on the surface, absolute
//                    UTC in the title; null renders the honest marker.
//   AdminCountCell — a measured integer, or a dimmed 0 that is visibly
//                    a count, never a placeholder.
//
// Mono is applied to ids, usernames, slugs and timestamps — the same rule
// the Overview follows for technical values.
// ============================================================

/** Initials for the subject's tile, derived from display_name when present.
 *  Two letters maximum, uppercase; "?" when the platform genuinely has no
 *  name — the fallback is a fact, not a fabrication. */
export function initialsFor(
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const source = displayName?.trim() || email?.split("@")[0]?.replace(/[._\-]+/g, " ") || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + second).toUpperCase() || "?";
}

export function AdminSubject({
  displayName,
  username,
  email,
  id,
  href,
  size = "row",
}: {
  displayName: string | null | undefined;
  username?: string | null;
  email?: string | null;
  /** Full identifier, shown truncated in mono when nothing names better. */
  id?: string;
  /** When set, the name becomes a navigation link (used inside panels
   *  without a stretched row link; table rows use AdminRowLink instead). */
  href?: string;
  size?: "row" | "tile";
}) {
  // Precedence, first real value wins — this chain is the whole
  // anti-fabrication rule: nothing here synthesises a label.
  const name = displayName?.trim() || null;
  const handle = username ? `@${username}` : null;
  const primary = name ?? email ?? handle ?? (id ? shortIdInline(id) : "Unnamed");
  const secondary =
    primary === name ? email ?? handle : primary === email ? handle : null;

  const initials = initialsFor(name, email);

  const label = (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[7px] border border-admin-border bg-admin-surface-2 font-mono text-[10px] font-semibold uppercase tracking-[0.02em] text-admin-text-2",
          size === "row" ? "h-6 w-6" : "h-8 w-8 text-[12px]"
        )}
      >
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium leading-[18px] text-admin-text">
          {primary}
        </span>
        {secondary ? (
          <span className="block truncate font-mono text-[11px] leading-[15px] text-admin-text-3">
            {secondary}
          </span>
        ) : null}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="min-w-0 no-underline transition-colors duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
      >
        {label}
      </Link>
    );
  }
  return <span className="min-w-0">{label}</span>;
}

function shortIdInline(id: string): string {
  return `${id.slice(0, 8)}…`;
}

/** A machine-readable timestamp with a human face. `null` renders the
 *  NOT_AVAILABLE marker — the same rule every number on this surface obeys. */
export function AdminTimeCell({
  iso,
  className,
  relative = true,
}: {
  iso: string | null | undefined;
  className?: string;
  /** true  → "3h ago", absolute UTC in the title (dense lists)
   *  false → "14 Sep 2026, 09:12 UTC" (inspectors, where the moment matters) */
  relative?: boolean;
}) {
  if (!iso) {
    return (
      <span className={cn("text-admin-text-3", className)}>{NOT_AVAILABLE}</span>
    );
  }
  const absolute = formatDateTime(iso);
  return (
    <time
      dateTime={iso}
      title={absolute}
      className={cn("font-mono text-[12px] leading-[16px] text-admin-text-2", className)}
    >
      {relative ? formatRelativeTime(iso) : absolute}
    </time>
  );
}

/** Mono id with the full value in the title and a hint of what to do with
 *  it. Never used as the primary label when a real name exists. */
export function AdminIdValue({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "truncate font-mono text-[12px] leading-[16px] text-admin-text-2",
        className
      )}
      title={`${label}: ${value}`}
    >
      {value}
    </span>
  );
}
