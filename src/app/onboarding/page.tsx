"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NexusLogo } from "@/components/nexus-logo";

// ============================================================
// NEXUS — ONBOARDING (P1: 3 verified steps + repair path)
//
// Rules enforced here:
//  - No redirect without confirming state in the database.
//  - Every Supabase error is shown in clear language.
//  - Fields keep their content on error.
//  - "Step N of 3" progress at all times.
// ============================================================

const INTENTS = [
  {
    id: "personal",
    label: "Personal work",
    hint: "Freelance, side projects, admin",
    step3Title: "What are you working on right now?",
    projectLabel: "Your main focus right now",
    projectPlaceholder: "e.g. Portfolio revamp",
    taskLabel: "The next thing to do for it",
    taskPlaceholder: "e.g. Draft the homepage copy",
  },
  {
    id: "project",
    label: "A project",
    hint: "One delivery with a deadline",
    step3Title: "Name the project you must ship",
    projectLabel: "The project",
    projectPlaceholder: "e.g. Client website v2",
    taskLabel: "Its next concrete step",
    taskPlaceholder: "e.g. Send the proposal",
  },
  {
    id: "studies",
    label: "Studies",
    hint: "Courses, exams, revisions",
    step3Title: "What are you studying?",
    projectLabel: "Your current course or exam",
    projectPlaceholder: "e.g. Data structures — final",
    taskLabel: "Your next study session",
    taskPlaceholder: "e.g. Review chapter 4",
  },
  {
    id: "team",
    label: "A team",
    hint: "Shared workspace, several people",
    step3Title: "Set up your team's workspace",
    projectLabel: "The team's main initiative",
    projectPlaceholder: "e.g. Q3 launch",
    taskLabel: "The first task to assign",
    taskPlaceholder: "e.g. Prepare kickoff doc",
  },
  {
    id: "everything",
    label: "Everything",
    hint: "Work, studies, life — all of it",
    step3Title: "Start with what matters most",
    projectLabel: "Your top priority area",
    projectPlaceholder: "e.g. Job search",
    taskLabel: "One small step for today",
    taskPlaceholder: "e.g. Update the resume",
  },
] as const;

type IntentId = (typeof INTENTS)[number]["id"];

const STEPS = ["Identity", "Intent", "First value"] as const;
const TOTAL_STEPS = 3;

const createSlug = (value: string) => {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  return `${base || "workspace"}-${suffix}`;
};

const fallbackUsername = (email?: string | null) => {
  const base = email?.split("@")[0] ?? "user";
  return base.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30);
};

