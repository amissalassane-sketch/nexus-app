// ============================================================
// NEXUS ADMIN — SUBSCRIPTION READS
// ============================================================
// The server-side half of /admin/subscriptions. One RPC per screen
// against the 029 function, which re-checks
// `admin_assert_access('viewer')` in the database before returning
// anything. Same state contract as the directory (directory.ts):
//
//   ok + items     → render the data
//   ok + 0 items   → render an honest EMPTY state ("nothing matched")
//   !ok            → render the ERROR state with Retry
//
// A failed read can never collapse into "0 subscriptions": that
// would tell the operator the platform has no paid workspaces when
// the truth is the database did not answer.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { callAdminRpc, resolveReadClient } from "./directory";
import { classify } from "./data";
import {
  isSubscriptionsListPayload,
  type SubscriptionsListQuery,
} from "./query";
import type {
  AdminDataError,
  AdminSubscriptionsListPayload,
} from "./types";

/** Same bound the directory lists use: a stalled aggregate becomes an
 *  error panel with Retry, never a hang. */
const LIST_TIMEOUT_MS = 10_000;
const LIST_TIMEOUT_TAG = "ADMIN_SUBSCRIPTIONS_LIST_TIMEOUT";

export type AdminSubscriptionsListResult =
  | { state: "ok"; payload: AdminSubscriptionsListPayload }
  /** The read succeeded and nothing matched. A fact about the platform,
   *  not a failure. */
  | { state: "empty"; payload: AdminSubscriptionsListPayload }
  | { state: "unavailable"; error: AdminDataError };

async function readSubscriptionsListRpc(
  supabase: SupabaseClient,
  q: SubscriptionsListQuery
): Promise<AdminSubscriptionsListResult> {
  const result = await callAdminRpc(
    supabase,
    "admin_subscriptions_list",
    {
      p_search: q.search,
      p_plan: q.plan,
      p_status: q.status,
      p_sort: q.sort,
      p_direction: q.direction,
      p_page: q.page,
      p_page_size: q.pageSize,
    },
    LIST_TIMEOUT_MS,
    LIST_TIMEOUT_TAG
  );

  if (result.error) {
    return {
      state: "unavailable",
      error: classify(result.error, "admin_subscriptions_list()"),
    };
  }
  if (!isSubscriptionsListPayload(result.data)) {
    return {
      state: "unavailable",
      error: {
        code: "INVALID_PAYLOAD",
        message: "admin_subscriptions_list() returned an unexpected shape.",
      },
    };
  }

  return result.data.items.length === 0
    ? { state: "empty", payload: result.data }
    : { state: "ok", payload: result.data };
}

// Exported so tests drive the state transitions with fake clients
// (same pattern as the directory __internals).
export const __internals = {
  readSubscriptionsListRpc,
};

export async function getAdminSubscriptionsList(
  query: SubscriptionsListQuery
): Promise<AdminSubscriptionsListResult> {
  const resolved = await resolveReadClient();
  if ("error" in resolved) {
    return { state: "unavailable", error: resolved.error };
  }
  return readSubscriptionsListRpc(resolved.supabase, query);
}
