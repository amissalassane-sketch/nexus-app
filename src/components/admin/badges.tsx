import { AdminStatusPill, type AdminTone } from "./status";
import type { AdminAccountStatus } from "@/lib/admin/types";

// ============================================================
// NEXUS ADMIN — DIRECTORY STATUS VOCABULARY (PR 2)
// ============================================================
// One mapping from data value to pill, shared by both lists and both
// inspectors, so "owner" in the member table and "owner" on the workspace
// row can never render differently. Workspace roles and PLATFORM roles
// share English words and nothing else — the platform badge carries the
// word "platform" through its label to keep the distinction visible.
// ============================================================

const ACCOUNT_STATUS: Record<AdminAccountStatus, { label: string; tone: AdminTone }> = {
  active: { label: "Active", tone: "success" },
  pending: { label: "Awaiting email", tone: "warning" },
  banned: { label: "Banned", tone: "danger" },
};

export function AdminAccountBadge({ status }: { status: AdminAccountStatus }) {
  const meta = ACCOUNT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <AdminStatusPill tone={meta.tone}>{meta.label}</AdminStatusPill>;
}

/** Platform role of an account, as opposed to any workspace role. */
export function AdminPlatformRoleBadge({ role }: { role: "owner" | "operator" | "viewer" }) {
  return (
    <AdminStatusPill tone="accent" dot={false}>
      Platform · {role}
    </AdminStatusPill>
  );
}

/** workspace_members.role — a tenant-level authority, unrelated to the
 *  platform roles above. */
const MEMBERSHIP_ROLE: Record<string, { label: string; tone: AdminTone }> = {
  owner: { label: "Owner", tone: "accent" },
  admin: { label: "Admin", tone: "info" },
  member: { label: "Member", tone: "neutral" },
  viewer: { label: "Viewer", tone: "neutral" },
};

export function AdminMembershipRoleBadge({ role }: { role: string }) {
  const meta = MEMBERSHIP_ROLE[role] ?? { label: role, tone: "neutral" as const };
  return <AdminStatusPill tone={meta.tone}>{meta.label}</AdminStatusPill>;
}

const MEMBERSHIP_STATUS: Record<string, { label: string; tone: AdminTone }> = {
  active: { label: "Active", tone: "neutral" },
  invited: { label: "Invited", tone: "info" },
  suspended: { label: "Suspended", tone: "warning" },
};

export function AdminMembershipStatusBadge({ status }: { status: string }) {
  const meta = MEMBERSHIP_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <AdminStatusPill tone={meta.tone}>{meta.label}</AdminStatusPill>;
}

const PLAN: Record<string, { label: string; tone: AdminTone }> = {
  FREE: { label: "Free", tone: "neutral" },
  PRO: { label: "Pro", tone: "accent" },
  TEAM: { label: "Team", tone: "info" },
};

export function AdminPlanBadge({ plan }: { plan: string }) {
  const meta = PLAN[plan] ?? { label: plan, tone: "neutral" as const };
  return <AdminStatusPill tone={meta.tone}>{meta.label}</AdminStatusPill>;
}

/** Raw workspace_subscriptions.status vocabulary of the LIVE row (029).
 *  `null` (no row at all) renders as "Implicit free" — the documented
 *  default, not a row. Expired is danger, like past due: the guards
 *  are failing closed on a paid plan until it is renewed or swept. */
const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: AdminTone }> = {
  active: { label: "Active", tone: "success" },
  trialing: { label: "Trialing", tone: "info" },
  past_due: { label: "Past due", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
};

export function AdminSubscriptionStatusBadge({
  status,
}: {
  status: string | null;
}) {
  if (status === null) {
    return <AdminStatusPill tone="neutral">Implicit free</AdminStatusPill>;
  }
  const meta = SUBSCRIPTION_STATUS[status] ?? {
    label: status.replace(/_/g, " "),
    tone: "neutral" as const,
  };
  return <AdminStatusPill tone={meta.tone}>{meta.label}</AdminStatusPill>;
}

const TASK_STATUS: Record<string, { label: string; tone: AdminTone }> = {
  todo: { label: "To do", tone: "neutral" },
  in_progress: { label: "In progress", tone: "accent" },
  in_review: { label: "In review", tone: "info" },
  blocked: { label: "Blocked", tone: "danger" },
  done: { label: "Done", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function AdminTaskStatusBadge({ status }: { status: string }) {
  const meta = TASK_STATUS[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as const };
  return <AdminStatusPill tone={meta.tone}>{meta.label}</AdminStatusPill>;
}

const PRIORITY: Record<string, { label: string; tone: AdminTone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "neutral" },
  high: { label: "High", tone: "warning" },
  urgent: { label: "Urgent", tone: "danger" },
};

export function AdminPriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY[priority] ?? { label: priority, tone: "neutral" as const };
  return <AdminStatusPill tone={meta.tone}>{meta.label}</AdminStatusPill>;
}
