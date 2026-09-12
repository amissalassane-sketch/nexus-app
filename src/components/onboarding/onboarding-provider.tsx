"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/onboarding/analytics";
import {
  CONTEXTUAL_TIPS,
  isActivated,
  isGuideFinished,
  mergeOnboarding,
  nextPendingStep,
  pickGuidanceLayer,
  shouldAutoStartGuide,
  type OnboardingStepId,
  type PersistedOnboarding,
  type ProductFacts,
} from "@/lib/onboarding/model";
import {
  readLocalOnboarding,
  readRemoteOnboarding,
  writeLocalOnboarding,
  writeRemoteOnboarding,
} from "@/lib/onboarding/persistence";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { WelcomeScreen } from "@/components/onboarding/welcome-screen";
import { GetStartedChecklist } from "@/components/onboarding/checklist";
import { HelpCenter } from "@/components/onboarding/help-center";
import { ContextualTip } from "@/components/onboarding/contextual-tip";

type OnboardingContextValue = {
  facts: ProductFacts;
  state: PersistedOnboarding;
  tourActive: boolean;
  guidanceMode: ReturnType<typeof pickGuidanceLayer>;
  startGuide: () => void;
  skipGuide: () => void;
  /** Marks one step done so the tour advances — escape hatch when the
   *  underlying product action cannot be completed. */
  skipStep: (id: OnboardingStepId) => void;
  completeWelcome: () => void;
  markIntelligence: () => void;
  openHelp: () => void;
  closeHelp: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const value = useContext(OnboardingContext);
  if (!value) {
    return {
      facts: {
        projectCount: 0,
        taskCount: 0,
        goalCount: 0,
        profileComplete: false,
        intelligenceInteracted: false,
      },
      state: {
        status: "idle",
        completedSteps: [],
        dismissedChecklist: false,
        seenTips: [],
        intelligenceInteracted: false,
        startedAt: null,
        skippedAt: null,
        completedAt: null,
      },
      tourActive: false,
      guidanceMode: "none",
      startGuide: () => {},
      skipGuide: () => {},
      skipStep: () => {},
      completeWelcome: () => {},
      markIntelligence: () => {},
      openHelp: () => {},
      closeHelp: () => {},
    };
  }
  return value;
}

