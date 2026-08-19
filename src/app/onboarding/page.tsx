"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isPlanLimitError } from "@/lib/plan-errors";
import { NexusLogo } from "@/components/nexus-logo";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — ONBOARDING (3 STEPS)
// 1. Identity (name + username)  2. Intent  3. First value
// The workspace is VERIFIED in the database before
// `onboarding_completed` is set and the user is redirected. If any
// check fails, we stay here and show an actionable error — the
// dashboard never appears "successful" behind a broken workspace.
// ============================================================

const INTENT_OPTIONS = [
  { id: "personal", label: "Personal work", description: "Your own tasks and projects" },
  { id: "project", label: "A project", description: "One defined outcome" },
  { id: "studies", label: "Studies", description: "Courses, deadlines, revision" },
  { id: "team", label: "A team", description: "Shared work with others" },
  { id: "everything", label: "Everything", description: "The whole system, in one place" },
] as const;

type IntentId = (typeof INTENT_OPTIONS)[number]["id"];

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [intent, setIntent] = useState<IntentId | null>(null);
  const [firstKind, setFirstKind] = useState<"project" | "task">("project");
  const [firstTitle, setFirstTitle] = useState("");

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
        .select("display_name, username, onboarding_completed, onboarding_intent")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (profile?.onboarding_completed === true) {
        router.replace("/dashboard");
        return;
      }

      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.username) setUsername(profile.username);
      if (profile?.onboarding_intent) {
        setIntent(profile.onboarding_intent as IntentId);
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

      setLoading(false);
    };

    void loadProfile();
  }, [router, supabase]);

  const canContinue = () => {
    if (step === 1) return displayName.trim().length > 0 && username.trim().length > 0;
    if (step === 2) return intent !== null;
    return true; // step 3 can always skip
  };

  const next = () => {
    setError("");
    if (step < TOTAL_STEPS) setStep((current) => current + 1);
  };

  const back = () => {
    setError("");
    if (step > 1) setStep((current) => current - 1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canContinue()) {
      setError("Please complete this step before continuing.");
      return;
    }

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

    // 1. Persist profile WITHOUT onboarding_completed — it is only set
    //    after the workspace is verified below.
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: cleanDisplayName,
      username: cleanUsername,
      onboarding_intent: intent,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    // 2. Ensure the user has an active workspace membership.
    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (membershipError) {
      setError(`Could not verify your workspace: ${membershipError.message}`);
      setSaving(false);
      return;
    }

    let membership: { workspace_id: string; role: string; status: string } | null =
      memberships?.[0] ?? null;

    // No membership yet — create a personal workspace and its membership.
    if (!membership) {
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          owner_id: user.id,
          name: `${cleanDisplayName}'s Workspace`,
          slug: createSlug(cleanUsername),
        })
        .select("id")
        .single();

      if (workspaceError) {
        setError(
          isPlanLimitError(workspaceError.message)
            ? "Your plan does not allow another workspace. Visit /upgrade to unlock more."
            : `Could not create your workspace: ${workspaceError.message}`
        );
        setSaving(false);
        return;
      }

      // Re-read the membership so we only proceed on verified state.
      const { data: refreshed } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      membership = refreshed?.[0] ?? null;
      void workspace;
    }

    // 3. Verify membership is real and usable before declaring success.
    const validRoles = new Set(["owner", "admin", "member"]);
    if (!membership?.workspace_id) {
      setError(
        "Your workspace could not be established. Please try again or contact support."
      );
      setSaving(false);
      return;
    }
    if (!validRoles.has(String(membership.role))) {
      setError("Your workspace role is invalid. Please try again or contact support.");
      setSaving(false);
      return;
    }

    const workspaceId = membership.workspace_id as string;

    // 4. Create the first value (project or task) when provided.
    if (firstTitle.trim()) {
      if (firstKind === "project") {
        const { error: projectError } = await supabase.from("projects").insert({
          workspace_id: workspaceId,
          owner_id: user.id,
          name: firstTitle.trim(),
        });
        if (projectError) {
          setError(projectError.message);
          setSaving(false);
          return;
        }
      } else {
        const { error: taskError } = await supabase.from("tasks").insert({
          workspace_id: workspaceId,
          title: firstTitle.trim(),
          assignee_id: user.id,
          created_by: user.id,
        });
        if (taskError) {
          setError(taskError.message);
          setSaving(false);
          return;
        }
      }
    }

    // 5. Only now mark onboarding complete, then redirect.
    const { error: completeError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        display_name: cleanDisplayName,
        username: cleanUsername,
        onboarding_intent: intent,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      });

    if (completeError) {
      setError(completeError.message);
      setSaving(false);
      return;
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
        <div className="mb-6 flex flex-col items-center text-center">
          <NexusLogo size={48} priority className="mb-5" />
          <p className="font-mono text-mono uppercase tracking-[0.12em] text-text-tertiary">
            Step {step} of {TOTAL_STEPS}
          </p>
          <h1 className="mt-2 text-h1 text-text-primary">
            {step === 1
              ? "Who are you?"
              : step === 2
                ? "What are you trying to get under control?"
                : "Set up your first value"}
          </h1>
          <p className="mt-1 text-small text-text-secondary">
            {step === 1
              ? "This is how your workspace will recognise you."
              : step === 2
                ? "NEXUS adapts the experience to how you work."
                : "Capture one real thing — or skip for now."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {step === 1 ? (
            <>
              <Field label="Name" htmlFor="onboarding-name">
                <Input
                  id="onboarding-name"
                  size="lg"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
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
            </>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-2">
              {INTENT_OPTIONS.map((option) => {
                const active = intent === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setIntent(option.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-input border px-4 py-3 text-left transition-colors duration-150 ease-nexus",
                      active
                        ? "border-border-focus bg-accent-ghost"
                        : "border-border-default bg-bg-surface hover:border-border-strong"
                    )}
                  >
                    <span>
                      <span className="block text-body-medium text-text-primary">
                        {option.label}
                      </span>
                      <span className="block text-caption text-text-tertiary">
                        {option.description}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-pill",
                        active ? "bg-accent" : "bg-border-strong"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === 3 ? (
            <>
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="First value type">
                {(["project", "task"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="tab"
                    aria-selected={firstKind === kind}
                    onClick={() => setFirstKind(kind)}
                    className={cn(
                      "h-9 rounded-pill border text-button transition-colors duration-150 ease-nexus",
                      firstKind === kind
                        ? "border-transparent bg-accent text-accent-fg"
                        : "border-border-default text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
                    )}
                  >
                    {kind === "project" ? "First project" : "First task"}
                  </button>
                ))}
              </div>

              <Field
                label={firstKind === "project" ? "Project name" : "Task title"}
                htmlFor="onboarding-first"
              >
                <Input
                  id="onboarding-first"
                  size="lg"
                  value={firstTitle}
                  onChange={(event) => setFirstTitle(event.target.value)}
                  placeholder={
                    firstKind === "project"
                      ? "e.g. Launch my portfolio"
                      : "e.g. Draft the outline"
                  }
                />
              </Field>
            </>
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="mt-1 flex items-center gap-2">
            {step > 1 ? (
              <Button type="button" variant="ghost" size="lg" onClick={back} disabled={saving}>
                Back
              </Button>
            ) : null}

            {step < TOTAL_STEPS ? (
              <Button
                type="button"
                size="lg"
                className="flex-1"
                onClick={next}
                disabled={!canContinue()}
              >
                Continue
              </Button>
            ) : (
              <Button type="submit" size="lg" className="flex-1" disabled={saving}>
                {saving ? "Finishing…" : firstTitle.trim() ? "Create & enter NEXUS" : "Skip & enter NEXUS"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
