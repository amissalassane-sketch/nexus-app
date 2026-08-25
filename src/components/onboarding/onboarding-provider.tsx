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
  GUIDE_STEPS,
  isGuideFinished,
  mergeOnboarding,
  nextPendingStep,
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
import { GetStartedChecklist } from "@/components/onboarding/checklist";
import { HelpCenter } from "@/components/onboarding/help-center";
import { ContextualTip } from "@/components/onboarding/contextual-tip";

type OnboardingContextValue = {
  facts: ProductFacts;
  state: PersistedOnboarding;
  tourActive: boolean;
  guidanceMode: "tour" | "tip" | "checklist" | "help" | "none";
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
      const merged = remote
        ? mergeOnboarding(local, remote)
        : local;
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
          isGuideFinished(facts, state.completedSteps)
        ? "completed"
        : state.status;



  useEffect(() => {
    const onActivation = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (type === "project_created" && !firstFlags.current.project) {
        firstFlags.current.project = true;
        trackEvent("first_project_created");
        persist({
          ...state,
          completedSteps: Array.from(
            new Set([...state.completedSteps, "create_project"])
          ) as OnboardingStepId[],
        });
      }
      if (type === "task_created" && !firstFlags.current.task) {
        firstFlags.current.task = true;
        trackEvent("first_task_created");
        persist({
          ...state,
          completedSteps: Array.from(
            new Set([...state.completedSteps, "create_task"])
          ) as OnboardingStepId[],
        });
      }
      if (type === "goal_created" && !firstFlags.current.goal) {
        firstFlags.current.goal = true;
        trackEvent("first_goal_created");
      }
      if (type === "intelligence") {
        persist({
          ...state,
          intelligenceInteracted: true,
          completedSteps: Array.from(
            new Set([...state.completedSteps, "intelligence"])
          ) as OnboardingStepId[],
        });
        trackEvent("first_intelligence_interaction");
      }
      if (type === "profile_completed") {
        trackEvent("profile_completed");
      }
    };
    window.addEventListener("nexus:activation", onActivation);
    return () => window.removeEventListener("nexus:activation", onActivation);
  }, [persist, state]);

  const startGuide = useCallback(() => {
    persist({
      ...state,
      status: "welcome",
      startedAt: state.startedAt ?? new Date().toISOString(),
      skippedAt: null,
    });
    trackEvent("onboarding_started");
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
    trackEvent("onboarding_step_completed", { step: "welcome" });
    const next = nextPendingStep(facts, nextSteps);
    if (next?.href) router.push(next.href);
  }, [facts, persist, router, state]);

  const markIntelligence = useCallback(() => {
    persist({
      ...state,
      intelligenceInteracted: true,
      completedSteps: Array.from(
        new Set([...state.completedSteps, "intelligence"])
      ) as OnboardingStepId[],
    });
    trackEvent("first_intelligence_interaction");
  }, [persist, state]);

  const tourActive =
    hydrated &&
    (derivedStatus === "welcome" || derivedStatus === "active") &&
    !isGuideFinished(facts, state.completedSteps);

  const currentStep =
    derivedStatus === "welcome"
      ? GUIDE_STEPS[0]
      : nextPendingStep(facts, state.completedSteps);

  const guidanceMode: OnboardingContextValue["guidanceMode"] = helpOpen
    ? "help"
    : tourActive
      ? "tour"
      : "checklist";

  const value = useMemo(
    () => ({
      facts,
      state,
      tourActive,
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
      skipGuide,
      startGuide,
      state,
      tourActive,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {guidanceMode === "tour" && currentStep ? (
        <GuidedTour
          step={currentStep}
          onSkip={skipGuide}
          onWelcome={completeWelcome}
        />
      ) : null}
      {guidanceMode !== "tour" ? (
        <GetStartedChecklist
          facts={facts}
          dismissed={state.dismissedChecklist}
          onDismiss={() => persist({ ...state, dismissedChecklist: true })}
          onRestore={() => persist({ ...state, dismissedChecklist: false })}
          onRestart={startGuide}
        />
      ) : null}
      {guidanceMode !== "tour" && !helpOpen ? (
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
        onClose={() => setHelpOpen(false)}
        onRestart={startGuide}
      />
    </OnboardingContext.Provider>
  );
}