export function OnboardingProvider({
  userId,
  projectCount,
  taskCount,
  goalCount,
  profileComplete,
  children,
}: {
  userId: string;
  projectCount: number;
  taskCount: number;
  goalCount: number;
  profileComplete: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<PersistedOnboarding>(() =>
    readLocalOnboarding(userId)
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const firstFlags = useRef({
    project: projectCount > 0,
    task: taskCount > 0,
    goal: goalCount > 0,
  });
  // The counts passed from the server layout are only as fresh as the last
  // full page render. After client-side navigation (or in a second tab),
  // the managers refetch and broadcast real counts via `nexus:counts` —
  // the guide merges them so a step whose work already exists completes
  // immediately instead of waiting for an event that will never fire.
  const [liveCounts, setLiveCounts] = useState({ projects: 0, tasks: 0 });
  const bumpLive = useCallback(
    (patch: { projects?: number; tasks?: number }) => {
      setLiveCounts((prev) => ({
        projects: Math.max(prev.projects, patch.projects ?? 0),
        tasks: Math.max(prev.tasks, patch.tasks ?? 0),
      }));
    },
    []
  );

  useEffect(() => {
    const onCounts = (event: Event) => {
      const detail = (event as CustomEvent<{ projects?: number; tasks?: number }>)
        .detail;
      if (typeof detail?.projects === "number" || typeof detail?.tasks === "number") {
        bumpLive(detail);
      }
    };
    window.addEventListener("nexus:counts", onCounts);
    return () => window.removeEventListener("nexus:counts", onCounts);
  }, [bumpLive]);

  const facts: ProductFacts = useMemo(
    () => ({
      projectCount: Math.max(projectCount, liveCounts.projects),
      taskCount: Math.max(taskCount, liveCounts.tasks),
      goalCount,
      profileComplete,
      intelligenceInteracted: state.intelligenceInteracted,
    }),
    [
      liveCounts,
      projectCount,
      taskCount,
      goalCount,
      profileComplete,
      state.intelligenceInteracted,
    ]
  );

  const persist = useCallback(
    (next: PersistedOnboarding) => {
      setState(next);
      writeLocalOnboarding(userId, next);
      void writeRemoteOnboarding(createClient(), userId, next).catch(() => null);
    },
    [userId]
  );

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const local = readLocalOnboarding(userId);
      const remote = await readRemoteOnboarding(createClient(), userId);
      const merged = remote ? mergeOnboarding(local, remote) : local;
      if (cancelled) return;
      setState(merged);
      setHydrated(true);
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const derivedStatus =
    state.status === "idle" && shouldAutoStartGuide(state, facts)
      ? "welcome"
      : state.status === "active" &&
          isGuideFinished(facts, state.completedSteps, pathname)
        ? "completed"
        : state.status;

  useEffect(() => {
    const onActivation = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (type === "project_created") {
        if (!firstFlags.current.project) {
          firstFlags.current.project = true;
          trackEvent("first_project_created");
        }
        bumpLive({ projects: 1 });
        persist({
          ...state,
          completedSteps: Array.from(
            new Set([...state.completedSteps, "navigate_projects", "create_project"])
          ) as OnboardingStepId[],
        });
        return;
      }
      if (type === "task_created") {
        if (!firstFlags.current.task) {
          firstFlags.current.task = true;
          trackEvent("first_task_created");
        }
        bumpLive({ tasks: 1 });
        persist({
          ...state,
          completedSteps: Array.from(
            new Set([...state.completedSteps, "navigate_tasks", "create_task"])
          ) as OnboardingStepId[],
        });
        return;
      }
      if (type === "goal_created") {
        if (!firstFlags.current.goal) {
          firstFlags.current.goal = true;
          trackEvent("first_goal_created");
        }
        return;
      }
      if (type === "intelligence") {
        persist({
          ...state,
          intelligenceInteracted: true,
          completedSteps: Array.from(
            new Set([
              ...state.completedSteps,
              "navigate_intelligence",
              "interact_intelligence",
            ])
          ) as OnboardingStepId[],
        });
        trackEvent("first_intelligence_interaction");
        if (projectCount > 0 && taskCount > 0) {
          trackEvent("activation_reached");
        }
        return;
      }
      if (type === "profile_completed") {
        trackEvent("profile_completed");
      }
    };
    window.addEventListener("nexus:activation", onActivation);
    return () => window.removeEventListener("nexus:activation", onActivation);
  }, [bumpLive, persist, projectCount, state, taskCount]);

  const startGuide = useCallback(() => {
    persist({
      ...state,
      status: "welcome",
      startedAt: state.startedAt ?? new Date().toISOString(),
      skippedAt: null,
    });
    trackEvent("onboarding_started");
    trackEvent("tour_replayed");
  }, [persist, state]);

  const skipGuide = useCallback(() => {
    persist({
      ...state,
      status: "skipped",
      skippedAt: new Date().toISOString(),
    });
    trackEvent("onboarding_skipped");
  }, [persist, state]);

  const skipStep = useCallback(
    (id: OnboardingStepId) => {
      persist({
        ...state,
        completedSteps: Array.from(
          new Set([...state.completedSteps, id])
        ) as OnboardingStepId[],
      });
      trackEvent("onboarding_step_skipped", { step: id });
    },
    [persist, state]
  );

  const completeWelcome = useCallback(() => {
    const nextSteps = Array.from(
      new Set([...state.completedSteps, "welcome"])
    ) as OnboardingStepId[];
    persist({
      ...state,
      status: "active",
      startedAt: state.startedAt ?? new Date().toISOString(),
      completedSteps: nextSteps,
    });
    trackEvent("onboarding_started");
    trackEvent("onboarding_step_completed", { step: "welcome" });
    const next = nextPendingStep(facts, nextSteps, pathname);
    if (next?.href && next.expectedAction === "navigate") {
      router.push(next.href);
    }
  }, [facts, pathname, persist, router, state]);

  const markIntelligence = useCallback(() => {
    persist({
      ...state,
      intelligenceInteracted: true,
      completedSteps: Array.from(
        new Set([
          ...state.completedSteps,
          "navigate_intelligence",
          "interact_intelligence",
        ])
      ) as OnboardingStepId[],
    });
    trackEvent("first_intelligence_interaction");
  }, [persist, state]);

  const tourActive =
    hydrated &&
    derivedStatus === "active" &&
    !isGuideFinished(facts, state.completedSteps, pathname);

  const showWelcome =
    hydrated && derivedStatus === "welcome" && !state.completedSteps.includes("welcome");

  const currentStep = nextPendingStep(facts, state.completedSteps, pathname);

  const activated = isActivated(facts);
  const checklistVisible =
    hydrated &&
    !showWelcome &&
    !tourActive &&
    !helpOpen &&
    (!state.dismissedChecklist || !activated);

  const tipVisible =
    hydrated &&
    !showWelcome &&
    !tourActive &&
    !helpOpen &&
    Boolean(CONTEXTUAL_TIPS[pathname]) &&
    !state.seenTips.includes(pathname);

  const guidanceMode = pickGuidanceLayer({
    helpOpen,
    tourActive: showWelcome || tourActive,
    tipVisible,
    checklistVisible,
  });

  const value = useMemo(
    () => ({
      facts,
      state,
      tourActive: showWelcome || tourActive,
      guidanceMode,
      startGuide,
      skipGuide,
      skipStep,
      completeWelcome,
      markIntelligence,
      openHelp: () => setHelpOpen(true),
      closeHelp: () => setHelpOpen(false),
    }),
    [
      completeWelcome,
      facts,
      guidanceMode,
      markIntelligence,
      showWelcome,
      skipGuide,
      skipStep,
      startGuide,
      state,
      tourActive,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {showWelcome ? (
        <WelcomeScreen onStart={completeWelcome} onExplore={skipGuide} />
      ) : null}
      {guidanceMode === "tour" && currentStep && !showWelcome ? (
        <GuidedTour
          key={currentStep.id}
          step={currentStep}
          onSkip={skipGuide}
          onSkipStep={skipStep}
          onWelcome={completeWelcome}
        />
      ) : null}
      {guidanceMode === "checklist" ? (
        <GetStartedChecklist
          facts={facts}
          dismissed={state.dismissedChecklist || activated}
          activated={activated}
          onDismiss={() => persist({ ...state, dismissedChecklist: true })}
          onRestore={() => persist({ ...state, dismissedChecklist: false })}
          onRestart={startGuide}
        />
      ) : null}
      {guidanceMode === "tip" ? (
        <ContextualTip
          pathname={pathname}
          seen={state.seenTips}
          onSeen={(id) =>
            persist({ ...state, seenTips: [...state.seenTips, id] })
          }
        />
      ) : null}
      <HelpCenter
        open={helpOpen}
        incomplete={
          state.status !== "completed" &&
          state.status !== "skipped" &&
          !activated
        }
        onClose={() => setHelpOpen(false)}
        onRestart={startGuide}
        onContinue={() => {
          // Closing is owned by HelpCenter (requestClose → onClose) so the
          // panel can animate out; do not unmount it from here.
          if (state.status === "skipped") {
            persist({ ...state, status: "active" });
          }
        }}
      />
    </OnboardingContext.Provider>
  );
}
