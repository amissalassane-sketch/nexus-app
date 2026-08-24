"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
//   history.back().
// - Every "Continue" commits only the answers from the completed step. Step 1
//   is persisted through the server route after the bootstrap RPC has returned;
//   a refresh resumes only database-backed progress.
// - Nothing is declared "done" on optimism: every write is read back from the
//   database and verified before the user is redirected. On any failure we
//   STAY here, with the data intact, and explain what happened.
// - Personal workspace + owner membership are bootstrapped AT SIGNUP by a
//   security-definer trigger (see migrations 016/018). Historical or damaged
//   accounts self-heal through the same idempotent RPC
//   (`get_or_create_personal_workspace`) BEFORE any profile write. Step 1 is
//   persisted by a server route so the exact bootstrap -> profile sequence is
//   observable without weakening RLS: the RPC can only operate on the caller's
//   own account, and normal table writes remain RLS-protected.
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

type ProfileWriteResult = {
  data: Record<string, unknown> | null;
  error: PostgrestError | null;
};

/**
 * Keep the two RLS paths separate. An upsert asks Postgres to authorize an
 * INSERT and a possible UPDATE as one statement; on older hosted schemas that
 * can reject an existing, valid profile because the self-insert policy was
 * added later. UPDATE first preserves the existing policies and only tries an
 * INSERT when the row is genuinely absent.
 */
