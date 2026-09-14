// ============================================================
// NEXUS ADMIN — TYPES
// ============================================================
// The control plane has three authorities, and only the third one is
// defined here:
//
//   NEXUS USER            — owns a profile
//   WORKSPACE ADMIN       — owner/admin inside workspace_members
//   NEXUS PLATFORM ADMIN  — operates the SaaS itself (this file)
//
// Workspace roles and platform roles are different concepts that both
// happen to use the words "owner" and "admin". Nothing in this file may
// be satisfied by a workspace_members.role value.
// ============================================================

/** Platform roles, most capable first. Mirrors the CHECK constraint on
 *  public.platform_admins.role in migration 026. */
export const PLATFORM_ADMIN_ROLES = ["owner", "operator", "viewer"] as const;

export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export function isPlatformAdminRole(value: unknown): value is PlatformAdminRole {
  return (
    typeof value === "string" &&
    (PLATFORM_ADMIN_ROLES as readonly string[]).includes(value)
  );
}

/** What a human is allowed to do. Kept as a function of the role alone so
 *  the UI can never grant a capability the server did not. */
export type PlatformAdminCapabilities = {
  /** Read every admin surface. */
  read: boolean;
  /** Perform audited operational actions (PR 3+). */
  act: boolean;
  /** Grant/revoke platform admin access (PR 5). */
  manageAdmins: boolean;
};

export function capabilitiesFor(role: PlatformAdminRole): PlatformAdminCapabilities {
  return {
    read: true,
    act: role === "owner" || role === "operator",
    manageAdmins: role === "owner",
  };
}

/** Resolved identity of the caller, from the database — never from a
 *  cookie, a header or client state. */
export type PlatformAdminState =
  | { status: "admin"; userId: string; role: PlatformAdminRole }
  /** Signed in, but not a platform admin. The overwhelming majority of
   *  users land here, and it is not an error. */
  | { status: "not_admin"; userId: string }
  | { status: "unauthenticated" }
  /** The check itself could not be completed (no Supabase, migration not
   *  applied, timeout). Treated exactly like "not admin": fail closed. */
  | { status: "unavailable"; reason: AdminUnavailableReason };

export type AdminUnavailableReason =
  | "SUPABASE_NOT_CONFIGURED"
  | "MIGRATION_NOT_APPLIED"
  | "TIMEOUT"
  | "QUERY_FAILED";

export function isAdminState(state: PlatformAdminState): state is Extract<
  PlatformAdminState,
  { status: "admin" }
> {
  return state.status === "admin";
}

// ------------------------------------------------------------
// Overview payload — the exact JSONB shape of admin_overview()
// ------------------------------------------------------------
// `number | null` everywhere on purpose: NULL means "not measured /
// not available" and must never be rendered as 0.
export type AdminOverview = {
  generated_at: string;
  users: {
    total: number | null;
    email_confirmed: number | null;
    new_7d: number | null;
    new_30d: number | null;
    active_30d: number | null;
    without_profile: number | null;
  };
  workspaces: {
    total: number | null;
    new_7d: number | null;
    new_30d: number | null;
    without_active_owner: number | null;
  };
  memberships: {
    total: number | null;
    active: number | null;
  };
  plans: {
    free: number | null;
    pro: number | null;
    team: number | null;
    active: number | null;
    past_due: number | null;
    trialing: number | null;
    /** Always null while no payment provider is connected. */
    mrr: number | null;
    currency: string | null;
    provider: string | null;
  };
  usage: {
    projects: number | null;
    goals: number | null;
    tasks: number | null;
    tasks_open: number | null;
    tasks_blocked: number | null;
    tasks_done: number | null;
    notifications_unread: number | null;
    intelligence_signals: number | null;
    intelligence_missions: number | null;
    intelligence_memory: number | null;
  };
  activity: {
    events_total: number | null;
    events_7d: number | null;
    distinct_actors_30d: number | null;
    instrumented: boolean;
  };
  needs_attention: AdminAttentionItem[];
};

export type AdminAttentionSeverity = "danger" | "warning" | "info";

export type AdminAttentionItem = {
  id: string;
  severity: AdminAttentionSeverity;
  title: string;
  detail: string;
  count: number;
};

export type AdminActivityKind =
  | "account_created"
  | "workspace_created"
  | "subscription_changed"
  | string;

export type AdminActivityEntry = {
  id: string;
  /** The table the row came from — shown in the UI so an operator always
   *  knows what they are looking at. */
  source: string;
  kind: AdminActivityKind;
  title: string;
  subject: string;
  occurred_at: string;
};

// ------------------------------------------------------------
// Platform health
// ------------------------------------------------------------
export type ServiceStatus = "operational" | "degraded" | "down" | "unknown";

export type ServiceHealth = {
  id: string;
  label: string;
  status: ServiceStatus;
  /** Only present when something was actually measured. Never estimated. */
  latencyMs?: number;
  /** Honest reason for a non-operational or unknown status. */
  detail: string;
  checkedAt: string;
};

export type AdminOverviewResult =
  | { ok: true; overview: AdminOverview; activity: AdminActivityEntry[] }
  | { ok: false; error: AdminDataError };

export type AdminDataError = {
  code: "FORBIDDEN" | "NOT_INSTALLED" | "TIMEOUT" | "UNAVAILABLE" | "INVALID_PAYLOAD";
  message: string;
};
