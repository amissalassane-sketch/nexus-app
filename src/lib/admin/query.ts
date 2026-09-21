// ============================================================
// NEXUS ADMIN — LIST QUERIES & DIRECTORY PAYLOAD GUARDS
// ============================================================
// Two jobs, deliberately kept in one dependency-free module:
//
//   1. Parse the URL search params of /admin/users and /admin/workspaces
//      into a normalized query object. Every field is whitelisted or
//      clamped; a hand-edited URL can only produce values the SQL
//      functions accept. The pages render from this, never from raw
//      searchParams.
//   2. Validate the JSONB payloads returned by migration 027 before any
//      of it is rendered. Same philosophy as admin_overview's guard in
//      data.ts: a malformed payload is an error state, never a table
//      full of `undefined` and never a silently-empty list.
//
// Nothing in this file imports React or the Supabase client, so the
// unit tests drive it directly (supabase/tests/admin-directory.test.mjs).
// ============================================================

import type {
  AdminAccountStatus,
  AdminSubscriptionsListPayload,
  AdminSubscriptionStatus,
  AdminUserDetail,
  AdminUsersListPayload,
  AdminWorkspaceDetail,
  AdminWorkspacesListPayload,
} from "./types";
import { isPlatformAdminRole } from "./types";

// ------------------------------------------------------------
// Search-param parsing
// ------------------------------------------------------------

export type SortDirection = "asc" | "desc";

/** Whitelists — the exact vocabulary admin_users_list / admin_workspaces_list
 *  accept. Unknown values fall back to the default, mirroring the SQL CASE
 *  blocks so URL, app and database agree on one vocabulary. */
export const USERS_SORT_KEYS = [
  "created_at",
  "email",
  "name",
  "last_activity",
  "workspaces",
] as const;
export type UsersSortKey = (typeof USERS_SORT_KEYS)[number];

export const WORKSPACES_SORT_KEYS = [
  "created_at",
  "name",
  "members",
  "projects",
  "last_activity",
] as const;
export type WorkspacesSortKey = (typeof WORKSPACES_SORT_KEYS)[number];

export const USER_STATUS_FILTERS = [
  "all",
  "active",
  "pending",
  "banned",
  "no_profile",
] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

export const WORKSPACE_VIEWS = ["all", "attention", "FREE", "PRO", "TEAM"] as const;
export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number];

/** Whitelists for admin_subscriptions_list (migration 029). Unknown
 *  values fall back to the default, mirroring the SQL CASE blocks. */
export const SUBSCRIPTIONS_SORT_KEYS = [
  "name",
  "plan",
  "status",
  "period_end",
  "projects",
  "tasks",
  "updated_at",
] as const;
export type SubscriptionsSortKey = (typeof SUBSCRIPTIONS_SORT_KEYS)[number];

export const SUBSCRIPTION_PLAN_FILTERS = ["all", "FREE", "PRO", "TEAM"] as const;
export type SubscriptionPlanFilter = (typeof SUBSCRIPTION_PLAN_FILTERS)[number];

export const SUBSCRIPTION_STATUS_FILTERS = [
  "all",
  "active",
  "trialing",
  "past_due",
  "cancelled",
  "expired",
  "implicit_free",
] as const;
export type SubscriptionStatusFilter =
  (typeof SUBSCRIPTION_STATUS_FILTERS)[number];

export const ADMIN_PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
/** Upper bound on the page number. Deeper pages are refused by clamping,
 *  not by an unbounded OFFSET — the same reasoning as the SQL limit clamp. */
export const MAX_PAGE = 1_000;
/** Search strings are trimmed and bounded; 200 chars covers any email,
 *  username or workspace slug in practice and keeps the pattern sane. */
export const MAX_SEARCH_LENGTH = 200;