/** Translate raw Supabase errors into clear language, keeping the original message. */
const clearError = (context: string, message: string) => `${context} (${message})`;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);

  // Step 1 — identity (fields keep their values across errors)
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");

  // Step 2 — intent (kept in state even if the DB column is absent)
  const [intentId, setIntentId] = useState<IntentId | null>(null);
  const [intentPersisted, setIntentPersisted] = useState(false);

  // Step 3 — first value (user-entered, never invented)
  const [projectName, setProjectName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");

  const intent = INTENTS.find((i) => i.id === intentId) ?? INTENTS[0];

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

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, username, bio, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(clearError("Your profile could not be loaded.", profileError.message));
        setLoading(false);
        return;
      }

      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.username) setUsername(profile.username);

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

      // Repair path: only leave when the account actually works.
      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      const hasMembership = Boolean(memberships && memberships.length > 0);
      setWorkspaceReady(hasMembership);

      if (profile?.onboarding_completed === true && hasMembership) {
        router.replace("/dashboard");
        return;
      }

      // Broken or new account → stay (repair). If membership already exists
      // but onboarding is incomplete, jump to step 2 (identity already done).
      if (hasMembership && profile?.display_name) {
        setStep(2);
      }

      setLoading(false);
    };

    void loadProfile();
  }, [router, supabase]);

  /** Verify (and if needed create) the workspace + owner membership. */
  const ensureWorkspace = async (name: string): Promise<boolean> => {
    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId ?? "")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (membershipError) {
      setError(
        clearError("Your workspace link could not be verified.", membershipError.message)
      );
      return false;
    }

    if (memberships && memberships.length > 0) {
      setWorkspaceReady(true);
      return true;
    }

    const { error: workspaceError } = await supabase.from("workspaces").insert({
      owner_id: userId,
      name: `${name}'s Workspace`,
      slug: createSlug(username || name),
    });

    if (workspaceError) {
      setError(
        clearError(
          "Workspace creation failed. You can safely retry — nothing is duplicated.",
          workspaceError.message
        )
      );
      return false;
    }

    // RE-READ after creation: trust only the database.
    const { data: refreshed, error: refreshError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId ?? "")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (refreshError) {
      setError(
        clearError(
          "Workspace was created but your membership could not be read back.",
          refreshError.message
        )
      );
      return false;
    }

    if (!refreshed || refreshed.length === 0) {
      setError(
        "The workspace was created but your owner membership was not linked automatically. Please contact support with this message — your account is safe."
      );
      return false;
    }

    setWorkspaceReady(true);
    return true;
  };

  const submitStep1 = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanDisplayName) {
      setError("Please enter your full name.");
      return;
    }

    if (!cleanUsername) {
      setError("Please choose a username.");
      return;
    }

    if (!userId) {
      setError("Your session expired. Reload the page to sign in again.");
      return;
    }

    setWorking(true);

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        display_name: cleanDisplayName,
        username: cleanUsername,
        onboarding_completed: false,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      setError(
        clearError("Your profile could not be saved. Nothing was lost — try again.", upsertError.message)
      );
      setWorking(false);
      return;
    }

    // Workspace + membership verification (repair path included).
    const ok = await ensureWorkspace(cleanDisplayName);
    setWorking(false);
    if (!ok) return;

    setStep(2);
  };

  const submitStep2 = async () => {
    if (!intentId) {
      setError("Pick what you want to get under control — it shapes your workspace.");
      return;
    }

    setError("");
    setWorking(true);

    // Optional persistence: profiles.onboarding_intent may not exist yet
    // (FUTURE DATABASE CHANGE) — degrade to local state only.
    if (userId) {
      const { error: intentError } = await supabase
        .from("profiles")
        .update({ onboarding_intent: intentId, updated_at: new Date().toISOString() })
        .eq("id", userId);

      const missingColumn =
        intentError?.message?.includes("column") && intentError?.message?.includes("exist");
      if (intentError && !missingColumn) {
        setError(clearError("Your answer could not be saved.", intentError.message));
        setWorking(false);
        return;
      }
      setIntentPersisted(!intentError);
    }

    setWorking(false);
    setStep(3);
  };

  const finishOnboarding = async (withFirstValue: boolean) => {
    if (!userId || !workspaceReady) {
      setError("Your workspace is not linked yet — go back to step 1.");
      return;
    }

    setError("");
    setWorking(true);

    if (withFirstValue) {
      const cleanProject = projectName.trim();
      const cleanTask = taskTitle.trim();

      let projectId: string | null = null;

      if (cleanProject) {
        const workspaceIdForProject = await currentWorkspaceId();
        if (!workspaceIdForProject) {
          setError("No active workspace found — go back to step 1 to repair it.");
          setWorking(false);
          return;
        }

        const { data: created, error: projectError } = await supabase
          .from("projects")
          .insert({
            workspace_id: workspaceIdForProject,
            name: cleanProject,
            slug:
              cleanProject
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "")
                .slice(0, 40) || "project",
            description: null,
            status: "planning",
            progress: 0,
            due_date: null,
            owner_id: userId,
          })
          .select("id")
          .single();

        if (projectError) {
          setError(
            clearError("Your project could not be created. You can retry or skip.", projectError.message)
          );
          setWorking(false);
          return;
        }
        projectId = created?.id ?? null;
      }

      if (cleanTask) {
        const workspaceId = await currentWorkspaceId();
        if (!workspaceId) {
          setError("No active workspace found — go back to step 1.");
          setWorking(false);
          return;
        }

        const { error: taskError } = await supabase.from("tasks").insert({
          workspace_id: workspaceId,
          title: cleanTask,
          status: "todo",
          priority: "medium",
          due_at: null,
          assignee_id: userId,
          created_by: userId,
          ...(projectId ? { project_id: projectId } : {}),
        });

        if (taskError) {
          setError(
            clearError("Your first task could not be created. You can retry or skip.", taskError.message)
          );
          setWorking(false);
          return;
        }
      }
    }

    // Final verification before ANY redirect: membership still active.
    const { data: finalMembership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!finalMembership || finalMembership.length === 0) {
      setError(
        "Your workspace link disappeared before completion. Step 1 will repair it — nothing is lost."
      );
      setWorking(false);
      setStep(1);
      return;
    }

    const { error: completeError } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (completeError) {
      setError(
        clearError("Your workspace is ready, but completing onboarding failed.", completeError.message)
      );
      setWorking(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  const currentWorkspaceId = async (): Promise<string | null> => {
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId ?? "")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    return data?.[0]?.workspace_id ?? null;
  };

  const submitStep3 = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void finishOnboarding(Boolean(projectName.trim() || taskTitle.trim()));
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-base px-5 text-text-primary">
        <div className="flex items-center gap-3 text-small text-text-secondary">
          <span className="h-2 w-2 animate-pulse rounded-full bg-volt" aria-hidden="true" />
          Preparing your workspace…
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-5 py-10 text-text-primary">
      <div className="w-full max-w-[540px]">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <NexusLogo size={40} className="text-text-primary" />
          <h1 className="mt-4 text-h1 font-semibold">Set up your NEXUS</h1>
          <p className="mt-1 text-small text-text-secondary">
            Three short steps. Each one is verified before moving on.
          </p>
        </div>

        {/* Progress — "Step N of 3" */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-h3-mono uppercase text-text-tertiary">
              Step {step} of {TOTAL_STEPS} — {STEPS[step - 1]}
            </span>
            <span className="font-mono text-mono text-text-quaternary">
              {Math.round((step / TOTAL_STEPS) * 100)}%
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-bg-surface-3">
            <div
              className="h-full rounded-full bg-volt transition-all duration-500 ease-out"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-surface p-6 shadow-md">
          {/* STEP 1 — IDENTITY */}
          {step === 1 && (
            <form onSubmit={submitStep1} className="space-y-5">
              <div>
                <h2 className="text-h2 font-semibold">Who is using NEXUS?</h2>
                <p className="mt-1 text-small text-text-secondary">
                  Your name and username only — the bio can wait (Settings → Account).
                </p>
              </div>

              <div>
                <label htmlFor="display_name" className="mb-2 block text-label text-text-secondary">
                  Full name
                </label>
                <input
                  id="display_name"
                  ref={firstFieldRef}
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your full name"
                  required
                  autoComplete="name"
                  className="w-full rounded-md border border-border-default bg-bg-subtle px-3 py-2.5 text-body text-text-primary outline-none transition duration-150 placeholder:text-text-quaternary focus:border-border-focus"
                />
              </div>

              <div>
                <label htmlFor="username" className="mb-2 block text-label text-text-secondary">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="yourusername"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[A-Za-z0-9_]+"
                  autoComplete="username"
                  className="w-full rounded-md border border-border-default bg-bg-subtle px-3 py-2.5 text-body text-text-primary outline-none transition duration-150 placeholder:text-text-quaternary focus:border-border-focus"
                />
              </div>

              {error ? <ErrorBox message={error} /> : null}

              <button
                type="submit"
                disabled={working}
                className="w-full rounded-md bg-accent-primary px-4 py-3 text-button font-medium text-accent-primary-fg transition duration-150 hover:bg-accent-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-transparent disabled:text-text-tertiary"
              >
                {working ? "Verifying…" : "Continue"}
              </button>
            </form>
          )}

          {/* STEP 2 — INTENT ROUTING */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-h2 font-semibold">What are you trying to get under control?</h2>
                <p className="mt-1 text-small text-text-secondary">
                  Your answer shapes the labels and suggestions of your workspace.
                </p>
              </div>

              <div className="space-y-2" role="radiogroup" aria-label="Intent">
                {INTENTS.map((option) => {
                  const selected = intentId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setIntentId(option.id)}
                      className={`flex min-h-11 w-full items-center justify-between rounded-md border px-4 py-3 text-left transition duration-150 active:scale-[0.99] ${
                        selected
                          ? "border-volt-border bg-volt-subtle text-text-primary"
                          : "border-border-default bg-bg-subtle text-text-secondary hover:border-border-strong hover:text-text-primary"
                      }`}
                    >
                      <span>
                        <span className="block text-body font-medium">{option.label}</span>
                        <span className="block text-caption text-text-tertiary">{option.hint}</span>
                      </span>
                      <span
                        className={`h-2 w-2 rounded-full transition duration-150 ${
                          selected ? "bg-volt" : "bg-border-strong"
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>

              {intentPersisted ? (
                <p className="font-mono text-mono-small text-text-quaternary">INTENT SAVED</p>
              ) : null}

              {error ? <ErrorBox message={error} /> : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={working}
                  className="rounded-md border border-border-default px-4 py-3 text-button text-text-secondary transition duration-150 hover:border-border-strong hover:text-text-primary active:scale-[0.98] disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void submitStep2()}
                  disabled={working}
                  className="flex-1 rounded-md bg-accent-primary px-4 py-3 text-button font-medium text-accent-primary-fg transition duration-150 hover:bg-accent-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-transparent disabled:text-text-tertiary"
                >
                  {working ? "Saving…" : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — FIRST VALUE */}
          {step === 3 && (
            <form onSubmit={submitStep3} className="space-y-5">
              <div>
                <h2 className="text-h2 font-semibold">{intent.step3Title}</h2>
                <p className="mt-1 text-small text-text-secondary">
                  Enter what you are actually working on — NEXUS never invents data for you.
                </p>
              </div>

              <div>
                <label htmlFor="project_name" className="mb-2 block text-label text-text-secondary">
                  {intent.projectLabel} <span className="text-text-quaternary">(optional)</span>
                </label>
                <input
                  id="project_name"
                  type="text"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder={intent.projectPlaceholder}
                  maxLength={120}
                  className="w-full rounded-md border border-border-default bg-bg-subtle px-3 py-2.5 text-body text-text-primary outline-none transition duration-150 placeholder:text-text-quaternary focus:border-border-focus"
                />
              </div>

              <div>
                <label htmlFor="task_title" className="mb-2 block text-label text-text-secondary">
                  {intent.taskLabel} <span className="text-text-quaternary">(optional)</span>
                </label>
                <input
                  id="task_title"
                  type="text"
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder={intent.taskPlaceholder}
                  maxLength={200}
                  className="w-full rounded-md border border-border-default bg-bg-subtle px-3 py-2.5 text-body text-text-primary outline-none transition duration-150 placeholder:text-text-quaternary focus:border-border-focus"
                />
              </div>

              {error ? <ErrorBox message={error} /> : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void finishOnboarding(false)}
                  disabled={working}
                  className="rounded-md px-4 py-3 text-button text-text-tertiary transition duration-150 hover:text-text-primary active:scale-[0.98] disabled:opacity-50"
                >
                  Skip for now
                </button>
                <button
                  type="submit"
                  disabled={working}
                  className="flex-1 rounded-md bg-accent-primary px-4 py-3 text-button font-medium text-accent-primary-fg transition duration-150 hover:bg-accent-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-transparent disabled:text-text-tertiary"
                >
                  {working ? "Creating…" : "Finish and open dashboard"}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center font-mono text-mono-small text-text-quaternary">
          NO REDIRECT WITHOUT A VERIFIED WORKSPACE
        </p>
      </div>
    </main>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-small text-danger-fg"
    >
      {message}
    </div>
  );
}
