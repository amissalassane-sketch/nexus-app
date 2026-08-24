"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClientSafe } from "@/lib/supabase/client";
import { isPlanLimitError } from "@/lib/plan-errors";
import { isMissingColumnError } from "@/lib/schema-errors";
import { humanizeDataError } from "@/lib/data-errors";
import { NexusLogo } from "@/components/nexus-logo";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — ONBOARDING (4 STEPS)
// 1. Identity (name + username)  2. Workspace  3. Goal  4. Ready
//
// Refinements:
// - `← Back` on steps 2–4: pure local state, never browser navigation, so
//   every field typed so far survives.
// - `← Back` on step 1 exits the journey to the public landing
//   (`/?from=onboarding`) — a deliberate workflow destination, never
//   history.back() — and parks the typed identity as a local draft so nothing
//   is lost when the user comes back in.
// - Every "Continue" commits only the answers from the completed step. This
//   makes a refresh deterministic without creating a workspace, project, or
//   task before the user explicitly finishes the workflow.
// - Nothing is declared "done" on optimism: every write is read back from the
//   database and verified before the user is redirected. On any failure we
//   STAY here, with the data intact, and explain what happened.
// - The workspace is created idempotently at completion, never duplicated by a
//   refresh, and the profile's onboarding_completed flag is only set after the
//   workspace is verified — and only after the database confirms the write.
// ============================================================

const GOAL_OPTIONS = [
  { id: "visibility", label: "Project visibility", description: "See what is moving and what is stuck" },
  { id: "coordination", label: "Team coordination", description: "Keep shared work aligned" },
  { id: "automation", label: "Workflow automation", description: "Remove repetitive manual steps" },
  { id: "decisions", label: "Decision making", description: "Surface the risks that need you" },
  { id: "intelligence", label: "AI-powered intelligence", description: "Let NEXUS read the work and act" },
  { id: "everything", label: "All of the above", description: "The whole system, connected" },
] as const;

type GoalId = (typeof GOAL_OPTIONS)[number]["id"];

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const clientResult = useMemo(() => createClientSafe(), []);

  if (!clientResult.client) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
        <div className="w-full max-w-[440px]">
          <Alert tone="danger">{clientResult.error}</Alert>
        </div>
      </main>
    );
  }

  return <OnboardingFlow supabase={clientResult.client} />;
}

