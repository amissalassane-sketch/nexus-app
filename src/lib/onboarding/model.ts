// ============================================================
// NEXUS — ONBOARDING PRODUCT MODEL
// Declarative first-run guidance. Completion is driven by real
// product state (projects, tasks, intelligence use), not by
// clicking "Next". Tour completion is never treated as activation.
// ============================================================

export const ONBOARDING_STEPS = [
  "welcome",
  "create_project",
  "create_task",
  "intelligence",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export type OnboardingStatus =
  | "idle"
  | "welcome"
  | "active"
  | "skipped"
  | "completed";

export type ProductFacts = {
  projectCount: number;
  taskCount: number;
  goalCount: number;
  profileComplete: boolean;
  intelligenceInteracted: boolean;
};

export type PersistedOnboarding = {
  status: OnboardingStatus;
  completedSteps: OnboardingStepId[];
  dismissedChecklist: boolean;
  seenTips: string[];
  intelligenceInteracted: boolean;
  startedAt: string | null;
  skippedAt: string | null;
  completedAt: string | null;
};

export const EMPTY_ONBOARDING: PersistedOnboarding = {
  status: "idle",
  completedSteps: [],
  dismissedChecklist: false,
  seenTips: [],
  intelligenceInteracted: false,
  startedAt: null,
  skippedAt: null,
  completedAt: null,
};

export type GuideStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  actionLabel?: string;
  target?: string;
  href?: string;
  completion: keyof ProductFacts | "welcome";
};

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "welcome",
    title: "Welcome to NEXUS.",
    description:
      "This is your workspace. I’ll help you get set up in a few steps — by doing the work, not watching a tour.",
    actionLabel: "Let’s get started",
    completion: "welcome",
  },
  {
    id: "create_project",
    title: "This is your command center.",
    description:
      "Everything you work on in NEXUS comes together here. Create your first project so NEXUS has something to organize.",
    actionLabel: "Create a project",
    target: "[data-tour='create-project']",
    href: "/projects?create=1",
    completion: "projectCount",
  },
  {
    id: "create_task",
    title: "Your first project is ready.",
    description:
      "Tasks turn plans into action. Add what needs to be done so the work stays connected to the project.",
    actionLabel: "Add a task",
    target: "[data-tour='create-task']",
    href: "/tasks?create=1",
    completion: "taskCount",
  },
  {
    id: "intelligence",
    title: "This is NEXUS Intelligence.",
    description:
      "It helps you understand your work, identify what matters, and turn information into action. Open it and ask NEXUS about your workspace.",
    actionLabel: "Open Intelligence",
    target: "[data-tour='nav-intelligence']",
    href: "/app/intelligence",
    completion: "intelligenceInteracted",
  },
];

export type ChecklistItem = {
  id: string;
  label: string;
  href: string;
  done: (facts: ProductFacts) => boolean;
};

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "project",
    label: "Create your first project",
    href: "/projects?create=1",
    done: (facts) => facts.projectCount > 0,
  },
  {
    id: "task",
    label: "Add your first task",
    href: "/tasks?create=1",
    done: (facts) => facts.taskCount > 0,
  },
  {
    id: "intelligence",
    label: "Explore Intelligence",
    href: "/app/intelligence",
    done: (facts) => facts.intelligenceInteracted,
  },
  {
    id: "profile",
    label: "Complete your profile",
    href: "/settings?tab=profile",
    done: (facts) => facts.profileComplete,
  },
];

export const CONTEXTUAL_TIPS: Record<
  string,
  { title: string; body: string }
> = {
  "/projects": {
    title: "Projects",
    body: "Organize your work around outcomes. NEXUS uses them to detect risk and momentum.",
  },
  "/tasks": {
    title: "Tasks",
    body: "Turn projects into actionable work. Dates and priority help Intelligence see what matters.",
  },
  "/goals": {
    title: "Goals",
    body: "Keep your work aligned with what you are trying to achieve.",
  },
  "/app/intelligence": {
    title: "Intelligence",
    body: "Ask NEXUS to help you understand and act on your work. Every signal is derived from your data.",
  },
};

