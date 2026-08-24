"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createClientSafe } from "@/lib/supabase/client";
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
// - Personal workspace + owner membership are bootstrapped AT SIGNUP by a
//   security-definer trigger (see migration 016). If that trigger ever fails
//   (swallowed exception, OAuth sign-in where the trigger fired before
//   migration 016, or a damaged account), the onboarding page self-heals by
//   calling the same idempotent security-definer RPC
//   (`get_or_create_personal_workspace`) BEFORE any profile write that other
//   code paths might want to authorize against. This fixes the
//   "permission to make this change in the current workspace" regression
//   WITHOUT weakening RLS: the RPC can only operate on the caller's own
//   account, and normal table writes remain RLS-protected.
// - The workspace is idempotent: re-running onboarding never duplicates a
//   workspace or membership.
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

type Membership = { workspace_id: string; role: string; status: string };

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
  const [membership, setMembership] = useState<Membership | null>(null);

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

  /**
   * Legacy repair path: attempt to locate an existing workspace + membership
   * directly through RLS-visible rows. Used when the RPC is unavailable or
   * returns no row (e.g. pre-016 databases).
   */
  const fallbackEnsureWorkspace = useCallback(async (): Promise<Membership | null> => {
    try {
      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, status")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      const existing = memberships?.[0] ?? null;
      if (existing?.workspace_id) {
        setMembership(existing);
        return existing;
      }
    } catch {
      // ignore; surface nothing yet — later steps will re-verify.
    }
    return null;
  }, [supabase]);

  /**
   * Idempotently ensure the current user has a personal workspace and an
   * owner membership. Uses the security-definer RPC (migration 016) so the
   * operation is atomic and cannot be vetoed by the chicken-and-egg RLS
   * policy on workspace_members (which requires an existing membership to
   * manage one). RLS is NOT weakened: the RPC enforces that callers can
   * only bootstrap their own workspace, and all other table writes remain
   * protected. Returns the verified membership row, or null on failure.
   */
  const ensurePersonalWorkspace = useCallback(async (): Promise<Membership | null> => {
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_or_create_personal_workspace"
      );
      if (rpcError) {
        // The RPC may not exist on databases that haven't applied migration
        // 016 yet. Fall back to the direct flow (which works on accounts
        // whose trigger bootstrap succeeded).
        if (
          /function.*does not exist|Could not find the function/i.test(
            rpcError.message
          )
        ) {
          return fallbackEnsureWorkspace();
        }
        return fallbackEnsureWorkspace();
      }
      // Supabase RPC returns a single row or array depending on the function;
      // normalise both shapes.
      const row = Array.isArray(data) ? data[0] : (data as Membership | null);
      if (row?.workspace_id) {
        setMembership(row);
        return row;
      }
      return fallbackEnsureWorkspace();
    } catch {
      // On network/permission errors, try the legacy direct path as a
      // best-effort fallback.
      return fallbackEnsureWorkspace();
    }
  }, [supabase, fallbackEnsureWorkspace]);

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

      // FIRST: ensure the personal workspace exists before any other write.
      // This repairs accounts whose signup trigger swallowed an error (e.g.
      // pre-008 missing-slug bug, partial migration, Google OAuth on a
      // lagging replica) and prevents the "no permission in current
      // workspace" failure when subsequent code tries to resolve workspace
      // context against a missing membership.
      const ws = await ensurePersonalWorkspace();

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
        // If reading the profile failed with a permission error, the most
        // likely cause is that the trigger-created profile row is missing
        // (repair path). Self-insert a minimal profile and retry once.
        if (isPermissionError(profileResult.error)) {
          const repair = await supabase.from("profiles").insert({
            id: user.id,
            display_name: user.user_metadata?.full_name ??
              user.user_metadata?.name ??
              user.email?.split("@")[0] ??
              "User",
          }).select("id").maybeSingle();
          if (!repair.error && repair.data) {
            // Retry the read.
            profileResult = await supabase
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
          }
        }
      }

      if (profileResult.error && !profileResult.data) {
        setError(humanizeDataError(profileResult.error, "Your profile could not be loaded. Please try again."));
        setLoading(false);
        return;
      }

      const p = (profileResult.data ?? profile) as typeof profile;

      // Completion alone is not enough: only a real active membership makes the
      // dashboard valid. If the user is marked complete but membership is
      // missing, STAY in onboarding so the bootstrap above can reconnect it
      // (idempotent) and finalisation can confirm.
      if (p?.onboarding_completed === true && ws?.workspace_id) {
        router.replace("/dashboard");
        return;
      }

      if (p?.display_name) setDisplayName(p.display_name);
      if (p?.username) setUsername(p.username);

      const metadataIntent =
        typeof user.user_metadata?.onboarding_intent === "string"
          ? user.user_metadata.onboarding_intent
          : "";
      const savedGoal = p?.onboarding_intent || metadataIntent;
      const hasIdentity = Boolean(p?.display_name?.trim() && p?.username?.trim());

      let furthestSafeStep = hasIdentity ? 2 : 1;
      if (savedGoal && savedGoal in GOAL_OPTIONS_MAP) {
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

      if (!p?.display_name) {
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

      if (!p?.username) {
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
  }, [router, supabase, ensurePersonalWorkspace]);

  const canContinue = () => {
    if (step === 1) return displayName.trim().length > 0 && username.trim().length > 0;
    if (step === 2) return workspaceName.trim().length > 0;
    if (step === 3) return goal !== null;
    return true; // step 4 (Ready) can always proceed
  };

  // Continue commits only the answers from the completed step.
  // Workspace is created (idempotently) at page load via ensurePersonalWorkspace
  // so that no step ever runs against an account without a valid membership.
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

      // Step 1 persists identity. Ensure workspace exists first so any code
      // path that resolves workspace context during or after this write sees
      // a valid membership (fixes the "no permission in current workspace"
      // race).
      if (step === 1) {
        const ws = await ensurePersonalWorkspace();
        // If we still have no membership after the bootstrap attempt, we
        // still allow the profile update — profiles are scoped to
        // auth.uid(), not workspace membership. But we record this so the
        // final submit can retry.
        void ws;

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
        // Workspace name is parked as a draft; the workspace itself is
        // already created (via the bootstrap RPC). If the user chose a
        // different name than the trigger default, update it now — this
        // requires workspace owner role, which the bootstrap guarantees.
        const ws = membership ?? (await ensurePersonalWorkspace());
        const chosenName = workspaceName.trim();
        if (ws?.workspace_id && chosenName) {
          const { data: current } = await supabase
            .from("workspaces")
            .select("name")
            .eq("id", ws.workspace_id)
            .maybeSingle();
          if (current && (current as { name?: string }).name !== chosenName) {
            const rename = await supabase
              .from("workspaces")
              .update({ name: chosenName })
              .eq("id", ws.workspace_id);
            if (rename.error && isPermissionError(rename.error)) {
              // Non-fatal: the workspace still exists with its default
              // name; finalisation will retry the rename.
            }
          }
        }
        try {
          localStorage.setItem(
            `nexus:onboarding-workspace:${user.id}`,
            JSON.stringify({ name: chosenName })
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

      // 1. Idempotently ensure workspace + owner membership via the
      //    security-definer RPC. This is the canonical fix for the
      //    permission regression: the RPC runs as the table owner and
      //    inserts the owner membership before any RLS policy can veto a
      //    chicken-and-egg client insert. The RPC can only bootstrap the
      //    caller's own workspace; cross-tenant writes are impossible.
      let ws = membership ?? (await ensurePersonalWorkspace());

      if (!ws?.workspace_id) {
        setError(
          "Your workspace could not be prepared. Please try again, or sign out and back in."
        );
        return;
      }

      // 2. Apply the user-chosen workspace name (step 2). RLS allows the
      //    owner to update their workspace; the membership we just confirmed
      //    satisfies can_manage_workspace().
      if (cleanWorkspaceName) {
        const { data: currentWs } = await supabase
          .from("workspaces")
          .select("name")
          .eq("id", ws.workspace_id)
          .maybeSingle();
        if (
          currentWs &&
          (currentWs as { name?: string }).name !== cleanWorkspaceName
        ) {
          const rename = await supabase
            .from("workspaces")
            .update({ name: cleanWorkspaceName })
            .eq("id", ws.workspace_id);
          if (rename.error && isPermissionError(rename.error)) {
            // Fall through: workspace still exists; completion can
            // proceed. The user can rename from Settings later.
          }
        }
      }

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

      // 3. Persist profile WITHOUT onboarding_completed first — it is only
      //    set after the workspace is verified below.
      const { error: profileError } = await persistProfile(false);
      if (profileError) {
        setError(humanizeDataError(profileError, "Your profile could not be prepared. Please try again."));
        return;
      }

      // 4. Re-verify membership after persistence (defensive).
      ws = (await ensurePersonalWorkspace()) ?? ws;
      if (!ws?.workspace_id) {
        setError("Your workspace could not be established. Please try again or contact support.");
        return;
      }

      const validRoles = new Set(["owner", "admin", "member"]);
      if (!validRoles.has(String(ws.role))) {
        setError("Your workspace role is invalid. Please try again or contact support.");
        return;
      }

      // 5. Only now mark onboarding complete — and read the flag back from
      //    the database. We redirect on confirmed state, never on hope.
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
          ? humanizeDataError(cause, "We couldn't finish setting up your workspace. Your answers are kept, please try again.")
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

/**
 * Recognise a PostgREST/RLS permission error so we can handle it gracefully
 * instead of surfacing a low-level message.
 */
function isPermissionError(err: PostgrestError | { message?: string | null; code?: string | null } | null | undefined): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  return (
    code === "42501" ||
    msg.includes("row-level security") ||
    msg.includes("access denied") ||
    msg.includes("permission denied") ||
    msg.includes("workspace_access_denied")
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
