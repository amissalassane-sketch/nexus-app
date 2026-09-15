// ============================================================
// NEXUS ADMIN — DIRECTORY READS (USERS & WORKSPACES)
// ============================================================
// The server-side half of /admin/users and /admin/workspaces. One RPC
// per screen — never per row — against the 027 functions, each of which
// re-checks `admin_assert_access('viewer')` in the database before
// returning anything. The guard in the layout is the front door; the
// gate inside every function is the deadbolt, identical to the Overview.
//
// The state contract, inherited from data.ts and enforced by the
// payload guards in query.ts:
//
//   ok + items     → render the data
//   ok + 0 items   → render an honest EMPTY state ("nothing matched")
//   !ok            → render the ERROR state with Retry
//   detail null    → render NOT FOUND (the RPC answered: no such row)
//   detail error   → render UNAVAILABLE — never "not found", never zeros
//
// A failed read can never collapse into "0 users" or into a user that
// "doesn't exist": those lead to opposite operator decisions.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { withTimeout } from "@/lib/auth-flow";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { classify } from "./data";
import {
  isUserDetailPayload,
  isUsersListPayload,
  isWorkspaceDetailPayload,
  isWorkspacesListPayload,
  type UsersListQuery,
  type WorkspacesListQuery,
} from "./query";
import type {
  AdminDataError,
  AdminUserDetail,
  AdminUsersListPayload,
  AdminWorkspaceDetail,
  AdminWorkspacesListPayload,
} from "./types";

/** Lists aggregate over every account/workspace; the bound is the same
 *  the Overview uses for its whole-platform aggregate. A directory read
 *  that stalls becomes an error panel with Retry, never a hang. */
const LIST_TIMEOUT_MS = 10_000;
const DETAIL_TIMEOUT_MS = 10_000;

const LIST_TIMEOUT_TAG = "ADMIN_DIRECTORY_LIST_TIMEOUT";
const DETAIL_TIMEOUT_TAG = "ADMIN_DIRECTORY_DETAIL_TIMEOUT";

type RpcResult = {
  data: unknown;
  error: { code?: string | null; message?: string | null } | null;
};

/** Calls an admin RPC with the timeout + abort discipline established by
 *  the guard and the Overview reads: a stall cancels the request instead
 *  of leaving it running behind a page nobody is waiting on. Exported for
 *  the unit suite — every state transition below is driven through a fake
 *  client rather than reimplemented in the test. */
export async function callAdminRpc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
  timeoutMs: number,
  tag: string
): Promise<RpcResult> {
  const controller = new AbortController();
  try {
    const result = await withTimeout<RpcResult>(
      Promise.resolve(
        supabase.rpc(fn, args).abortSignal(controller.signal) as PromiseLike<RpcResult>
      ),
      timeoutMs,
      tag,
      controller
    );
    return result;
  } catch (cause) {
    const message =
      cause instanceof Error && cause.message.includes(tag)
        ? "timed out"
        : cause instanceof Error
          ? cause.message
          : "unknown";
    return { data: null, error: { code: null, message } };
  }
}

// ------------------------------------------------------------
// Results — the four outcomes, kept as four outcomes
// ------------------------------------------------------------

export type AdminUsersListResult =
  | { state: "ok"; payload: AdminUsersListPayload }
  /** The read succeeded and nothing matched. A fact about the platform,
   *  not a failure. */
  | { state: "empty"; payload: AdminUsersListPayload }
  | { state: "unavailable"; error: AdminDataError };

export type AdminWorkspacesListResult =
  | { state: "ok"; payload: AdminWorkspacesListPayload }
  | { state: "empty"; payload: AdminWorkspacesListPayload }
  | { state: "unavailable"; error: AdminDataError };

export type AdminUserDetailResult =
  | { state: "found"; detail: AdminUserDetail }
  /** The RPC answered and the row does not exist. */
  | { state: "not_found" }
  | { state: "unavailable"; error: AdminDataError };

export type AdminWorkspaceDetailResult =
  | { state: "found"; detail: AdminWorkspaceDetail }
  | { state: "not_found" }
  | { state: "unavailable"; error: AdminDataError };

// ------------------------------------------------------------
// List reads
// ------------------------------------------------------------

async function readUsersListRpc(
  supabase: SupabaseClient,
  q: UsersListQuery
): Promise<AdminUsersListResult> {
  const result = await callAdminRpc(
    supabase,
    "admin_users_list",
    {
      p_search: q.search,
      p_status: q.status,
      p_sort: q.sort,
      p_direction: q.direction,
      p_page: q.page,
      p_page_size: q.pageSize,
    },
    LIST_TIMEOUT_MS,
    LIST_TIMEOUT_TAG
  );

  if (result.error) return { state: "unavailable", error: classify(result.error) };
  if (!isUsersListPayload(result.data)) {
    return {
      state: "unavailable",
      error: {
        code: "INVALID_PAYLOAD",
        message: "admin_users_list() returned an unexpected shape.",
      },
    };
  }

  // "empty" means "the read succeeded and this page has no rows". The
  // page decides whether that is "nothing matches" (total 0) or "page
  // out of range" (total > 0) from the payload's own total.
  return result.data.items.length === 0
    ? { state: "empty", payload: result.data }
    : { state: "ok", payload: result.data };
}

