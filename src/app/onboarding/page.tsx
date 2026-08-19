"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  const fallbackUsername = (email?: string | null) => {
    const base = email?.split("@")[0] ?? "user";
    return base.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30);
  };

  const createSlug = (value: string) => {
    const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    return `${base || "workspace"}-${suffix}`;
  };

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, username, bio, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (profile?.display_name) {
        setDisplayName(profile.display_name);
      }

      if (profile?.username) {
        setUsername(profile.username);
      }

      if (profile?.bio) {
        setBio(profile.bio);
      }

      if (!profile?.display_name) {
        const metadataName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : "";
        setDisplayName(metadataName || user.email?.split("@")[0] || "");
      }

      if (!profile?.username) {
        const metadataUsername =
          typeof user.user_metadata?.username === "string" ? user.user_metadata.username : "";
        setUsername(metadataUsername || fallbackUsername(user.email));
      }

      if (profile?.onboarding_completed === true) {
        // Only leave the repair path when the account actually works:
        // onboarding completed AND an active workspace membership exists.
        const { data: activeMemberships } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);

        if (activeMemberships && activeMemberships.length > 0) {
          router.replace("/dashboard");
          return;
        }
        // Broken account (P0 repair path): stay here and re-run the form.
      }

      setLoading(false);
    };

    void loadProfile();
  }, [router, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanBio = bio.trim();

    if (!cleanDisplayName) {
      setError("Please enter your full name.");
      setSaving(false);
      return;
    }

    if (!cleanUsername) {
      setError("Please choose a username.");
      setSaving(false);
      return;
    }

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        display_name: cleanDisplayName,
        username: cleanUsername,
        bio: cleanBio,
        onboarding_completed: false,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      setError(
        `Your profile could not be saved: ${upsertError.message}. Nothing was lost — correct the field and try again.`
      );
      setSaving(false);
      return;
    }

    // Repair path: ensure a workspace exists AND the owner membership row
    // exists in the database. A workspace without a membership row is the
    // known P0 failure — never redirect in that state.
    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (membershipError) {
      setError(
        `Your workspace link could not be verified: ${membershipError.message}. Please try again.`
      );
      setSaving(false);
      return;
    }

    if (!memberships || memberships.length === 0) {
      const { error: workspaceError } = await supabase.from("workspaces").insert({
        owner_id: user.id,
        name: `${cleanDisplayName}'s Workspace`,
        slug: createSlug(cleanUsername),
      });

      if (workspaceError) {
        setError(
          `Workspace creation failed: ${workspaceError.message}. You can retry — nothing is duplicated.`
        );
        setSaving(false);
        return;
      }

      // RE-READ after creation: only trust the database, never the insert result.
      const { data: refreshed, error: refreshError } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (refreshError) {
        setError(
          `Workspace was created but your membership could not be read back: ${refreshError.message}.`
        );
        setSaving(false);
        return;
      }

      if (!refreshed || refreshed.length === 0) {
        setError(
          "The workspace was created but your owner membership was not linked automatically. Please contact support with this message — do not retry signup, your account is fine."
        );
        setSaving(false);
        return;
      }
    }

    // Membership verified — NOW onboarding is complete.
    const { error: completeError } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (completeError) {
      setError(
        `Your workspace is ready, but completing onboarding failed: ${completeError.message}.`
      );
      setSaving(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-5 text-white">
        <p className="text-sm text-zinc-400">Loading your workspace...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-5 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-bold text-black">
            N
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Complete your profile</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Finish setup so you can access your NEXUS dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-zinc-400">Full name</label>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your full name"
              required
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-white/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">Username</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="yourusername"
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-white/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">Bio</label>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell people a little about yourself"
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-white/30"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue to dashboard"}
          </button>
        </form>
      </div>
    </main>
  );
}
