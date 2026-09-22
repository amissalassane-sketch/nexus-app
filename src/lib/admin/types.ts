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

// ------------------------------------------------------------
// Intelligence health — exact JSONB shape of admin_intelligence_health()
// (migration 20260922130000). null means "not measured yet".
// ------------------------------------------------------------
export type AdminIntelligenceHealth = {
  generated_at: string;
  requests_24h: number | null;
  requests_30d: number | null;
  errors_24h: number | null;
  fallbacks_24h: number | null;
  avg_latency_ms_24h: number | null;
  distinct_users_7d: number | null;
  input_tokens_30d: number | null;
  output_tokens_30d: number | null;
  first_request_at: string | null;
  last_request_at: string | null;
};

// ------------------------------------------------------------
// Integration health — exact JSONB shape of admin_integration_health()
// ------------------------------------------------------------
export type AdminIntegrationHealth = {
  generated_at: string;
  connections: {
    total: number | null;
    connected: number | null;
    syncing: number | null;
    stale: number | null;
    error: number | null;
    reauth_required: number | null;
  };
  last_sync_at: string | null;
  failed_sync_runs_7d: number | null;
};

// ------------------------------------------------------------
// Automation health — exact JSONB shape of admin_automation_health()
// ------------------------------------------------------------
export type AdminAutomationHealth = {
  generated_at: string;
  /** False when the automations tables (migration 004) are absent. */
  installed?: boolean;
  automations: {
    total: number | null;
    active: number | null;
    paused: number | null;
    disabled: number | null;
  };
  executions: {
    total: number | null;
    success_24h: number | null;
    failed_24h: number | null;
    success_7d: number | null;
    failed_7d: number | null;
    queued: number | null;
    last_execution_at: string | null;
  };
};

export type AdminAttentionSeverity = "danger" | "warning" | "info";

export type AdminAttentionItem = {
  id: string;
  severity: AdminAttentionSeverity;
  title: string;
  detail: string;
  count: number;
};

/**
 * The operator-facing companion of an attention item: what to do, and
 * where to do it. The SQL layer reports *conditions*; this layer (kept
 * in code so it can link real routes and evolve without a migration)
 * maps each known condition to a recommended action.
 */
export type AdminAttentionAction = {
  /** Short imperative, e.g. "Inspect failed runs". */
  label: string;
  /** Where the action happens. */
  href: string;
  /** One-line explanation of why this helps. */
  rationale: string;
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
// A control-plane status must say WHY, not just that, something is
// not green. The seven states below are exhaustive by design; each
// one has exactly one cause, so the UI can offer the right next
// action instead of a shrug:
//
//   operational     — measured (or verified by construction) and fine
//   degraded        — measured and slow (above the latency threshold)
//   error           — measured and failing (probe error, provider 5xx)
//   not_configured  — the subsystem is deliberately absent (no API
//                     key, no provider client) — not a failure
//   not_measured    — nothing can be checked from here, and the panel
//                     says so instead of showing a green dot
//   stale           — the newest observation is too old to trust
//   blocked         — the check exists but a dependency or policy
//                     prevents running it (e.g. needs a key the app
//                     deliberately does not hold)
export type ServiceStatus =
  | "operational"
  | "degraded"
  | "error"
  | "not_configured"
  | "not_measured"
  | "stale"
  | "blocked";

export type ServiceHealth = {
  id: string;
  label: string;
  status: ServiceStatus;
  /** Only present when something was actually measured. Never estimated. */
  latencyMs?: number;
  /** Honest reason for the status — always states the cause. */
  detail: string;
  checkedAt: string;
  /** Where the operator goes to act on this status, when one exists. */
  action?: {
    label: string;
    href: string;
  };
};

/**
 * The activity feed has three genuinely different outcomes, and they must
 * not collapse into one another:
 *
 *   ok + entries  → "12 events"
 *   ok + []       → "No recent activity"  (measured, and there is none)
 *   unavailable   → "Activity unavailable" + Retry  (we could not read it)
 *
 * An earlier revision returned a bare array, which made a failed RPC
 * indistinguishable from an empty platform. On a control plane that is the
 * worst possible confusion: "nothing is happening" and "I cannot see"
 * lead to opposite decisions.
 */
export type AdminActivityResult =
  | { state: "ok"; entries: AdminActivityEntry[] }
  | { state: "unavailable"; error: AdminDataError };

export type AdminOverviewResult =
  | { ok: true; overview: AdminOverview; activity: AdminActivityResult }
  | { ok: false; error: AdminDataError };

export type AdminDataError = {
  code: "FORBIDDEN" | "NOT_INSTALLED" | "TIMEOUT" | "UNAVAILABLE" | "INVALID_PAYLOAD";
  message: string;
  /**
   * The raw database/transport error behind the classified one, reduced
   * to the three fields that diagnose it: SQLSTATE or PGRST code
   * (`42703`, `PGRST204`, …), the bounded raw message, and the Postgres
   * hint when the database supplied one.
   *
   * Contract for what may appear here (enforced at the point of capture):
   * schema-level strings only — column names, table names, error codes.
   * Never request data, headers, tokens or account identifiers. The admin
   * UI renders `code` as a short chip under the friendly message so an
   * operator can act without opening the runtime logs; the same triple is
   * logged server-side (Vercel Runtime Logs) for the full context.
   */
  detail?: {
    code: string;
    message: string;
    hint?: string;
  };
};

// ------------------------------------------------------------
// Directory payloads — the exact JSONB shapes of migration 027
// ------------------------------------------------------------
// Same contract as the Overview: every field maps to a real column or a
// derivation documented next to the SQL. `null` means "no measurement
// exists" and renders as NOT_AVAILABLE, never as 0 or as a dash someone
// could mistake for a fact.

/** Derived from real GoTrue state only (banned_until / email_confirmed_at).
 *  There is no status column on auth.users in this product; the UI states
 *  the derivation rather than implying an account flag that isn't there. */
export type AdminAccountStatus = "active" | "pending" | "banned";

export type AdminUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  /** False when the signup trigger never produced a profiles row. */
  has_profile: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  /** greatest(last_sign_in_at, newest row in activities). */
  last_activity_at: string | null;
  email_confirmed: boolean;
  banned_until: string | null;
  account_status: AdminAccountStatus;
  memberships: { total: number; active: number; owned: number };
  platform_role: PlatformAdminRole | null;
};

