import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// NEXUS — ACTIVE WORKSPACE RESOLUTION
// Single, shared way of resolving "the workspace the user is currently
// working in", used by both server components and client components.
//
// Why this exists:
//  - the dashboard used `.maybeSingle()` without `limit(1)`, which errors
//    (PGRST116) as soon as a user is an active member of 2+ workspaces
//    (possible on PRO/TEAM), silently showing "no active workspace";
//  - the managers used `order(created_at desc).limit(1)`, so the dashboard
//    and the pages could resolve *different* workspaces for the same user.
//
// The membership row itself is protected by RLS: this only reads what the
// authenticated user is already allowed to read, and every write keeps
// being validated server-side (RLS + plan-limit triggers).
// ============================================================

export type ActiveMembership = {
  workspaceId: string;
  role: string;
};

export type ActiveMembershipResult = {
  membership: ActiveMembership | null;
  error: string | null;
};

export async function getActiveMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<ActiveMembershipResult> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { membership: null, error: error.message };
  }

  if (!data?.workspace_id) {
    return { membership: null, error: null };
  }

  return {
    membership: {
      workspaceId: data.workspace_id as string,
      role: (data.role as string) ?? "member",
    },
    error: null,
  };
}

/** Convenience helper for components that only need the id. */
export async function getActiveWorkspaceId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { membership } = await getActiveMembership(supabase, userId);
  return membership?.workspaceId ?? null;
}

export function canManageBilling(role: string | undefined | null): boolean {
  return role === "owner" || role === "admin";
}
