"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isPlanLimitError } from "@/lib/plan-errors";
import { NexusLogo } from "@/components/nexus-logo";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

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
          typeof user.user_metadata?.username === "string"
            ? user.user_metadata.username
            : "";
        setUsername(metadataUsername || fallbackUsername(user.email));
      }

      if (profile?.onboarding_completed === true) {
        router.replace("/dashboard");
        return;
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

    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: cleanDisplayName,
      username: cleanUsername,
      bio: cleanBio,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      if (upsertError.message.toLowerCase().includes("row-level security")) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setError(upsertError.message);
      setSaving(false);
      return;
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);

    if (membershipError) {
      setError(membershipError.message);
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
          isPlanLimitError(workspaceError.message)
            ? "Your plan does not allow another workspace. Visit /upgrade to unlock more."
            : workspaceError.message
        );
        setSaving(false);
        return;
      }
    }

    router.replace("/dashboard");
    router.refresh();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
        <div className="flex flex-col items-center gap-3">
          <NexusLogo size={32} className="opacity-60" priority />
          <p className="text-small text-text-secondary">Loading your workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4 py-10">
      <div className="w-full max-w-[440px] rounded-auth border border-border-default bg-bg-subtle p-8 shadow-auth">
        <div className="mb-7 flex flex-col items-center text-center">
          <NexusLogo size={48} priority className="mb-5" />
          <h1 className="text-h1 text-text-primary">Complete your profile</h1>
          <p className="mt-1 text-small text-text-secondary">
            Finish setup so you can access your NEXUS dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Full name" htmlFor="onboarding-name">
            <Input
              id="onboarding-name"
              size="lg"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your full name"
              required
            />
          </Field>

          <Field label="Username" htmlFor="onboarding-username">
            <Input
              id="onboarding-username"
              size="lg"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="yourusername"
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              required
            />
          </Field>

          <Field label="Bio" htmlFor="onboarding-bio">
            <Textarea
              id="onboarding-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell people a little about yourself"
              rows={4}
            />
          </Field>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button type="submit" size="lg" disabled={saving} className="mt-1 w-full">
            {saving ? "Saving..." : "Continue to dashboard"}
          </Button>
        </form>
      </div>
    </main>
  );
}