export type AdminUsersListPayload = {
  generated_at: string;
  page: number;
  page_size: number;
  sort: string;
  direction: "asc" | "desc";
  search: string | null;
  status: string;
  total: number;
  items: AdminUserRow[];
};

export type AdminUserWorkspaceRef = {
  workspace_id: string;
  name: string;
  slug: string;
  role: string;
  membership_status: string;
  joined_at: string;
  is_creator: boolean;
};

export type AdminUserActivityRef = {
  activity_id: string;
  workspace_id: string;
  workspace_name: string;
  action: string | null;
  entity_type: string | null;
  occurred_at: string;
};

export type AdminUserDetail = {
  generated_at: string;
  identity: {
    user_id: string;
    email: string | null;
    display_name: string | null;
    username: string | null;
    job_title: string | null;
    bio: string | null;
    avatar_url: string | null;
    created_at: string;
    profile_created_at: string | null;
    profile_updated_at: string | null;
  };
  account: {
    has_profile: boolean;
    email_confirmed: boolean;
    email_confirmed_at: string | null;
    last_sign_in_at: string | null;
    banned_until: string | null;
    onboarding_completed: boolean;
    account_status: AdminAccountStatus;
    last_activity_at: string | null;
  };
  platform_admin: {
    is_admin: boolean;
    role: PlatformAdminRole | null;
    status: string | null;
    since: string | null;
    note: string | null;
  };
  usage: {
    memberships_total: number;
    memberships_active: number;
    workspaces_owned: number;
    tasks_created: number;
    tasks_assigned: number;
    tasks_open: number;
    tasks_done: number;
    projects_owned: number;
    goals_created: number;
    notifications_unread: number;
    activity_events: number;
  };
  workspaces: AdminUserWorkspaceRef[];
  recent_activity: AdminUserActivityRef[];
};

export type AdminWorkspaceRow = {
  workspace_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  owner: {
    user_id: string;
    email: string | null;
    display_name: string | null;
    username: string | null;
  };
  members: { total: number; active: number };
  projects: number;
  tasks: number;
  /** 'FREE' with has_subscription=false means "no active subscription
   *  row; this is the documented default plan", not a measurement. */
  plan: "FREE" | "PRO" | "TEAM";
  has_subscription: boolean;
  subscription_status: string | null;
  has_active_owner: boolean;
};

