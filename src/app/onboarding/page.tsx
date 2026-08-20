"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClientSafe } from "@/lib/supabase/client";
import { isPlanLimitError } from "@/lib/plan-errors";
import { isMissingColumnError } from "@/lib/schema-errors";
import { NexusLogo } from "@/components/nexus-logo";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — ONBOARDING (3 STEPS)
// 1. Identity (name + username)  2. Intent  3. First value
//
// Refinements:
// - `← Back` on steps 2 and 3: pure local state, never browser
//   navigation, so every field typed so far survives.
// - `← Back` on step 1 exits the journey to the public landing
//   (`/?from=onboarding`) — a deliberate workflow destination, never
//   history.back() — and parks the typed identity as a local draft so
//   nothing is lost when the user comes back in.
// - Step 3 adapts to the intent chosen at step 2 (STEP3_BY_INTENT).
// - Visual 3-segment progress bar.
// - Nothing is declared "done" on optimism: every write is read back
//   from the database (`.select(...).single()`) and verified before
//   the user is redirected. On any failure we STAY here, with the
//   data intact, and explain what happened.
// ============================================================

const INTENT_OPTIONS = [
  { id: "personal", label: "Personal work", description: "Your own tasks and projects" },
  { id: "project", label: "A project", description: "One defined outcome" },
  { id: "studies", label: "Studies", description: "Courses, deadlines, revision" },
  { id: "team", label: "A team", description: "Shared work with others" },
  { id: "everything", label: "Everything", description: "The whole system, in one place" },
] as const;

type IntentId = (typeof INTENT_OPTIONS)[number]["id"];
type FirstKind = "project" | "task";

type Step3Config = {
  defaultKind: FirstKind;
  title: string;
  description: string;
  projectPlaceholder: string;
  taskPlaceholder: string;
};

// Step 3 is not a generic form: it speaks the language of the intent
// selected at step 2, and pre-selects the unit of work that matches it.
const STEP3_BY_INTENT: Record<IntentId, Step3Config> = {
  personal: {
    defaultKind: "task",
    title: "What's the first thing you want to get under control?",
    description: "One task you keep carrying around. Write it down and let NEXUS hold it.",
    projectPlaceholder: "e.g. Reorganise my personal admin",
    taskPlaceholder: "e.g. Renew my passport",
  },
  project: {
    defaultKind: "project",
    title: "Set up your project",
    description: "Name the outcome you are driving. Tasks will live underneath it.",
    projectPlaceholder: "e.g. Launch my portfolio",
    taskPlaceholder: "e.g. Draft the project brief",
  },
  studies: {
    defaultKind: "project",
    title: "Set up your study goal",
    description: "A course, a semester, an exam — give it a home before the deadlines arrive.",
    projectPlaceholder: "e.g. Semester 1 — Data Structures",
    taskPlaceholder: "e.g. Revise chapter 3",
  },
  team: {
    defaultKind: "project",
    title: "Structure your team's first project",
    description: "Start with the work everyone is already talking about.",
    projectPlaceholder: "e.g. Q3 product launch",
    taskPlaceholder: "e.g. Share the kickoff notes",
  },
  everything: {
    defaultKind: "project",
    title: "Set up your first workflow",
    description: "Start anywhere. One project or one task is enough to make the system real.",
    projectPlaceholder: "e.g. Build my NEXUS system",
    taskPlaceholder: "e.g. Capture everything on my mind",
  },
};

const DEFAULT_STEP3 = STEP3_BY_INTENT.everything;