function OnboardingFlow({ supabase }: { supabase: SupabaseClient }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [onboardingUserId, setOnboardingUserId] = useState("");

  // All answers live at component level: moving between steps only changes
  // `step`, so nothing typed is ever lost.
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [goal, setGoal] = useState<GoalId | null>(null);

  const fallbackUsername = (value?: string | null) => {
    const base = value?.split("@")[0] ?? "user";
    return base.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30);
  };

  const createSlug = (value: string) => {
    const base = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
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
      setOnboardingUserId(user.id);

      // Read the most precise persisted progress available. Older hosted
      // schemas may not have onboarding_intent yet, so fall back without
      // making the whole route unusable.
      let profileResult = await supabase
        .from("profiles")
        .select("display_name, username, onboarding_completed, onboarding_intent")
        .eq("id", user.id)
        .maybeSingle();

      if (
        profileResult.error &&
        isMissingColumnError(profileResult.error.message, "onboarding_intent")
      ) {
        profileResult = await supabase
          .from("profiles")
          .select("display_name, username, onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();
      }

      const profile = profileResult.data as
        | {
            display_name?: string | null;
            username?: string | null;
            onboarding_completed?: boolean | null;
            onboarding_intent?: string | null;
          }
        | null;

      if (profileResult.error) {
        setError(humanizeDataError(profileResult.error, "Your profile could not be loaded. Please try again."));
        setLoading(false);
        return;
      }

      // Completion alone is not enough: only a real active membership makes the
      // dashboard valid. A damaged/missing membership stays in this safe
      // workflow, where finalisation can reconnect an owned workspace.
      if (profile?.onboarding_completed === true) {
        const { data: activeMembership } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (activeMembership?.workspace_id) {
          router.replace("/dashboard");
          return;
        }
      }

      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.username) setUsername(profile.username);

      const metadataIntent =
        typeof user.user_metadata?.onboarding_intent === "string"
          ? user.user_metadata.onboarding_intent
          : "";
      const savedGoal = profile?.onboarding_intent || metadataIntent;
      const hasIdentity = Boolean(profile?.display_name?.trim() && profile?.username?.trim());

      let furthestSafeStep = hasIdentity ? 2 : 1;
      if (savedGoal in GOAL_OPTIONS_MAP) {
        setGoal(savedGoal as GoalId);
        if (hasIdentity) furthestSafeStep = 3;
      }

      // Session storage remembers deliberate Back navigation and unsent UI
      // position, but can never advance beyond database-backed progress.
      let resumeStep = furthestSafeStep;
      try {
        const remembered = Number(sessionStorage.getItem(`nexus:onboarding-step:${user.id}`));
        if (remembered >= 1 && remembered <= furthestSafeStep) resumeStep = remembered;
      } catch {
        // Storage is optional; persisted profile state remains authoritative.
      }
      setStep(resumeStep);

      // A draft identity survives "Back to the landing" from step 1, so
      // nothing typed is lost on the way back in. Prefill only — persisted
      // profile fields and signup metadata always win over it.
      let identityDraft: { displayName?: unknown; username?: unknown } = {};
      try {
        const storedIdentity = localStorage.getItem(`nexus:onboarding-identity:${user.id}`);
        if (storedIdentity) {
          identityDraft = JSON.parse(storedIdentity) as typeof identityDraft;
        }
      } catch {
        // Draft storage is optional; the form remains fully usable.
      }

      if (!profile?.display_name) {
        const metadataName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : "";
        setDisplayName(
          metadataName ||
            (typeof identityDraft.displayName === "string"
              ? identityDraft.displayName.trim()
              : "") ||
            user.email?.split("@")[0] ||
            ""
        );
      }

      if (!profile?.username) {
        const metadataUsername =
          typeof user.user_metadata?.username === "string" ? user.user_metadata.username : "";
        setUsername(
          metadataUsername ||
            (typeof identityDraft.username === "string" ? identityDraft.username.trim() : "") ||
            fallbackUsername(user.email)
        );
      }

      // A draft workspace name survives refreshes on step 2.
      try {
        const storedWorkspace = localStorage.getItem(`nexus:onboarding-workspace:${user.id}`);
        if (storedWorkspace) {
          const parsed = JSON.parse(storedWorkspace) as { name?: unknown };
          if (typeof parsed.name === "string") setWorkspaceName(parsed.name);
        }
      } catch {
        // Draft storage is optional; the form remains fully usable.
      }

      setLoading(false);
    };

    void loadProfile();
  }, [router, supabase]);

  const canContinue = () => {
    if (step === 1) return displayName.trim().length > 0 && username.trim().length > 0;
    if (step === 2) return workspaceName.trim().length > 0;
    if (step === 3) return goal !== null;
    return true; // step 4 (Ready) can always proceed
  };

  // Continue commits only the answers from the completed step. This makes a
  // refresh deterministic without creating a workspace before the user
  // explicitly finishes the workflow.
  const next = async () => {
    setError("");
    if (!canContinue() || step >= TOTAL_STEPS) return;

    setSaving(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      // Step 1 persists identity; step 2 persists the chosen goal (workspace
      // name is held locally until completion, when the workspace itself is
      // created idempotently).
      if (step === 1) {
        const base = {
          id: user.id,
          display_name: displayName.trim(),
          username: username.trim().toLowerCase(),
          updated_at: new Date().toISOString(),
        };
        const saved = await supabase.from("profiles").upsert(base).select("id").maybeSingle();

        if (saved.error || !saved.data?.id) {
          setError(humanizeDataError(saved.error, "Your progress could not be saved. Please try again."));
          return;
        }

        // Step 1 is now persisted in the database — the identity draft has
        // done its job and must not shadow fresher edits later.
        try {
          localStorage.removeItem(`nexus:onboarding-identity:${user.id}`);
        } catch {
          // Storage is optional; the database row is the truth.
        }
      }

      if (step === 2) {
        // Workspace name is parked as a draft; the workspace is created at
        // completion. Persist the draft so a refresh on step 2 keeps it.
        try {
          localStorage.setItem(
            `nexus:onboarding-workspace:${user.id}`,
            JSON.stringify({ name: workspaceName.trim() })
          );
        } catch {
          // Draft storage is optional; local state still holds the value.
        }
      }

      if (step === 3 && goal) {
        const base = {
          id: user.id,
          display_name: displayName.trim(),
          username: username.trim().toLowerCase(),
          updated_at: new Date().toISOString(),
        };
        let saved = await supabase
          .from("profiles")
          .upsert({ ...base, onboarding_intent: goal })
          .select("id")
          .maybeSingle();

        if (saved.error && isMissingColumnError(saved.error.message, "onboarding_intent")) {
          saved = await supabase.from("profiles").upsert(base).select("id").maybeSingle();
        }

        if (saved.error || !saved.data?.id) {
          setError(humanizeDataError(saved.error, "Your progress could not be saved. Please try again."));
          return;
        }

        const metadata = await supabase.auth.updateUser({
          data: { onboarding_intent: goal },
        });
        if (metadata.error) {
          setError(humanizeDataError(metadata.error, "Your choice could not be saved. Please try again."));
          return;
        }
      }

      const nextStep = Math.min(step + 1, TOTAL_STEPS);
      setStep(nextStep);
      try {
        sessionStorage.setItem(`nexus:onboarding-step:${user.id}`, String(nextStep));
      } catch {
        // Persisted profile fields still determine a safe refresh route.
      }
    } catch (cause) {
      setError(humanizeDataError(cause instanceof Error ? cause : null, "Your progress could not be saved. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  // Local state only — no router call, no history entry, no reload. Every
  // answer already given stays exactly as it was.
  const back = () => {
    setError("");
    if (step > 1) {
      const previousStep = step - 1;
      setStep(previousStep);
      if (onboardingUserId) {
        try {
          sessionStorage.setItem(
            `nexus:onboarding-step:${onboardingUserId}`,
            String(previousStep)
          );
        } catch {
          // Back still works in memory when storage is unavailable.
        }
      }
    }
  };

  // Step 1 has no previous *step* — the page before it in the journey is the
  // public landing. The workflow owns this navigation (never history.back(),
  // which could land on login, an external page or an invalid state): we park
  // the typed identity as a draft and go to the landing with
  // `from=onboarding` so an authenticated session is not bounced straight back
  // into the dashboard → onboarding loop.
  const exitToLanding = () => {
    if (onboardingUserId) {
      try {
        localStorage.setItem(
          `nexus:onboarding-identity:${onboardingUserId}`,
          JSON.stringify({ displayName, username })
        );
      } catch {
        // Draft storage is optional; navigation still proceeds.
      }
    }
    router.replace("/?from=onboarding");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canContinue()) {
      setError("Please complete this step before continuing.");
      return;
    }

    setSaving(true);
    setError("");

    try {
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
      const cleanWorkspaceName = workspaceName.trim();

      const persistProfile = async (completed: boolean) => {
        const base = {
          id: user.id,
          display_name: cleanDisplayName,
          username: cleanUsername,
          updated_at: new Date().toISOString(),
          ...(completed ? { onboarding_completed: true } : {}),
        };

        const attempt = (payload: Record<string, unknown>) =>
          supabase
            .from("profiles")
            .upsert(payload)
            .select("onboarding_completed")
            .maybeSingle();

        const withIntent = goal ? { ...base, onboarding_intent: goal } : base;
        let result = await attempt(withIntent);
        if (result.error && isMissingColumnError(result.error.message, "onboarding_intent")) {
          result = await attempt(base);
        }
        return result;
      };

      if (goal) {
        await supabase.auth.updateUser({ data: { onboarding_intent: goal } }).catch(() => null);
      }

      // 1. Persist profile WITHOUT onboarding_completed — it is only set after
      //    the workspace is verified below.
      const { error: profileError } = await persistProfile(false);

      if (profileError) {
        setError(humanizeDataError(profileError, "Your profile could not be prepared. Please try again."));
        return;
      }

      // 2. Ensure the user has an active workspace membership. Signup already
      //    creates a personal workspace (via DB trigger); reuse it instead of
      //    inserting a second one (FREE plan limit = 1) and getting stuck.
      const { data: memberships, error: membershipError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (membershipError) {
        setError(humanizeDataError(membershipError, "Your workspace could not be verified. Please try again."));
        return;
      }

      let membership: { workspace_id: string; role: string; status: string } | null =
        memberships?.[0] ?? null;

      const rereadMembership = async () => {
        const { data: refreshed } = await supabase
          .from("workspace_members")
          .select("workspace_id, role, status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false });
        return refreshed?.[0] ?? null;
      };

      if (!membership) {
        const { data: owned } = await supabase
          .from("workspaces")
          .select("id, name")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (owned?.id) {
          // Signup already created a personal workspace (via DB trigger). Link
          // the membership and rename it to the name the user chose at step 2
          // — the trigger could only guess (it falls back to the email), so the
          // user's explicit choice always wins.
          const chosenName = cleanWorkspaceName || `${cleanDisplayName}'s Workspace`;
          if (chosenName !== owned.name) {
            await supabase
              .from("workspaces")
              .update({ name: chosenName })
              .eq("id", owned.id);
          }

          const { error: linkError } = await supabase.from("workspace_members").insert({
            workspace_id: owned.id,
            user_id: user.id,
            role: "owner",
            status: "active",
          });
          membership = await rereadMembership();
          if (!membership) {
            setError(
              `Your existing workspace could not be connected${
                linkError ? `: ${linkError.message}` : "."
              }`
            );
            return;
          }
        }
      }

      // No membership yet — create a personal workspace (named by the user in
      // step 2) and its membership.
      if (!membership) {
        const finalWorkspaceName = cleanWorkspaceName || `${cleanDisplayName}'s Workspace`;
        const { data: workspace, error: workspaceError } = await supabase
          .from("workspaces")
          .insert({
            owner_id: user.id,
            name: finalWorkspaceName,
            slug: createSlug(cleanUsername),
          })
          .select("id")
          .single();

        if (workspaceError) {
          setError(
            isPlanLimitError(workspaceError.message)
              ? "A workspace already exists for this account but could not be opened. Sign out, sign back in, and try again."
              : `Could not create your workspace: ${workspaceError.message}`
          );
          return;
        }

        if (!workspace?.id) {
          setError(
            "We couldn't finish setting up your workspace — it was not saved. Your answers are kept, please try again."
          );
          return;
        }

        const { error: newMembershipError } = await supabase
          .from("workspace_members")
          .insert({
            workspace_id: workspace.id,
            user_id: user.id,
            role: "owner",
            status: "active",
          });
        membership = await rereadMembership();
        if (!membership) {
          setError(
            `Your workspace was created but could not be connected${
              newMembershipError ? `: ${newMembershipError.message}` : ". Please try again."
            }`
          );
          return;
        }
      }

      // 3. Verify membership is real and usable before declaring success.
      const validRoles = new Set(["owner", "admin", "member"]);
      if (!membership?.workspace_id) {
        setError("Your workspace could not be established. Please try again or contact support.");
        return;
      }
      if (!validRoles.has(String(membership.role))) {
        setError("Your workspace role is invalid. Please try again or contact support.");
        return;
      }

      // 4. Only now mark onboarding complete — and read the flag back from the
      //    database. We redirect on confirmed state, never on hope.
      const { data: completedRow, error: completeError } = await persistProfile(true);

      if (completeError) {
        setError(humanizeDataError(completeError, "We couldn't finish setting up your workspace. Please try again."));
        return;
      }

      let completed = completedRow;
      if (completed?.onboarding_completed !== true) {
        const verified = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();
        completed = verified.data;
      }

      if (completed?.onboarding_completed !== true) {
        setError(
          "We couldn't finish setting up your workspace — your setup was not confirmed. Your answers are kept, please try again."
        );
        return;
      }

      try {
        sessionStorage.removeItem(`nexus:onboarding-step:${user.id}`);
        localStorage.removeItem(`nexus:onboarding-workspace:${user.id}`);
        localStorage.removeItem(`nexus:onboarding-identity:${user.id}`);
      } catch {
        // Completion is database-backed; stale local drafts are non-authoritative.
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn't finish setting up your workspace. Your answers are kept, please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg-base px-4">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex justify-center">
            <NexusLogo size={32} className="opacity-70" priority />
          </div>
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="skeleton h-1 rounded-pill" />
            <div className="skeleton mx-auto h-4 w-40 rounded-pill" />
            <div className="skeleton mt-4 h-11 rounded-input" />
            <div className="skeleton h-11 rounded-input" />
            <div className="skeleton mt-2 h-10 rounded-input" />
          </div>
          <p className="sr-only" role="status">
            Preparing your workspace
          </p>
        </div>
      </main>
    );
  }

  const heading =
    step === 1
      ? "Welcome to NEXUS"
      : step === 2
        ? "Name your workspace"
        : step === 3
          ? "What should NEXUS improve?"
          : "NEXUS is ready";

  const subheading =
    step === 1
      ? "First, how should your workspace recognise you?"
      : step === 2
        ? "This is where your team's work lives. You can change it anytime."
        : step === 3
          ? "NEXUS adapts the experience to what matters most to you."
          : "Your workspace is set up. Let's see what NEXUS can surface.";

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-bg-base px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(233,228,255,0.05),transparent_70%)]"
      />
      <div className="w-full max-w-[440px] rounded-auth border border-border-subtle bg-bg-subtle p-7 shadow-auth sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <NexusLogo size={34} priority className="mb-6" />

          {/* Progress — 4 segments, filled up to the current step. */}
          <div
            className="flex w-full items-center gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-valuenow={step}
            aria-label={`Step ${step} of ${TOTAL_STEPS}`}
          >
            {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((segment) => (
              <span
                key={segment}
                className={cn(
                  "h-1 flex-1 rounded-pill transition-colors duration-300 ease-out-expo",
                  segment <= step ? "bg-accent" : "bg-white/[0.08]"
                )}
              />
            ))}
          </div>

          <p className="eyebrow mt-3.5 text-text-quaternary">
            Step {step} of {TOTAL_STEPS}
          </p>
          <h1 className="mt-2 text-[20px] font-semibold leading-[26px] tracking-[-0.025em] text-text-primary">
            {heading}
          </h1>
          <p className="mt-1.5 max-w-[38ch] text-small text-text-secondary">{subheading}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {step === 1 ? (
            <>
              <Field label="Full name" htmlFor="onboarding-name">
                <Input
                  id="onboarding-name"
                  size="lg"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
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
                  autoComplete="username"
                  required
                />
              </Field>
            </>
          ) : null}

          {step === 2 ? (
            <Field label="Workspace name" htmlFor="onboarding-workspace">
              <Input
                id="onboarding-workspace"
                size="lg"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="e.g. Acme product team"
                autoComplete="organization"
                required
              />
            </Field>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-2">
              {GOAL_OPTIONS.map((option) => {
                const active = goal === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setError("");
                      setGoal(option.id);
                    }}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-input border px-3.5 py-3 text-left transition-colors duration-150 ease-nexus",
                      active
                        ? "border-border-strong bg-accent-ghost-hover"
                        : "border-border-subtle bg-bg-surface/50 hover:border-border-default hover:bg-bg-surface"
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

          {step === 4 ? (
            <div className="flex flex-col items-center gap-3 rounded-input border border-border-subtle bg-bg-surface/50 px-4 py-6 text-center">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-pill bg-accent text-accent-fg"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <p className="text-body-medium text-text-primary">Your workspace is ready.</p>
              <p className="max-w-[34ch] text-small text-text-tertiary">
                NEXUS will read the work in {workspaceName.trim() || "your workspace"} and
                surface what needs attention. You can create your first project as soon as you
                enter.
              </p>
            </div>
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="mt-1 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => (step > 1 ? back() : exitToLanding())}
              disabled={saving}
              aria-label={
                step > 1 ? "Back to the previous step" : "Back to the NEXUS landing page"
              }
            >
              ← Back
            </Button>

            {step < TOTAL_STEPS ? (
              <Button
                type="button"
                size="lg"
                className="flex-1"
                onClick={() => void next()}
                disabled={!canContinue() || saving}
              >
                Continue
              </Button>
            ) : (
              <Button type="submit" size="lg" className="flex-1" loading={saving}>
                Enter NEXUS
              </Button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

// Helper used during load to recognise a persisted goal id regardless of the
// option list's order.
const GOAL_OPTIONS_MAP: Record<GoalId, true> = GOAL_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = true;
    return acc;
  },
  {} as Record<GoalId, true>
);
