import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  computeProfileCompleteness,
  type ProfileMissing,
} from "@/lib/profile-state";

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
  /**
   * The name the user (or their OAuth provider) actually provided.
   * `null` means "no name yet" — render a UI fallback, never invent one.
   */
  displayName: string | null;
  username: string | null;
  email?: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  /** UI guidance only: name AND username both exist. */
  profileComplete: boolean;
  profileMissing: ProfileMissing[];
};

export const getProfileSummary = cache(
  async (): Promise<ProfileSummary> => {
    const user = await requireUser();
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "display_name, username, job_title, avatar_url, bio"
      )
      .eq("id", user.id)
      .maybeSingle();

    const displayName =
      typeof profile?.display_name === "string" &&
      profile.display_name.trim() !== ""
        ? profile.display_name.trim()
        : null;
    const username =
      typeof profile?.username === "string" && profile.username.trim() !== ""
        ? profile.username.trim()
        : null;
    const avatarUrl =
      typeof profile?.avatar_url === "string" && profile.avatar_url.trim() !== ""
        ? profile.avatar_url.trim()
        : null;
    const jobTitle =
      typeof profile?.job_title === "string" && profile.job_title.trim() !== ""
        ? profile.job_title.trim()
        : null;
    const bio =
      typeof profile?.bio === "string" && profile.bio.trim() !== ""
        ? profile.bio.trim()
        : null;

    const completeness = computeProfileCompleteness(
      displayName,
      username,
      avatarUrl
    );

    return {
      displayName,
      username,
      email: user.email ?? undefined,
      jobTitle,
      avatarUrl,
      bio,
      profileComplete: completeness.complete,
      profileMissing: completeness.missing,
    };
  }
);