const TOTAL_STEPS = 3;

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

  // All answers live at component level: moving between steps only
  // changes `step`, so nothing typed is ever lost.
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [intent, setIntent] = useState<IntentId | null>(null);
  const [firstKind, setFirstKind] = useState<FirstKind>("project");
  const [firstTitle, setFirstTitle] = useState("");

  const step3 = intent ? STEP3_BY_INTENT[intent] : DEFAULT_STEP3;

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
        setError(profileResult.error.message);
        setLoading(false);
        return;
      }

      // Completion alone is not enough: only a real active membership makes
      // the dashboard valid. A damaged/missing membership stays in this safe
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
      const savedIntent = profile?.onboarding_intent || metadataIntent;
      const hasIdentity = Boolean(profile?.display_name?.trim() && profile?.username?.trim());

      let furthestSafeStep = hasIdentity ? 2 : 1;
      if (savedIntent in STEP3_BY_INTENT) {
        const known = savedIntent as IntentId;
        setIntent(known);
        setFirstKind(STEP3_BY_INTENT[known].defaultKind);
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

      try {
        const firstValueDraft = localStorage.getItem(`nexus:onboarding-first:${user.id}`);
        if (firstValueDraft) {
          const parsed = JSON.parse(firstValueDraft) as {
            kind?: FirstKind;
            title?: string;
          };
          if (parsed.kind === "project" || parsed.kind === "task") {
            setFirstKind(parsed.kind);
          }
          if (typeof parsed.title === "string") setFirstTitle(parsed.title);
        }
      } catch {
        // Draft storage is optional and never overrides database truth.
      }

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
          typeof user.user_metadata?.username === "string"
            ? user.user_metadata.username
            : "";
        setUsername(
          metadataUsername ||
            (typeof identityDraft.username === "string"
              ? identityDraft.username.trim()
              : "") ||
            fallbackUsername(user.email)
        );
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

  // Continue commits only the answers from the completed step. This makes a
  // refresh deterministic without creating a workspace, project, or task
  // before the user explicitly finishes the workflow.
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

      const base = {
        id: user.id,
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        updated_at: new Date().toISOString(),
      };
      const payload = step === 2 && intent ? { ...base, onboarding_intent: intent } : base;
      let saved = await supabase.from("profiles").upsert(payload).select("id").maybeSingle();
      let intentSavedInProfile = step !== 2;

      if (saved.error && isMissingColumnError(saved.error.message, "onboarding_intent")) {
        saved = await supabase.from("profiles").upsert(base).select("id").maybeSingle();
        intentSavedInProfile = false;
      } else if (step === 2) {
        intentSavedInProfile = true;
      }

      if (saved.error || !saved.data?.id) {
        setError(saved.error?.message ?? "Your progress could not be saved. Please try again.");
        return;
      }

      if (step === 2 && intent) {
        const metadata = await supabase.auth.updateUser({
          data: { onboarding_intent: intent },
        });
        if (metadata.error && !intentSavedInProfile) {
          setError(`Your choice could not be saved: ${metadata.error.message}`);
          return;
        }
      }

      // Step 1 is now persisted in the database — the identity draft has
      // done its job and must not shadow fresher edits later.
      if (step === 1) {
        try {
          localStorage.removeItem(`nexus:onboarding-identity:${user.id}`);
        } catch {
          // Storage is optional; the database row is the truth now.
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
      setError(cause instanceof Error ? cause.message : "Your progress could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  // Local state only — no router call, no history entry, no reload.
  // Every answer already given stays exactly as it was.
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

  // Step 1 has no previous *step* — the page before it in the journey is
  // the public landing. The workflow owns this navigation (never
  // history.back(), which could land on login, an external page or an
  // invalid state): we park the typed identity as a draft and go to the
  // landing with `from=onboarding` so an authenticated session is not
  // bounced straight back into the dashboard → onboarding loop.
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

  // Choosing an intent re-targets step 3 (default unit of work), but
  // never destroys a title the user already typed.
  const rememberFirstValue = (kind: FirstKind, title: string) => {
    if (!onboardingUserId) return;
    try {
      localStorage.setItem(
        `nexus:onboarding-first:${onboardingUserId}`,
        JSON.stringify({ kind, title })
      );
    } catch {
      // The form remains fully usable without local draft storage.
    }
  };

  const selectIntent = (nextIntent: IntentId) => {
    setError("");
    setIntent(nextIntent);
    // Only the *default* unit of work follows the intent — `firstTitle`
    // is user-authored content and is never touched.
    const defaultKind = STEP3_BY_INTENT[nextIntent].defaultKind;
    setFirstKind(defaultKind);
    rememberFirstValue(defaultKind, firstTitle);
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

      const persistProfile = async (completed: boolean) => {
        const base = {
          id: user.id,
          display_name: cleanDisplayName,
          username: cleanUsername,
          updated_at: new Date().toISOString(),
          ...(completed ? { onboarding_completed: true } : {}),
        };

        const attempt = (payload: Record<string, unknown>) =>
          supabase.from("profiles").upsert(payload).select("onboarding_completed").maybeSingle();

        let result = await attempt(intent ? { ...base, onboarding_intent: intent } : base);
        if (result.error && isMissingColumnError(result.error.message, "onboarding_intent")) {
          result = await attempt(base);
        }
        return result;
      };

      if (intent) {
        await supabase.auth.updateUser({ data: { onboarding_intent: intent } }).catch(() => null);
      }

      // 1. Persist profile WITHOUT onboarding_completed — it is only set
      //    after the workspace is verified below.
      const { error: profileError } = await persistProfile(false);

      if (profileError) {
        setError(profileError.message);
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

      // Signup already creates a personal workspace. Reuse it instead of
      // inserting a second one (FREE plan limit = 1) and getting stuck.
      if (!membership) {
        const { data: owned } = await supabase
          .from("workspaces")
          .select("id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (owned?.id) {
          const { error: linkError } = await supabase.from("workspace_members").insert({
            workspace_id: owned.id,
            user_id: user.id,
            role: "owner",
            status: "active",
          });
          membership = await rereadMembership();
          if (!membership) {
            setError(
              `Your existing workspace could not be connected${linkError ? `: ${linkError.message}` : "."}`
            );
            return;
          }
        }
      }

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
            `Your workspace was created but could not be connected${newMembershipError ? `: ${newMembershipError.message}` : ". Please try again."}`
          );
          return;
        }
      }

      // 3. Verify membership is real and usable before declaring success.
      const validRoles = new Set(["owner", "admin", "member"]);
      if (!membership?.workspace_id) {
        setError(
          "Your workspace could not be established. Please try again or contact support."
        );
        return;
      }
      if (!validRoles.has(String(membership.role))) {
        setError("Your workspace role is invalid. Please try again or contact support.");
        return;
      }

      const workspaceId = membership.workspace_id as string;

      // 4. Create the first value at most once. A stable client-generated id
      //    is stored before insertion, then verified on every retry/refresh.
      //    This closes the duplicate project/task window if profile completion
      //    fails after the value itself was committed.
      if (firstTitle.trim()) {
        const firstValueKey = `nexus:onboarding-first:${user.id}`;
        type FirstValueDraft = {
          id?: string;
          kind: FirstKind;
          title: string;
          created?: boolean;
        };

        let draft: FirstValueDraft = {
          kind: firstKind,
          title: firstTitle.trim(),
        };
        try {
          const stored = localStorage.getItem(firstValueKey);
          if (stored) {
            const parsed = JSON.parse(stored) as FirstValueDraft;
            if (
              (parsed.kind === "project" || parsed.kind === "task") &&
              typeof parsed.title === "string"
            ) {
              draft = parsed;
            }
          }
        } catch {
          // Continue with the visible, user-authored values.
        }

        draft.id ||= crypto.randomUUID();
        draft.title = draft.title.trim() || firstTitle.trim();
        try {
          localStorage.setItem(firstValueKey, JSON.stringify(draft));
        } catch {
          // Database verification below remains authoritative.
        }

        const table = draft.kind === "project" ? "projects" : "tasks";
        const { data: existingValue, error: existingError } = await supabase
          .from(table)
          .select("id")
          .eq("id", draft.id)
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        if (existingError) {
          setError(`We couldn't verify your first ${draft.kind}: ${existingError.message}`);
          return;
        }

        if (!existingValue?.id) {
          if (draft.kind === "project") {
            const { data: project, error: projectError } = await supabase
              .from("projects")
              .insert({
                id: draft.id,
                workspace_id: workspaceId,
                owner_id: user.id,
                name: draft.title,
              })
              .select("id")
              .single();

            if (projectError || !project?.id) {
              setError(
                projectError && isPlanLimitError(projectError.message)
                  ? "Your plan does not allow another project. Visit /upgrade to unlock more."
                  : `We couldn't finish setting up your workspace — your project was not created${projectError ? `: ${projectError.message}` : "."}`
              );
              return;
            }
          } else {
            const { data: task, error: taskError } = await supabase
              .from("tasks")
              .insert({
                id: draft.id,
                workspace_id: workspaceId,
                title: draft.title,
                assignee_id: user.id,
                created_by: user.id,
              })
              .select("id")
              .single();

            if (taskError || !task?.id) {
              setError(
                taskError && isPlanLimitError(taskError.message)
                  ? "Your plan does not allow another task. Visit /upgrade to unlock more."
                  : `We couldn't finish setting up your workspace — your task was not created${taskError ? `: ${taskError.message}` : "."}`
              );
              return;
            }
          }
        }

        draft.created = true;
        try {
          localStorage.setItem(firstValueKey, JSON.stringify(draft));
        } catch {
          // The row has already been read back from the database.
        }
      }

      // 5. Only now mark onboarding complete — and read the flag back from
      //    the database. We redirect on confirmed state, never on hope.
      const { data: completedRow, error: completeError } = await persistProfile(true);

      if (completeError) {
        setError(
          `We couldn't finish setting up your workspace — ${completeError.message}`
        );
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
        localStorage.removeItem(`nexus:onboarding-first:${user.id}`);
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
      <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
        <div className="flex flex-col items-center gap-3">
          <NexusLogo size={32} className="opacity-60" priority />
          <p className="text-small text-text-secondary">Loading your workspace...</p>
        </div>
      </main>
    );
  }

  const heading =
    step === 1
      ? "Who are you?"
      : step === 2
        ? "What are you trying to get under control?"
        : step3.title;

  const subheading =
    step === 1
      ? "This is how your workspace will recognise you."
      : step === 2
        ? "NEXUS adapts the experience to how you work."
        : step3.description;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4 py-10">
      <div className="w-full max-w-[440px] rounded-auth border border-border-default bg-bg-subtle p-8 shadow-auth">
        <div className="mb-6 flex flex-col items-center text-center">
          <NexusLogo size={48} priority className="mb-5" />

          {/* Progress — 3 segments, filled up to the current step. */}
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
                  segment <= step ? "bg-accent" : "bg-bg-surface-3"
                )}
              />
            ))}
          </div>

          <p className="mt-3 font-mono text-mono uppercase tracking-[0.12em] text-text-tertiary">
            Step {step} of {TOTAL_STEPS}
          </p>
          <h1 className="mt-2 text-h1 text-text-primary">{heading}</h1>
          <p className="mt-1 text-small text-text-secondary">{subheading}</p>
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
                    onClick={() => selectIntent(option.id)}
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
                    onClick={() => {
                      setFirstKind(kind);
                      rememberFirstValue(kind, firstTitle);
                    }}
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
                  onChange={(event) => {
                    setFirstTitle(event.target.value);
                    rememberFirstValue(firstKind, event.target.value);
                  }}
                  placeholder={
                    firstKind === "project"
                      ? step3.projectPlaceholder
                      : step3.taskPlaceholder
                  }
                />
              </Field>
            </>
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="mt-1 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => (step > 1 ? back() : exitToLanding())}
              disabled={saving}
              aria-label={step > 1 ? "Back to the previous step" : "Back to the NEXUS landing page"}
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
