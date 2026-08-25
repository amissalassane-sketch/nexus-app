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

  const facts: ProductFacts = useMemo(
    () => ({
      projectCount,
      taskCount,
      goalCount,
      profileComplete,
      intelligenceInteracted: state.intelligenceInteracted,
    }),
    [
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
  }, [persist, projectCount, state, taskCount]);

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
    !showWelcome &&
    !tourActive &&
    !helpOpen &&
    (!state.dismissedChecklist || !activated);

  const tipVisible =
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
          step={currentStep}
          onSkip={skipGuide}
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
          setHelpOpen(false);
          if (state.status === "skipped") {
            persist({ ...state, status: "active" });
          }
        }}
      />
    </OnboardingContext.Provider>
  );
}