export type UsersListQuery = {
  search: string | null;
  status: UserStatusFilter;
  sort: UsersSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

export type WorkspacesListQuery = {
  search: string | null;
  view: WorkspaceView;
  sort: WorkspacesSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

export type SubscriptionsListQuery = {
  search: string | null;
  plan: SubscriptionPlanFilter;
  status: SubscriptionStatusFilter;
  sort: SubscriptionsSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

/** Any normalized admin list query. Extended as new list screens land;
 *  helpers below only touch the keys they understand. */
export type AdminListQuery =
  | UsersListQuery
  | WorkspacesListQuery
  | SubscriptionsListQuery;

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** SearchParams can carry repeated keys as arrays; the first value wins,
 *  matching how the rest of Next treats single-valued fields. */
export function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseSearch(value: string | string[] | undefined): string | null {
  const raw = firstValue(value);
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_SEARCH_LENGTH);
}

export function parsePage(value: string | string[] | undefined): number {
  const n = Number.parseInt(firstValue(value) ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

export function parsePageSize(value: string | string[] | undefined): number {
  const n = Number.parseInt(firstValue(value) ?? "", 10);
  return (ADMIN_PAGE_SIZES as readonly number[]).includes(n)
    ? n
    : DEFAULT_PAGE_SIZE;
}

export function parseDirection(value: string | string[] | undefined): SortDirection {
  return firstValue(value) === "asc" ? "asc" : "desc";
}

/** Direction resolution for a full list query: an explicit ?dir wins; an
 *  absent one inherits the canonical direction OF THE ACTIVE SORT. This is
 *  the other half of listHref's URL-cleanliness contract — a stripped
 *  dir=asc on sort=name must round-trip back to asc. */
export function parseDirectionFor(
  value: string | string[] | undefined,
  sortKey: string
): SortDirection {
  const raw = firstValue(value);
  if (raw === "asc" || raw === "desc") return raw;
  return defaultDirectionFor(sortKey);
}

function parseSort<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = firstValue(value);
  return (allowed as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;
}

export function parseUsersListQuery(sp: RawSearchParams): UsersListQuery {
  const sort = parseSort(sp.sort, USERS_SORT_KEYS, "created_at");
  return {
    search: parseSearch(sp.q),
    status: parseSort(sp.status, USER_STATUS_FILTERS, "all"),
    sort,
    direction: parseDirectionFor(sp.dir, sort),
    page: parsePage(sp.page),
    pageSize: parsePageSize(sp.size),
  };
}

export function parseWorkspacesListQuery(sp: RawSearchParams): WorkspacesListQuery {
  const sort = parseSort(sp.sort, WORKSPACES_SORT_KEYS, "created_at");
  return {
    search: parseSearch(sp.q),
    view: parseSort(sp.view, WORKSPACE_VIEWS, "all"),
    sort,
    direction: parseDirectionFor(sp.dir, sort),
    page: parsePage(sp.page),
    pageSize: parsePageSize(sp.size),
  };
}

export function parseSubscriptionsListQuery(sp: RawSearchParams): SubscriptionsListQuery {
  const sort = parseSort(sp.sort, SUBSCRIPTIONS_SORT_KEYS, "plan");
  return {
    search: parseSearch(sp.q),
    plan: parseSort(sp.plan, SUBSCRIPTION_PLAN_FILTERS, "all"),
    status: parseSort(sp.status, SUBSCRIPTION_STATUS_FILTERS, "all"),
    sort,
    direction: parseDirectionFor(sp.dir, sort),
    page: parsePage(sp.page),
    pageSize: parsePageSize(sp.size),
  };
}

/** True when a list query is doing anything beyond "show me page 1".
 *  Drives the Clear-filters affordance. */
export function hasActiveListFilters(q: AdminListQuery): boolean {
  const defaults: Record<string, unknown> = {
    search: null,
    // Default sorts differ per screen; "created_at" and "plan" are both
    // canonical — a query is unfiltered when its sort is its own default.
    sort: "created_at",
    direction: "desc",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    status: "all",
    view: "all",
    plan: "all",
  };
  if ("plan" in q && q.sort === "plan") {
    defaults.sort = "plan";
  }
  return Object.keys(defaults).some(
    (key) =>
      key in (q as Record<string, unknown>) &&
      (q as Record<string, unknown>)[key] !== defaults[key]
  );
}

/** The direction that is canonical for a sort key: name-like columns read
 *  best ascending first; magnitudes and timestamps newest-first. Used both
 *  when building hrefs (so canonical state never appears in the URL) and
 *  nowhere else — parse + build share this one definition. */
export function defaultDirectionFor(sortKey: string): SortDirection {
  return ["name", "email", "slug"].includes(sortKey) ? "asc" : "desc";
}

/** Builds a link that replaces some params and keeps the rest. Canonical
 *  values are stripped, so ?sort=created_at&dir=desc&page=1 — the same
 *  state as the bare path — collapses to the bare path. `null` deletes a
 *  key. Used by sort headers, pagination and the toolbar alike. */
export function listHref(
  pathname: string,
  current: AdminListQuery,
  overrides: Record<string, string | number | null> = {}
): string {
  const params = new URLSearchParams();
  if (current.search) params.set("q", current.search);
  params.set("sort", current.sort);
  params.set("dir", current.direction);
  params.set("page", String(current.page));
  params.set("size", String(current.pageSize));
  if ("status" in current) params.set("status", current.status);
  if ("view" in current) params.set("view", current.view);
  if ("plan" in current) params.set("plan", current.plan);
  // PR3 read-only feeds carry one additional server-validated filter.
  // Keeping it here makes pagination and sort links preserve the active
  // activity/audit filter just like the directory filters above.
  if ("action" in current && typeof current.action === "string" && current.action !== "all") {
    params.set("action", current.action);
  }
  if ("outcome" in current && typeof current.outcome === "string" && current.outcome !== "all") {
    params.set("outcome", current.outcome);
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, String(value));
  }

  const dropIfCanonical = (key: string, canonical: string) => {
    if (params.get(key) === canonical) params.delete(key);
  };
  const activeSort = params.get("sort") ?? "created_at";
  // Canonical sorts differ per screen: the directory defaults to
  // created_at, subscriptions to plan. Either collapses to the bare path.
  const defaultSort = "plan" in current ? "plan" : "created_at";
  dropIfCanonical("sort", defaultSort);
  dropIfCanonical("dir", defaultDirectionFor(activeSort));
  dropIfCanonical("page", "1");
  dropIfCanonical("size", String(DEFAULT_PAGE_SIZE));
  dropIfCanonical("status", "all");
  dropIfCanonical("view", "all");
  dropIfCanonical("plan", "all");

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Where a sort header should point when clicked: same query, new sort,
 *  direction flipped only when that column is already the active sort. */
export function nextSortHref(
  pathname: string,
  current: AdminListQuery,
  sortKey: string
): { href: string; state: "none" | "asc" | "desc" } {
  const isActive = current.sort === sortKey;
  const state = isActive ? current.direction : "none";
  const nextDir = isActive
    ? current.direction === "asc"
      ? "desc"
      : "asc"
    : defaultDirectionFor(sortKey);
  return {
    href: listHref(pathname, current, { sort: sortKey, dir: nextDir, page: 1 }),
    state,
  };
}

/** A directory id from the URL. Only a well-formed uuid reaches the RPC;
 *  anything else is a not-found without a round trip. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseDirectoryId(
  value: string | string[] | undefined
): string | null {
  const raw = firstValue(value);
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

// ------------------------------------------------------------
// Payload guards
// ------------------------------------------------------------

function isObj(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStr(value: unknown): value is string {
  return typeof value === "string";
}

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBool(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/** null passes; when present it must be a string. */
function isStrOrNull(value: unknown): boolean {
  return value === null || isStr(value);
}

const ACCOUNT_STATUSES: AdminAccountStatus[] = ["active", "pending", "banned"];

function isUserRow(value: unknown): value is AdminUsersListPayload["items"][number] {
  if (!isObj(value)) return false;
  const memberships = value.memberships;
  return (
    isStr(value.user_id) &&
    isStrOrNull(value.email) &&
    isStrOrNull(value.display_name) &&
    isStrOrNull(value.username) &&
    isBool(value.has_profile) &&
    isStr(value.created_at) &&
    isStrOrNull(value.last_sign_in_at) &&
    isStrOrNull(value.last_activity_at) &&
    isBool(value.email_confirmed) &&
    isStrOrNull(value.banned_until) &&
    ACCOUNT_STATUSES.includes(value.account_status as AdminAccountStatus) &&
    isObj(memberships) &&
    isNum(memberships.total) &&
    isNum(memberships.active) &&
    isNum(memberships.owned) &&
    (value.platform_role === null || isPlatformAdminRole(value.platform_role))
  );
}

/** Shared envelope check: page bookkeeping fields the list RPCs must carry. */
function hasListEnvelope(payload: Record<string, unknown>): boolean {
  return (
    isStr(payload.generated_at) &&
    isNum(payload.page) &&
    isNum(payload.page_size) &&
    isNum(payload.total) &&
    isStr(payload.sort) &&
    (payload.direction === "asc" || payload.direction === "desc") &&
    isStrOrNull(payload.search) &&
    Array.isArray(payload.items)
  );
}

export function isUsersListPayload(value: unknown): value is AdminUsersListPayload {
  if (!isObj(value) || !hasListEnvelope(value)) return false;
  if (!isStr(value.status)) return false;
  return (value.items as unknown[]).every(isUserRow);
}

export function isWorkspacesListPayload(
  value: unknown
): value is AdminWorkspacesListPayload {
  if (!isObj(value) || !hasListEnvelope(value)) return false;
  if (!isStr(value.view)) return false;
  return (value.items as unknown[]).every((item) => {
    if (!isObj(item)) return false;
    const owner = item.owner;
    const members = item.members;
    return (
      isStr(item.workspace_id) &&
      isStr(item.name) &&
      isStr(item.slug) &&
      isStr(item.created_at) &&
      isStr(item.updated_at) &&
      isStrOrNull(item.last_activity_at) &&
      isObj(owner) &&
      isStr(owner.user_id) &&
      isStrOrNull(owner.email) &&
      isStrOrNull(owner.display_name) &&
      isStrOrNull(owner.username) &&
      isObj(members) &&
      isNum(members.total) &&
      isNum(members.active) &&
      isNum(item.projects) &&
      isNum(item.tasks) &&
      ["FREE", "PRO", "TEAM"].includes(String(item.plan)) &&
      isBool(item.has_subscription) &&
      isStrOrNull(item.subscription_status) &&
      isBool(item.has_active_owner)
    );
  });
}

export function isUserDetailPayload(value: unknown): value is AdminUserDetail {
  if (!isObj(value) || !isStr(value.generated_at)) return false;
  const identity = value.identity;
  const account = value.account;
  const platform = value.platform_admin;
  const usage = value.usage;
  if (!isObj(identity) || !isObj(account) || !isObj(platform) || !isObj(usage)) {
    return false;
  }
  const identityOk =
    isStr(identity.user_id) &&
    isStrOrNull(identity.email) &&
    isStrOrNull(identity.display_name) &&
    isStrOrNull(identity.username) &&
    isStrOrNull(identity.job_title) &&
    isStrOrNull(identity.bio) &&
    isStrOrNull(identity.avatar_url) &&
    isStr(identity.created_at) &&
    isStrOrNull(identity.profile_created_at) &&
    isStrOrNull(identity.profile_updated_at);
  const accountOk =
    isBool(account.has_profile) &&
    isBool(account.email_confirmed) &&
    isStrOrNull(account.email_confirmed_at) &&
    isStrOrNull(account.last_sign_in_at) &&
    isStrOrNull(account.banned_until) &&
    isBool(account.onboarding_completed) &&
    ACCOUNT_STATUSES.includes(account.account_status as AdminAccountStatus) &&
    isStrOrNull(account.last_activity_at);
  const platformOk =
    isBool(platform.is_admin) &&
    (platform.role === null || isPlatformAdminRole(platform.role)) &&
    isStrOrNull(platform.status) &&
    isStrOrNull(platform.since) &&
    isStrOrNull(platform.note);
  const usageOk = [
    "memberships_total", "memberships_active", "workspaces_owned",
    "tasks_created", "tasks_assigned", "tasks_open", "tasks_done",
    "projects_owned", "goals_created", "notifications_unread", "activity_events",
  ].every((key) => isNum(usage[key]));
  const workspacesOk =
    Array.isArray(value.workspaces) &&
    value.workspaces.every((ws) => {
      if (!isObj(ws)) return false;
      return (
        isStr(ws.workspace_id) &&
        isStr(ws.name) &&
        isStr(ws.slug) &&
        isStr(ws.role) &&
        isStr(ws.membership_status) &&
        isStr(ws.joined_at) &&
        isBool(ws.is_creator)
      );
    });
  const activityOk =
    Array.isArray(value.recent_activity) &&
    value.recent_activity.every((entry) => {
      if (!isObj(entry)) return false;
      return (
        isStr(entry.activity_id) &&
        isStr(entry.workspace_id) &&
        isStr(entry.workspace_name) &&
        isStrOrNull(entry.action) &&
        isStrOrNull(entry.entity_type) &&
        isStr(entry.occurred_at)
      );
    });
  return (
    identityOk && accountOk && platformOk && usageOk && workspacesOk && activityOk
  );
}

export function isWorkspaceDetailPayload(
  value: unknown
): value is AdminWorkspaceDetail {
  if (!isObj(value) || !isStr(value.generated_at)) return false;
  const overview = value.overview;
  const owner = value.owner;
  const health = value.health;
  const usage = value.usage;
  if (!isObj(overview) || !isObj(health) || !isObj(usage)) return false;
  if (owner !== null && !isObj(owner)) return false;
  const overviewOk =
    isStr(overview.workspace_id) &&
    isStr(overview.name) &&
    isStr(overview.slug) &&
    isStrOrNull(overview.description) &&
    isStrOrNull(overview.icon) &&
    isStrOrNull(overview.color) &&
    isStr(overview.created_at) &&
    isStr(overview.updated_at) &&
    isStrOrNull(overview.last_activity_at);
  const ownerOk =
    owner === null ||
    (isStr(owner.user_id) &&
      isStrOrNull(owner.email) &&
      isStrOrNull(owner.display_name) &&
      isStrOrNull(owner.username) &&
      ACCOUNT_STATUSES.includes(owner.account_status as AdminAccountStatus) &&
      isStrOrNull(owner.last_sign_in_at));
  const healthOk = isBool(health.has_active_owner) && isNum(health.member_count_active);
  const usageOk = [
    "projects", "tasks", "goals", "events", "notifications", "signals", "missions",
  ].every((key) => isNum(usage[key]));
  const subscriptionOk =
    Array.isArray(value.subscription) &&
    value.subscription.every((row) => {
      if (!isObj(row)) return false;
      return (
        isStr(row.subscription_id) &&
        ["FREE", "PRO", "TEAM"].includes(String(row.plan)) &&
        isStr(row.status) &&
        isStrOrNull(row.trial_ends_at) &&
        isStrOrNull(row.current_period_end) &&
        isBool(row.has_billing_ids) &&
        isStr(row.updated_at)
      );
    });
  const membersOk =
    Array.isArray(value.members) &&
    value.members.every((row) => {
      if (!isObj(row)) return false;
      return (
        isStr(row.user_id) &&
        isStrOrNull(row.email) &&
        isStrOrNull(row.display_name) &&
        isStrOrNull(row.username) &&
        isStr(row.role) &&
        isStr(row.membership_status) &&
        isStr(row.joined_at) &&
        ACCOUNT_STATUSES.includes(row.account_status as AdminAccountStatus) &&
        isBool(row.is_creator)
      );
    });
  const tasksByStatusOk =
    isObj(value.tasks_by_status) &&
    Object.values(value.tasks_by_status).every(isNum);
  const projectsOk =
    Array.isArray(value.recent_projects) &&
    value.recent_projects.every((row) => {
      if (!isObj(row)) return false;
      return (
        isStr(row.project_id) &&
        isStr(row.name) &&
        isStr(row.status) &&
        isNum(row.progress) &&
        isStrOrNull(row.due_date) &&
        isStr(row.updated_at) &&
        isNum(row.tasks_total) &&
        isNum(row.tasks_done)
      );
    });
  const tasksOk =
    Array.isArray(value.recent_tasks) &&
    value.recent_tasks.every((row) => {
      if (!isObj(row)) return false;
      return (
        isStr(row.task_id) &&
        isStr(row.title) &&
        isStr(row.status) &&
        isStr(row.priority) &&
        isStrOrNull(row.due_at) &&
        isStrOrNull(row.completed_at) &&
        isStr(row.updated_at) &&
        isStrOrNull(row.project_id) &&
        isStrOrNull(row.assignee_id)
      );
    });
  const activityOk =
    Array.isArray(value.recent_activity) &&
    value.recent_activity.every((row) => {
      if (!isObj(row)) return false;
      return (
        isStr(row.activity_id) &&
        isStrOrNull(row.actor_id) &&
        isStrOrNull(row.actor_email) &&
        isStrOrNull(row.action) &&
        isStrOrNull(row.entity_type) &&
        isStr(row.occurred_at)
      );
    });
  return (
    overviewOk &&
    ownerOk &&
    healthOk &&
    usageOk &&
    subscriptionOk &&
    membersOk &&
    tasksByStatusOk &&
    projectsOk &&
    tasksOk &&
    activityOk
  );
}

/** Truncated id for display; the full value stays in the title attribute. */
export function shortId(id: string, keep = 8): string {
  if (id.length <= keep * 2 + 1) return id;
  return `${id.slice(0, keep)}…${id.slice(-4)}`;
}

// ------------------------------------------------------------
// Subscriptions payload guard (migration 029)
// ------------------------------------------------------------

const SUBSCRIPTION_STATUSES: AdminSubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
  "cancelled",
  "expired",
];

function isSubscriptionRow(
  value: unknown
): value is AdminSubscriptionsListPayload["items"][number] {
  if (!isObj(value)) return false;
  const owner = value.owner;
  const usage = value.usage;
  const limits = value.limits;
  return (
    isStr(value.workspace_id) &&
    isStr(value.name) &&
    isStr(value.slug) &&
    ["FREE", "PRO", "TEAM"].includes(String(value.plan)) &&
    isBool(value.has_subscription) &&
    (value.subscription_status === null ||
      SUBSCRIPTION_STATUSES.includes(
        value.subscription_status as AdminSubscriptionStatus
      )) &&
    isStrOrNull(value.current_period_end) &&
    isStrOrNull(value.trial_ends_at) &&
    isStrOrNull(value.subscription_updated_at) &&
    isBool(value.billing_wired) &&
    isNum(value.previous_rows) &&
    isObj(owner) &&
    isStr(owner.user_id) &&
    isStrOrNull(owner.email) &&
    isStrOrNull(owner.display_name) &&
    isObj(usage) &&
    isNum(usage.projects) &&
    isNum(usage.active_tasks) &&
    isNum(usage.goals) &&
    isNum(usage.members) &&
    isObj(limits) &&
    isNum(limits.projects) &&
    isNum(limits.active_tasks) &&
    isNum(limits.goals) &&
    isBool(value.has_active_owner)
  );
}

export function isSubscriptionsListPayload(
  value: unknown
): value is AdminSubscriptionsListPayload {
  if (!isObj(value) || !hasListEnvelope(value)) return false;
  if (!isStr(value.plan) || !isStr(value.status)) return false;
  const summary = value.summary;
  if (!isObj(summary)) return false;
  const plans = summary.plans;
  const statuses = summary.statuses;
  const summaryOk =
    isNum(summary.workspaces) &&
    isNum(summary.attention) &&
    isObj(plans) &&
    isNum(plans.free) &&
    isNum(plans.pro) &&
    isNum(plans.team) &&
    isObj(statuses) &&
    isNum(statuses.active) &&
    isNum(statuses.trialing) &&
    isNum(statuses.past_due) &&
    isNum(statuses.cancelled) &&
    isNum(statuses.expired) &&
    isNum(statuses.implicit_free);
  if (!summaryOk) return false;
  return (value.items as unknown[]).every(isSubscriptionRow);
}