async function updateOrInsertOwnProfile(
  supabase: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>
): Promise<ProfileWriteResult> {
  const updated = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select("id, onboarding_completed")
    .maybeSingle();

  if (updated.error) return { data: null, error: updated.error };
  if (updated.data) {
    return { data: updated.data as Record<string, unknown>, error: null };
  }

  const inserted = await supabase
    .from("profiles")
    .insert(payload)
    .select("id, onboarding_completed")
    .maybeSingle();

  return {
    data: (inserted.data as Record<string, unknown> | null) ?? null,
    error: inserted.error,
  };
}

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
  const loadedUserIdRef = useRef("");
  const loadGenerationRef = useRef(0);

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

  /**
   * Idempotently ensure the current user has a personal workspace and an
   * active owner membership. There is intentionally no direct-table fallback:
   * if the canonical security-definer RPC is unavailable or fails, onboarding
   * must stop before a profile write rather than silently continuing with an
   * unverified workspace context.
   */
  const ensurePersonalWorkspace = useCallback(async (): Promise<Membership | null> => {
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_or_create_personal_workspace"
      );
      if (rpcError) {
        return null;
      }

      // Supabase RPC returns a single row or array depending on the function;
      // normalise both shapes and accept only the personal owner context.
      const row = Array.isArray(data) ? data[0] : (data as Membership | null);
      if (
        row?.workspace_id &&
        row.role === "owner" &&
        row.status === "active"
      ) {
        return row;
      }

      return null;
    } catch {
      return null;
    }
  }, [supabase]);

  const loadProfile = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError("");

    let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
    let userError: Awaited<ReturnType<typeof supabase.auth.getUser>>["error"];
    try {
      const result = await supabase.auth.getUser();
      user = result.data.user;
      userError = result.error;
    } catch {
      if (generation !== loadGenerationRef.current) return;
      setError("Your session could not be checked. Please try again shortly.");
      setLoading(false);
      return;
    }

    if (generation !== loadGenerationRef.current) return;

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    // State is scoped to the authenticated user, not to the lifetime of the
    // React tree. This matters when a logout/login happens without a full page
    // reload: never let account A's answers remain visible for account B.
    if (loadedUserIdRef.current !== user.id) {
      loadedUserIdRef.current = user.id;
      setOnboardingUserId(user.id);
      setDisplayName("");
      setUsername("");
      setWorkspaceName("");
      setGoal(null);
      setStep(1);
    }

    // FIRST: establish the workspace context. No profile repair/write is
    // attempted when this canonical RPC is unavailable or fails.
    const ws = await ensurePersonalWorkspace();
    if (generation !== loadGenerationRef.current) return;
    if (!ws?.workspace_id) {
      setError("NEXUS could not prepare your personal workspace. Please try again shortly.");
      setLoading(false);
      return;
    }

    // Read persisted progress. Profile rows are the only source for identity
    // prefill. In particular, do not fall back to auth metadata, email,
    // localStorage or a previous browser session when no profile exists.
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

    if (generation !== loadGenerationRef.current) return;

    if (profileResult.error) {
      setError(
        humanizeDataError(
          profileResult.error,
          "Your profile could not be loaded. Please try again."
        )
      );
      setLoading(false);
      return;
    }

    const profile = profileResult.data as
      | {
          display_name?: string | null;
          username?: string | null;
          onboarding_completed?: boolean | null;
          onboarding_intent?: string | null;
        }
      | null;

    // Completion alone is not enough: only a real active owner membership
    // makes the authenticated workspace valid.
    if (profile?.onboarding_completed === true && ws.workspace_id) {
      router.replace("/dashboard");
      return;
    }

    setDisplayName(profile?.display_name ?? "");
    setUsername(profile?.username ?? "");

    const hasIdentity = Boolean(
      profile?.display_name?.trim() && profile?.username?.trim()
    );
    const savedGoal = profile?.onboarding_intent;
    let furthestSafeStep = hasIdentity ? 2 : 1;
    if (savedGoal && savedGoal in GOAL_OPTIONS_MAP) {
      setGoal(savedGoal as GoalId);
      if (hasIdentity) furthestSafeStep = 3;
    }

    // The step marker is namespaced by user and can only resume persisted
    // progress; it can never advance a user beyond what the profile contains.
    let resumeStep = furthestSafeStep;
    try {
      const remembered = Number(
        sessionStorage.getItem(`nexus:onboarding-step:${user.id}`)
      );
      if (remembered >= 1 && remembered <= furthestSafeStep) {
        resumeStep = remembered;
      }
    } catch {
      // Storage is optional; persisted profile state remains authoritative.
    }
    setStep(resumeStep);

    // A workspace-name draft is also scoped by user. It is not used for
    // identity fields and cannot affect account switching.
    try {
      const storedWorkspace = localStorage.getItem(
        `nexus:onboarding-workspace:${user.id}`
      );
      if (storedWorkspace) {
        const parsed = JSON.parse(storedWorkspace) as { name?: unknown };
        if (typeof parsed.name === "string") setWorkspaceName(parsed.name);
      }
    } catch {
      // Draft storage is optional; local state still holds the value.
    }

    setLoading(false);
  }, [ensurePersonalWorkspace, router, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        loadGenerationRef.current += 1;
        loadedUserIdRef.current = "";
        setDisplayName("");
        setUsername("");
        setWorkspaceName("");
        setGoal(null);
        setStep(1);
        router.replace("/login");
        return;
      }

      // Ignore INITIAL_SESSION and same-user token refreshes. A different
      // SIGNED_IN user causes the complete profile/bootstrap load above and
      // therefore cannot inherit account A's React state.
      if (
        (event === "SIGNED_IN" || event === "USER_UPDATED") &&
        session?.user?.id &&
        session.user.id !== loadedUserIdRef.current
      ) {
        void loadProfile();
      }
    });

    return () => {
      window.clearTimeout(initialLoad);
      loadGenerationRef.current += 1;
      subscription.unsubscribe();
    };
  }, [loadProfile, router, supabase]);

  const canContinue = () => {
    if (step === 1) return displayName.trim().length > 0 && username.trim().length > 0;
    if (step === 2) return workspaceName.trim().length > 0;
    if (step === 3) return goal !== null;
    return true; // step 4 (Ready) can always proceed
  };

  // Continue commits only the answers from the completed step.
  // Step 1 is completed by a server route that performs the same ordered
  // sequence on the request's authenticated Supabase client:
  // ensure RPC -> profile UPDATE/INSERT -> read-back. No browser supplied
  // workspace id is trusted and no profile write can happen before bootstrap.
  const next = async () => {
    setError("");
    if (!canContinue() || step >= TOTAL_STEPS) return;

    setSaving(true);
    let actionUserId = "";
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }
      actionUserId = user.id;

      if (step === 1) {
        // Keep this client-side preflight explicit: the page must establish a
        // usable owner context before it asks the server route to persist the
        // identity. The route repeats the RPC immediately before its write so
        // the ordering is also guaranteed on the server.
        const ws = await ensurePersonalWorkspace();
        if (!ws?.workspace_id) {
          setError("NEXUS could not prepare your personal workspace. Please try again shortly.");
          return;
        }

        const response = await fetch("/api/onboarding/step-1", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName: displayName.trim(),
            username: username.trim().toLowerCase(),
          }),
        });

        let result: { ok?: boolean; error?: string } = {};
        try {
          result = (await response.json()) as typeof result;
        } catch {
          // The safe fallback below avoids exposing a proxy/runtime response.
        }

        if (!response.ok || result.ok !== true) {
          setError(
            result.error ??
              "Your profile could not be saved. Please try again shortly."
          );
          return;
        }
      }

      if (step === 2) {
        // Workspace name is parked as a draft; the workspace itself is
        // already created by the bootstrap RPC. A rename is still a normal
        // RLS-protected owner write and a failure must stop the journey.
        const ws = await ensurePersonalWorkspace();
        const chosenName = workspaceName.trim();
        if (!ws?.workspace_id) {
          setError("NEXUS could not verify your personal workspace. Please try again shortly.");
          return;
        }

        const { data: current, error: currentError } = await supabase
          .from("workspaces")
          .select("name")
          .eq("id", ws.workspace_id)
          .maybeSingle();
        if (currentError) {
          setError(humanizeDataError(currentError, "Your workspace could not be loaded. Please try again."));
          return;
        }
        if (current && (current as { name?: string }).name !== chosenName) {
          const rename = await supabase
            .from("workspaces")
            .update({ name: chosenName })
            .eq("id", ws.workspace_id);
          if (rename.error) {
            setError(humanizeDataError(rename.error, "Your workspace name could not be saved. Please try again."));
            return;
          }
        }
        try {
          localStorage.setItem(
            `nexus:onboarding-workspace:${user.id}`,
            JSON.stringify({ name: chosenName })
          );
        } catch {
          // Storage is optional; local state still holds the value.
        }
      }

      if (step === 3 && goal) {
        const base = {
          id: user.id,
          display_name: displayName.trim(),
          username: username.trim().toLowerCase(),
          updated_at: new Date().toISOString(),
        };
        let saved = await updateOrInsertOwnProfile(supabase, user.id, {
          ...base,
          onboarding_intent: goal,
        });

        if (saved.error && isMissingColumnError(saved.error.message, "onboarding_intent")) {
          saved = await updateOrInsertOwnProfile(supabase, user.id, base);
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

      // An account switch may have happened while the network request was in
      // flight. Never advance the newly signed-in user's journey with the
      // previous account's response.
      if (loadedUserIdRef.current !== user.id) return;

      const nextStep = Math.min(step + 1, TOTAL_STEPS);
      setStep(nextStep);
      try {
        sessionStorage.setItem(`nexus:onboarding-step:${user.id}`, String(nextStep));
      } catch {
        // Persisted profile fields still determine a safe refresh route.
      }
    } catch (cause) {
      if (loadedUserIdRef.current === actionUserId) {
        setError(humanizeDataError(cause instanceof Error ? cause : null, "Your progress could not be saved. Please try again."));
      }
    } finally {
      if (loadedUserIdRef.current === actionUserId) setSaving(false);
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
  // public landing. This navigation never uses history.back(), which could
  // land on login, an external page or an invalid state.
  const exitToLanding = () => {
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

      // 1. Re-run the canonical security-definer bootstrap on finalisation.
      //    Do not trust a cached membership or a workspace id from the browser.
      let ws = await ensurePersonalWorkspace();

      if (!ws?.workspace_id || ws.role !== "owner" || ws.status !== "active") {
        setError(
          "Your personal workspace could not be verified. Please try again shortly."
        );
        return;
      }

      // 2. Apply the user-chosen workspace name. This remains a normal,
      //    owner-authorized RLS write; a failure must stop completion instead
      //    of being silently ignored.
      if (cleanWorkspaceName) {
        const { data: currentWs, error: currentWsError } = await supabase
          .from("workspaces")
          .select("name")
          .eq("id", ws.workspace_id)
          .maybeSingle();
        if (currentWsError) {
          setError(humanizeDataError(currentWsError, "Your workspace could not be loaded. Please try again."));
          return;
        }
        if (
          currentWs &&
          (currentWs as { name?: string }).name !== cleanWorkspaceName
        ) {
          const rename = await supabase
            .from("workspaces")
            .update({ name: cleanWorkspaceName })
            .eq("id", ws.workspace_id);
          if (rename.error) {
            setError(humanizeDataError(rename.error, "Your workspace name could not be saved. Please try again."));
            return;
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

        const withIntent = goal ? { ...base, onboarding_intent: goal } : base;
        let result = await updateOrInsertOwnProfile(supabase, user.id, withIntent);
        if (result.error && isMissingColumnError(result.error.message, "onboarding_intent")) {
          result = await updateOrInsertOwnProfile(supabase, user.id, base);
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

      // 4. Re-verify membership after persistence (defensive). The RPC is
      //    the source of truth; only an active owner may complete onboarding.
      ws = await ensurePersonalWorkspace();
      if (!ws?.workspace_id || ws.role !== "owner" || ws.status !== "active") {
        setError("Your personal workspace could not be verified. Please try again shortly.");
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

// Helper used during load to recognise a persisted goal id regardless of the
// option list's order.
const GOAL_OPTIONS_MAP: Record<GoalId, true> = GOAL_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = true;
    return acc;
  },
  {} as Record<GoalId, true>
);
