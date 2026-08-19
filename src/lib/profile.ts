// ============================================================
// NEXUS — PROFILE SUMMARY (server)
// Single server-side resolution of: user → profile → workspace.
// Every (app) page goes through this so a broken account can
// never wander into a dead dashboard: the (app) layout redirects
// to /onboarding (the repair path) when anything is missing.
// ============================================================

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ProfileSummary = {
  userId: string;
  email: string | null;
  displayName: string;
  username: string | null;
  bio: string | null;
  onboardingCompleted: boolean;
  hasWorkspace: boolean;
  workspaceId: string | null;
  workspaceName: string | null;
  role: string | null;
};

const FALLBACK_NAME = "User";

/**
 * Resolve the current session's user + profile + active workspace.
 * Returns null when there is no authenticated session.
 *
 * NOTE (known pitfall): `.maybeSingle()` on workspace_members requires
 * `.order(...).limit(1)` — order is applied so PostgREST can dedupe.
 */
export const getProfileSummary = cache(async (): Promise<ProfileSummary | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username, bio, onboarding_completed")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let workspaceName: string | null = null;
  if (membership?.workspace_id) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", membership.workspace_id)
      .maybeSingle();
    workspaceName = workspace?.name ?? null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    displayName:
      profile?.display_name || profile?.username || user.email?.split("@")[0] || FALLBACK_NAME,
    username: profile?.username ?? null,
    bio: profile?.bio ?? null,
    onboardingCompleted: profile?.onboarding_completed === true,
    hasWorkspace: Boolean(membership?.workspace_id),
    workspaceId: membership?.workspace_id ?? null,
    workspaceName,
    role: membership?.role ?? null,
  };
});
