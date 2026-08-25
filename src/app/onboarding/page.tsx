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
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClientSafe } from "@/lib/supabase/client";
import { NexusLogo } from "@/components/nexus-logo";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — ONBOARDING (4 STEPS)
// 1. Welcome / Name   2. Workspace name   3. Goal   4. Ready
//
// Architecture:
// - Workspace + membership are bootstrapped BEFORE this page renders
//   (by /auth/confirm, /auth/callback, or /api/auth/signin).
// - On load, we verify the workspace exists by calling the same
//   idempotent RPC. If it fails, we show an error — never try to
//   create workspace from the client.
// - Username is auto-generated from email (never asked in onboarding).
// - Profile updates happen AFTER workspace is confirmed.
// - Completion is verified by reading back from the database.
// - Reload is safe: progress is persisted, workspace is idempotent.
// ============================================================

const GOAL_OPTIONS = [
  {
    id: "projects",
    label: "Projects",
    description: "Track and manage project work",
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Organize and prioritize daily work",
  },
  {
    id: "goals",
    label: "Goals",
    description: "Set and track strategic objectives",
  },
  {
    id: "operations",
    label: "Team operations",
    description: "Coordinate team workflows",
  },
  {
    id: "productivity",
    label: "Personal productivity",
    description: "Stay on top of your own work",
  },
  {
    id: "other",
    label: "Other",
    description: "Something else entirely",
  },
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
  const loadGenerationRef = useRef(0);
  const loadedUserIdRef = useRef("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [onboardingUserId, setOnboardingUserId] = useState("");

  // Form state — all answers at component level so back/forward preserves them
  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [goal, setGoal] = useState<GoalId | null>(null);

  /**
   * Verify the workspace exists by calling the canonical RPC.
   * This is idempotent — it creates if missing, returns existing if present.
   */
  const ensureWorkspace = useCallback(async (): Promise<Membership | null> => {
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_or_create_personal_workspace"
      );
      if (rpcError) return null;

      const row = Array.isArray(data)
        ? (data[0] as Membership | undefined)
        : (data as Membership | null);

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

  // Load existing state on mount
  const loadProfile = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError("");

    let user: Awaited<
      ReturnType<typeof supabase.auth.getUser>
    >["data"]["user"];
    try {
      const result = await supabase.auth.getUser();
      user = result.data.user;
      if (result.error || !user) {
        router.replace("/login");
        return;
      }
    } catch {
      if (generation !== loadGenerationRef.current) return;
      setError(
        "Your session could not be checked. Please try again shortly."
      );
      setLoading(false);
      return;
    }

    if (generation !== loadGenerationRef.current) return;

    // Reset state when user changes
    if (loadedUserIdRef.current !== user.id) {
      loadedUserIdRef.current = user.id;
      setOnboardingUserId(user.id);
      setDisplayName("");
      setWorkspaceName("");
      setGoal(null);
      setStep(1);
    }

    // FIRST: verify workspace exists. This is the critical foundation.
    const ws = await ensureWorkspace();
    if (generation !== loadGenerationRef.current) return;

    if (!ws?.workspace_id) {
      setError(
        "NEXUS could not prepare your personal workspace. Please try again shortly."
      );
      setLoading(false);
      return;
    }

    // Read existing profile data
    const profileResult = await supabase
      .from("profiles")
      .select(
        "display_name, onboarding_completed, onboarding_intent"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (generation !== loadGenerationRef.current) return;

    if (profileResult.error) {
      setError(
        "Your profile could not be loaded. Please try again."
      );
      setLoading(false);
      return;
    }

    const profile = profileResult.data as {
      display_name?: string | null;
      onboarding_completed?: boolean | null;
      onboarding_intent?: string | null;
    } | null;

    // If onboarding is complete, go to /app
    if (profile?.onboarding_completed === true) {
      router.replace("/app");
      return;
    }

    // Pre-fill from existing data
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }

    // Check for saved goal
    const savedGoal = profile?.onboarding_intent;
    if (savedGoal && GOAL_OPTIONS_MAP[savedGoal as GoalId]) {
      setGoal(savedGoal as GoalId);
    }

    // Determine furthest completed step
    let furthestStep = 1;
    if (profile?.display_name?.trim()) {
      furthestStep = 2;
    }

    // Check for saved workspace name from local storage
    try {
      const savedWs = sessionStorage.getItem(
        `nexus:onboarding-workspace:${user.id}`
      );
      if (savedWs) {
        setWorkspaceName(savedWs);
        if (furthestStep >= 2) furthestStep = 3;
      }
    } catch {
      // sessionStorage unavailable
    }

    if (savedGoal && GOAL_OPTIONS_MAP[savedGoal as GoalId]) {
      if (furthestStep >= 3) furthestStep = 4;
    }

    setStep(furthestStep);
    setLoading(false);
  }, [supabase, router, ensureWorkspace]);

  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist workspace name to sessionStorage as user types
  useEffect(() => {
    if (!onboardingUserId || !workspaceName) return;
    try {
      sessionStorage.setItem(
        `nexus:onboarding-workspace:${onboardingUserId}`,
        workspaceName
      );
    } catch {
      // ignore
    }
  }, [onboardingUserId, workspaceName]);

  const canContinue = useCallback((): boolean => {
    if (step === 1) return displayName.trim().length > 0;
    if (step === 2) return workspaceName.trim().length > 0;
    if (step === 3) return goal !== null;
    return true;
  }, [step, displayName, workspaceName, goal]);

  const next = useCallback(() => {
    if (!canContinue()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, [canContinue]);

  const back = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (saving || step !== TOTAL_STEPS) return;

      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        router.replace("/login");
        return;
      }

      setSaving(true);
      setError("");

      try {
        // Step A: Ensure workspace (idempotent)
        const ws = await ensureWorkspace();
        if (!ws?.workspace_id) {
          setError(
            "We couldn't finish setting up your workspace. Please try again."
          );
          return;
        }

        // Step B: Update profile with collected data
        const updatePayload: Record<string, unknown> = {
          display_name: displayName.trim(),
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        };

        if (goal) {
          updatePayload.onboarding_intent = goal;
        }

        // Update workspace name if provided
        if (workspaceName.trim()) {
          await supabase
            .from("workspaces")
            .update({ name: workspaceName.trim() })
            .eq("id", ws.workspace_id);
        }

        // Update profile
        const updated = await supabase
          .from("profiles")
          .update(updatePayload)
          .eq("id", user.data.user.id)
          .select("id, onboarding_completed")
          .maybeSingle();

        if (updated.error) {
          // Try insert for orphan profiles
          const inserted = await supabase
            .from("profiles")
            .insert({ id: user.data.user.id, ...updatePayload })
            .select("id, onboarding_completed")
            .maybeSingle();

          if (inserted.error || !inserted.data) {
            setError(
              "We couldn't finish setting up your workspace. Please try again."
            );
            return;
          }
        }

        // Step C: Verify completion from database
        const verified = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.data.user.id)
          .maybeSingle();

        if (verified.data?.onboarding_completed !== true) {
          setError(
            "We couldn't confirm your setup. Your answers are kept, please try again."
          );
          return;
        }

        // Clean up local storage
        try {
          sessionStorage.removeItem(
            `nexus:onboarding-workspace:${user.data.user.id}`
          );
        } catch {
          // ignore
        }

        router.replace("/app");
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? "We couldn't finish setting up your workspace. Please try again."
            : "We couldn't finish setting up your workspace. Please try again."
        );
      } finally {
        setSaving(false);
      }
    },
    [
      saving,
      step,
      supabase,
      router,
      ensureWorkspace,
      displayName,
      workspaceName,
      goal,
    ]
  );

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
        ? "Make NEXUS yours"
        : step === 3
          ? "What are you working on?"
          : "You\u2019re ready";

  const subheading =
    step === 1
      ? "Let\u2019s set up your workspace."
      : step === 2
        ? "Give your workspace a name. You can change it anytime."
        : step === 3
          ? "NEXUS adapts to what matters most to you."
          : "NEXUS is ready to understand your workspace.";

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-bg-base px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(233,228,255,0.05),transparent_70%)]"
      />
      <div className="w-full max-w-[440px] rounded-auth border border-border-subtle bg-bg-subtle p-7 shadow-auth sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <NexusLogo size={34} priority className="mb-6" />

          {/* Progress bar */}
          <div
            className="flex w-full items-center gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-valuenow={step}
            aria-label={`Step ${step} of ${TOTAL_STEPS}`}
          >
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(
              (segment) => (
                <span
                  key={segment}
                  className={cn(
                    "h-1 flex-1 rounded-pill transition-colors duration-300 ease-out-expo",
                    segment <= step ? "bg-accent" : "bg-white/[0.08]"
                  )}
                />
              )
            )}
          </div>

          <p className="eyebrow mt-3.5 text-text-quaternary">
            Step {step} of {TOTAL_STEPS}
          </p>
          <h1 className="mt-2 text-[20px] font-semibold leading-[26px] tracking-[-0.025em] text-text-primary">
            {heading}
          </h1>
          <p className="mt-1.5 max-w-[38ch] text-small text-text-secondary">
            {subheading}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Step 1: Name */}
          {step === 1 ? (
            <Field label="What\u2019s your name?" htmlFor="onboarding-name">
              <Input
                id="onboarding-name"
                name="name"
                size="lg"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </Field>
          ) : null}

          {/* Step 2: Workspace name */}
          {step === 2 ? (
            <Field
              label="Workspace name"
              htmlFor="onboarding-workspace"
            >
              <Input
                id="onboarding-workspace"
                name="workspace"
                size="lg"
                value={workspaceName}
                onChange={(event) =>
                  setWorkspaceName(event.target.value)
                }
                placeholder="e.g. Acme product team"
                autoComplete="organization"
                required
              />
            </Field>
          ) : null}

          {/* Step 3: Goal */}
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

          {/* Step 4: Ready */}
          {step === 4 ? (
            <div className="flex flex-col items-center gap-3 rounded-input border border-border-subtle bg-bg-surface/50 px-4 py-6 text-center">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-pill bg-accent text-accent-fg"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <p className="text-body-medium text-text-primary">
                Your workspace is ready.
              </p>
              <p className="max-w-[34ch] text-small text-text-tertiary">
                NEXUS will read the work in{" "}
                {workspaceName.trim() || "your workspace"} and surface
                what needs attention.
              </p>
            </div>
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="mt-1 flex items-center gap-2">
            {step > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={back}
                disabled={saving}
                aria-label="Back to the previous step"
              >
                ← Back
              </Button>
            ) : (
              <div className="w-[72px]" />
            )}

            {step < TOTAL_STEPS ? (
              <Button
                type="button"
                size="lg"
                className="flex-1"
                onClick={next}
                disabled={!canContinue() || saving}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                className="flex-1"
                loading={saving}
              >
                Enter NEXUS
              </Button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

const GOAL_OPTIONS_MAP: Record<GoalId, true> = GOAL_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = true;
    return acc;
  },
  {} as Record<GoalId, true>
);