export function isStepSatisfied(
  step: GuideStep,
  facts: ProductFacts,
  completedSteps: OnboardingStepId[]
): boolean {
  if (completedSteps.includes(step.id)) return true;
  if (step.completion === "welcome") return completedSteps.includes("welcome");
  if (step.completion === "projectCount") return facts.projectCount > 0;
  if (step.completion === "taskCount") return facts.taskCount > 0;
  if (step.completion === "intelligenceInteracted") {
    return facts.intelligenceInteracted;
  }
  return false;
}

export function nextPendingStep(
  facts: ProductFacts,
  completedSteps: OnboardingStepId[]
): GuideStep | null {
  for (const step of GUIDE_STEPS) {
    if (!isStepSatisfied(step, facts, completedSteps)) return step;
  }
  return null;
}

export function isGuideFinished(
  facts: ProductFacts,
  completedSteps: OnboardingStepId[]
): boolean {
  return nextPendingStep(facts, completedSteps) === null;
}

/** Activation is first meaningful value — not signup, not tour done. */
export function isActivated(facts: ProductFacts): boolean {
  return (
    facts.projectCount > 0 &&
    facts.taskCount > 0 &&
    facts.intelligenceInteracted
  );
}

export function checklistProgress(facts: ProductFacts): {
  done: number;
  total: number;
} {
  const done = CHECKLIST_ITEMS.filter((item) => item.done(facts)).length;
  return { done, total: CHECKLIST_ITEMS.length };
}

export function shouldAutoStartGuide(
  persisted: PersistedOnboarding,
  facts: ProductFacts
): boolean {
  if (persisted.status === "skipped" || persisted.status === "completed") {
    return false;
  }
  if (persisted.status === "welcome" || persisted.status === "active") {
    return !isGuideFinished(facts, persisted.completedSteps);
  }
  // First visit: idle. Experienced users (already have work) skip first-run.
  if (facts.projectCount > 0 && facts.taskCount > 0) return false;
  return true;
}

export function mergeOnboarding(
  current: PersistedOnboarding,
  patch: Partial<PersistedOnboarding>
): PersistedOnboarding {
  const completed = new Set([
    ...current.completedSteps,
    ...(patch.completedSteps ?? []),
  ]);
  const seen = new Set([...current.seenTips, ...(patch.seenTips ?? [])]);
  return {
    ...current,
    ...patch,
    completedSteps: ONBOARDING_STEPS.filter((id) => completed.has(id)),
    seenTips: [...seen],
    intelligenceInteracted:
      current.intelligenceInteracted || Boolean(patch.intelligenceInteracted),
  };
}

export function parseOnboarding(raw: unknown): PersistedOnboarding {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ONBOARDING };
  const value = raw as Partial<PersistedOnboarding>;
  const status: OnboardingStatus =
    value.status === "welcome" ||
    value.status === "active" ||
    value.status === "skipped" ||
    value.status === "completed"
      ? value.status
      : "idle";
  const completedSteps = Array.isArray(value.completedSteps)
    ? value.completedSteps.filter((id): id is OnboardingStepId =>
        (ONBOARDING_STEPS as readonly string[]).includes(id)
      )
    : [];
  const seenTips = Array.isArray(value.seenTips)
    ? value.seenTips.filter((id): id is string => typeof id === "string")
    : [];
  return {
    status,
    completedSteps,
    dismissedChecklist: Boolean(value.dismissedChecklist),
    seenTips,
    intelligenceInteracted: Boolean(value.intelligenceInteracted),
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
    skippedAt: typeof value.skippedAt === "string" ? value.skippedAt : null,
    completedAt:
      typeof value.completedAt === "string" ? value.completedAt : null,
  };
}