async function readWorkspacesListRpc(
  supabase: SupabaseClient,
  q: WorkspacesListQuery
): Promise<AdminWorkspacesListResult> {
  const result = await callAdminRpc(
    supabase,
    "admin_workspaces_list",
    {
      p_search: q.search,
      p_view: q.view,
      p_sort: q.sort,
      p_direction: q.direction,
      p_page: q.page,
      p_page_size: q.pageSize,
    },
    LIST_TIMEOUT_MS,
    LIST_TIMEOUT_TAG
  );

  if (result.error) return { state: "unavailable", error: classify(result.error) };
  if (!isWorkspacesListPayload(result.data)) {
    return {
      state: "unavailable",
      error: {
        code: "INVALID_PAYLOAD",
        message: "admin_workspaces_list() returned an unexpected shape.",
      },
    };
  }

  return result.data.items.length === 0
    ? { state: "empty", payload: result.data }
    : { state: "ok", payload: result.data };
}

async function readUserDetailRpc(
  supabase: SupabaseClient,
  userId: string
): Promise<AdminUserDetailResult> {
  const result = await callAdminRpc(
    supabase,
    "admin_user_detail",
    { p_user_id: userId },
    DETAIL_TIMEOUT_MS,
    DETAIL_TIMEOUT_TAG
  );

  if (result.error) return { state: "unavailable", error: classify(result.error) };
  // NULL from the RPC is the designed "no such account" answer. It is
  // not_found, never unavailable, because the database did answer.
  if (result.data === null) return { state: "not_found" };
  if (!isUserDetailPayload(result.data)) {
    return {
      state: "unavailable",
      error: {
        code: "INVALID_PAYLOAD",
        message: "admin_user_detail() returned an unexpected shape.",
      },
    };
  }
  return { state: "found", detail: result.data };
}

async function readWorkspaceDetailRpc(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<AdminWorkspaceDetailResult> {
  const result = await callAdminRpc(
    supabase,
    "admin_workspace_detail",
    { p_workspace_id: workspaceId },
    DETAIL_TIMEOUT_MS,
    DETAIL_TIMEOUT_TAG
  );

  if (result.error) return { state: "unavailable", error: classify(result.error) };
  if (result.data === null) return { state: "not_found" };
  if (!isWorkspaceDetailPayload(result.data)) {
    return {
      state: "unavailable",
      error: {
        code: "INVALID_PAYLOAD",
        message: "admin_workspace_detail() returned an unexpected shape.",
      },
    };
  }
  return { state: "found", detail: result.data };
}

// Exported individually so tests drive the state transitions with fake
// clients (same pattern as readActivity in data.ts).
export const __internals = {
  readUsersListRpc,
  readWorkspacesListRpc,
  readUserDetailRpc,
  readWorkspaceDetailRpc,
};

// ------------------------------------------------------------
// Page entry points
// ------------------------------------------------------------

/** A read path shared by all four entry points: no session → FORBIDDEN
 *  (the layout normally catches this first); no Supabase → NOT_INSTALLED.
 *  Failures here are reported, never swallowed into an empty list. */
async function resolveReadClient(): Promise<
  { supabase: SupabaseClient } | { error: AdminDataError }
> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: { code: "FORBIDDEN", message: "Not signed in." } };
  }
  if (!isSupabaseConfigured()) {
    return {
      error: {
        code: "NOT_INSTALLED",
        message:
          "Supabase is not configured, so there is no directory data to show.",
      },
    };
  }
  return { supabase: await createClient() };
}

export async function getAdminUsersList(
  query: UsersListQuery
): Promise<AdminUsersListResult> {
  const resolved = await resolveReadClient();
  if ("error" in resolved) {
    return { state: "unavailable", error: resolved.error };
  }
  return readUsersListRpc(resolved.supabase, query);
}

export async function getAdminWorkspacesList(
  query: WorkspacesListQuery
): Promise<AdminWorkspacesListResult> {
  const resolved = await resolveReadClient();
  if ("error" in resolved) {
    return { state: "unavailable", error: resolved.error };
  }
  return readWorkspacesListRpc(resolved.supabase, query);
}

export async function getAdminUserDetail(
  userId: string
): Promise<AdminUserDetailResult> {
  const resolved = await resolveReadClient();
  if ("error" in resolved) {
    return { state: "unavailable", error: resolved.error };
  }
  return readUserDetailRpc(resolved.supabase, userId);
}

export async function getAdminWorkspaceDetail(
  workspaceId: string
): Promise<AdminWorkspaceDetailResult> {
  const resolved = await resolveReadClient();
  if ("error" in resolved) {
    return { state: "unavailable", error: resolved.error };
  }
  return readWorkspaceDetailRpc(resolved.supabase, workspaceId);
}