export type AdminWorkspacesListPayload = {
  generated_at: string;
  page: number;
  page_size: number;
  sort: string;
  direction: "asc" | "desc";
  search: string | null;
  view: string;
  total: number;
  items: AdminWorkspaceRow[];
};

export type AdminWorkspaceMemberRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  role: string;
  membership_status: string;
  joined_at: string;
  account_status: AdminAccountStatus;
  is_creator: boolean;
};

export type AdminWorkspaceActivityRef = {
  activity_id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string | null;
  entity_type: string | null;
  occurred_at: string;
};

export type AdminWorkspaceProjectRow = {
  project_id: string;
  name: string;
  status: string;
  progress: number;
  due_date: string | null;
  updated_at: string;
  tasks_total: number;
  tasks_done: number;
};

export type AdminWorkspaceTaskRow = {
  task_id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  completed_at: string | null;
  updated_at: string;
  project_id: string | null;
  assignee_id: string | null;
};

export type AdminWorkspaceSubscriptionRow = {
  subscription_id: string;
  plan: "FREE" | "PRO" | "TEAM";
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  has_billing_ids: boolean;
  updated_at: string;
};

export type AdminWorkspaceDetail = {
  generated_at: string;
  overview: {
    workspace_id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    created_at: string;
    updated_at: string;
    last_activity_at: string | null;
  };
  owner: {
    user_id: string;
    email: string | null;
    display_name: string | null;
    username: string | null;
    account_status: AdminAccountStatus;
    last_sign_in_at: string | null;
  } | null;
  health: { has_active_owner: boolean; member_count_active: number };
  subscription: AdminWorkspaceSubscriptionRow[];
  members: AdminWorkspaceMemberRow[];
  usage: {
    projects: number;
    tasks: number;
    goals: number;
    events: number;
    notifications: number;
    signals: number;
    missions: number;
  };
  tasks_by_status: Record<string, number>;
  recent_projects: AdminWorkspaceProjectRow[];
  recent_tasks: AdminWorkspaceTaskRow[];
  recent_activity: AdminWorkspaceActivityRef[];
};

// ------------------------------------------------------------
// Subscriptions payloads — the exact JSONB shapes of migration 029
// ------------------------------------------------------------
// One row per workspace (subscriptions are workspace-scoped, never
// user-scoped). Same null contract as the directory: `null` means
// "no measurement exists" and renders as NOT_AVAILABLE.

/** Raw workspace_subscriptions.status of the LIVE row (029): the active
 *  row when one exists, else the most recently updated row. There is no
 *  'implicit_free' value in the database — the UI derives that label
 *  from a null status. 'expired' comes from the subscription contract's
 *  lapse sweep; only 'active' with a live period grants capacity. */
export type AdminSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "expired";

export type AdminSubscriptionRow = {
  workspace_id: string;
  name: string;
  slug: string;
  /** Effective plan: the active row's plan, or the documented default
   *  FREE when has_subscription is false. */
  plan: "FREE" | "PRO" | "TEAM";
  has_subscription: boolean;
  subscription_status: AdminSubscriptionStatus | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  subscription_updated_at: string | null;
  /** Either billing id present. Normally false everywhere: no payment
   *  provider is connected. */
  billing_wired: boolean;
  /** Every row except the displayed live one: the history the live
   *  row does not show. */
  previous_rows: number;
  owner: {
    user_id: string;
    email: string | null;
    display_name: string | null;
  };
  usage: {
    projects: number;
    active_tasks: number;
    goals: number;
    members: number;
  };
  limits: {
    projects: number;
    active_tasks: number;
    goals: number;
  };
  has_active_owner: boolean;
};

export type AdminSubscriptionsSummary = {
  workspaces: number;
  plans: { free: number; pro: number; team: number };
  statuses: {
    active: number;
    trialing: number;
    past_due: number;
    cancelled: number;
    expired: number;
    implicit_free: number;
  };
  /** past_due + cancelled + no active owner, over the filtered set. */
  attention: number;
};

export type AdminSubscriptionsListPayload = {
  generated_at: string;
  page: number;
  page_size: number;
  sort: string;
  direction: "asc" | "desc";
  search: string | null;
  plan: string;
  status: string;
  total: number;
  summary: AdminSubscriptionsSummary;
  items: AdminSubscriptionRow[];
};
