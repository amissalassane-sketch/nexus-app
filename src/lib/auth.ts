import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// NEXUS — SERVER AUTH HELPERS
// `cache()` dedupes the Supabase call inside a single request, so a layout
// and its page can both ask for the current user without paying twice.
// ============================================================

export const getAuthenticatedUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return user;
}

export type ProfileSummary = {
  displayName: string;
  username?: string;
  email?: string;
  onboardingCompleted: boolean;
};

export const getProfileSummary = cache(async (): Promise<ProfileSummary> => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  return {
    displayName:
      profile?.display_name || profile?.username || user.email || "User",
    username: profile?.username || undefined,
    email: user.email ?? undefined,
    onboardingCompleted: profile?.onboarding_completed === true,
  };
});
