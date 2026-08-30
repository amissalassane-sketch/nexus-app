// ============================================================
// NEXUS — GUIDANCE MODEL (second pass)
// Action-based. Navigation can advance a *navigate* step.
// Create / interact steps require real product facts.
// ============================================================

import type { CopyKey } from "@/lib/onboarding/i18n";

export const ONBOARDING_STEPS = [
  "welcome",
  "navigate_projects",
  "create_project",
  "navigate_tasks",
  "create_task",
  "navigate_intelligence",
  "interact_intelligence",
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

export type GuideContext = ProductFacts & {
  pathname: string;
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

export type ExpectedAction = "acknowledge" | "navigate" | "create" | "interact";

export type GuideStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  actionLabel?: string;
  target?: string;
  href?: string;
  expectedAction: ExpectedAction;
  titleKey: CopyKey;
  bodyKey: CopyKey;
  actionKey?: CopyKey;
};

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "welcome",
    title: "Welcome to NEXUS.",
    description:
      "Let’s get your workspace ready. I’ll guide you through the essentials.",
    actionLabel: "Get started",
    expectedAction: "acknowledge",
    titleKey: "guide.welcome.title",
    bodyKey: "guide.welcome.body",
    actionKey: "guide.welcome.action",
  },
  {
    id: "navigate_projects",
    title: "First, let’s create your first project.",
    description:
      "Projects are where you organize a major piece of work. Open Projects in the sidebar.",
    actionLabel: "Open Projects",
    target: "[data-guide='projects-nav']",
    href: "/projects",
    expectedAction: "navigate",
    titleKey: "guide.navigate_projects.title",
    bodyKey: "guide.navigate_projects.body",
    actionKey: "guide.navigate_projects.action",
  },
  {
    id: "create_project",
    title: "You’re in Projects.",
    description:
      "Create your first project. Give it a name and save it. NEXUS starts working the moment it exists.",
    actionLabel: "New project",
    target: "[data-guide='new-project']",
    href: "/projects?create=1",
    expectedAction: "create",
    titleKey: "guide.create_project.title",
    bodyKey: "guide.create_project.body",
    actionKey: "guide.create_project.action",
  },
  {
    id: "navigate_tasks",
    title: "Your first project is ready.",
    description: "Now give that project something to work on. Open Tasks.",
    actionLabel: "Open Tasks",
    target: "[data-guide='tasks-nav']",
    href: "/tasks",
    expectedAction: "navigate",
    titleKey: "guide.navigate_tasks.title",
    bodyKey: "guide.navigate_tasks.body",
    actionKey: "guide.navigate_tasks.action",
  },
  {
    id: "create_task",
    title: "Create your first task.",
    description:
      "Tasks turn projects into executable work. Add a real task to continue.",
    actionLabel: "New task",
    target: "[data-guide='new-task']",
    href: "/tasks?create=1",
    expectedAction: "create",
    titleKey: "guide.create_task.title",
    bodyKey: "guide.create_task.body",
    actionKey: "guide.create_task.action",
  },
  {
    id: "navigate_intelligence",
    title: "Meet the intelligence layer.",
    description:
      "NEXUS Intelligence helps you understand your work and turn context into action.",
    actionLabel: "Open Intelligence",
    target: "[data-guide='intelligence-nav']",
    href: "/app/intelligence",
    expectedAction: "navigate",
    titleKey: "guide.navigate_intelligence.title",
    bodyKey: "guide.navigate_intelligence.body",
    actionKey: "guide.navigate_intelligence.action",
  },
  {
    id: "interact_intelligence",
    title: "Ask NEXUS about your workspace.",
    description:
      "Try asking something about your workspace. Opening the page is not enough.",
    actionLabel: "Ask NEXUS",
    target: "[data-guide='intelligence-input']",
    href: "/app/intelligence",
    expectedAction: "interact",
    titleKey: "guide.interact_intelligence.title",
    bodyKey: "guide.interact_intelligence.body",
    actionKey: "guide.interact_intelligence.action",
  },
];

export type ChecklistItem = {
  id: string;
  label: string;
  labelKey: CopyKey;
  href: string;
  done: (facts: ProductFacts) => boolean;
};

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "project",
    label: "Create your first project",
    labelKey: "checklist.project",
    href: "/projects?create=1",
    done: (facts) => facts.projectCount > 0,
  },
  {
    id: "task",
    label: "Create your first task",
    labelKey: "checklist.task",
    href: "/tasks?create=1",
    done: (facts) => facts.taskCount > 0,
  },
  {
    id: "intelligence",
    label: "Try NEXUS Intelligence",
    labelKey: "checklist.intelligence",
    href: "/app/intelligence",
    done: (facts) => facts.intelligenceInteracted,
  },
  {
    id: "goal",
    label: "Create your first goal",
    labelKey: "checklist.goal",
    href: "/goals?create=1",
    done: (facts) => facts.goalCount > 0,
  },
];

export const CONTEXTUAL_TIPS: Record<
  string,
  { title: string; body: string; titleKey: CopyKey; bodyKey: CopyKey }
> = {
  "/projects": {
    title: "Projects",
    body: "Projects are where your major work lives.",
    titleKey: "tip.projects.title",
    bodyKey: "tip.projects.body",
  },
  "/tasks": {
    title: "Tasks",
    body: "Tasks turn projects into executable work.",
    titleKey: "tip.tasks.title",
    bodyKey: "tip.tasks.body",
  },
  "/goals": {
    title: "Goals",
    body: "Goals help you keep your work aligned with outcomes.",
    titleKey: "tip.goals.title",
    bodyKey: "tip.goals.body",
  },
  "/app/intelligence": {
    title: "Intelligence",
    body: "Intelligence connects your context and helps you act on it.",
    titleKey: "tip.intelligence.title",
    bodyKey: "tip.intelligence.body",
  },
  "/settings": {
    title: "Settings",
    body: "Manage your workspace and preferences here.",
    titleKey: "tip.settings.title",
    bodyKey: "tip.settings.body",
  },
};

export function isOnProjects(pathname: string): boolean {
  return pathname === "/projects" || pathname.startsWith("/projects/");
}

export function isOnTasks(pathname: string): boolean {
  return pathname === "/tasks" || pathname.startsWith("/tasks/");
}

export function isOnIntelligence(pathname: string): boolean {
  return pathname.includes("/intelligence");
}

export function isStepSatisfied(
  step: GuideStep,
  facts: ProductFacts,
  completedSteps: OnboardingStepId[],
  pathname = ""
): boolean {
  if (completedSteps.includes(step.id)) return true;
  switch (step.id) {
    case "welcome":
      return completedSteps.includes("welcome");
    case "navigate_projects":
      return facts.projectCount > 0 || isOnProjects(pathname);
    case "create_project":
      return facts.projectCount > 0;
    case "navigate_tasks":
      return facts.taskCount > 0 || isOnTasks(pathname);
    case "create_task":
      return facts.taskCount > 0;
    case "navigate_intelligence":
      return facts.intelligenceInteracted || isOnIntelligence(pathname);
    case "interact_intelligence":
      return facts.intelligenceInteracted;
    default:
      return false;
  }
}

export function nextPendingStep(
  facts: ProductFacts,
  completedSteps: OnboardingStepId[],
  pathname = ""
): GuideStep | null {
  for (const step of GUIDE_STEPS) {
    if (!isStepSatisfied(step, facts, completedSteps, pathname)) return step;
  }
  return null;
}

export function isGuideFinished(
  facts: ProductFacts,
  completedSteps: OnboardingStepId[],
  pathname = ""
): boolean {
  return nextPendingStep(facts, completedSteps, pathname) === null;
}

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
  const rawSteps = Array.isArray(value.completedSteps)
    ? (value.completedSteps as unknown[])
    : [];
  const legacy = rawSteps.flatMap((id): OnboardingStepId[] => {
    if (typeof id !== "string") return [];
    if ((ONBOARDING_STEPS as readonly string[]).includes(id)) {
      return [id as OnboardingStepId];
    }
    if (id === "intelligence") return ["interact_intelligence"];
    return [];
  });
  const seenTips = Array.isArray(value.seenTips)
    ? value.seenTips.filter((id): id is string => typeof id === "string")
    : [];
  return {
    status,
    completedSteps: ONBOARDING_STEPS.filter((id) => legacy.includes(id)),
    dismissedChecklist: Boolean(value.dismissedChecklist),
    seenTips,
    intelligenceInteracted: Boolean(value.intelligenceInteracted),
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
    skippedAt: typeof value.skippedAt === "string" ? value.skippedAt : null,
    completedAt:
      typeof value.completedAt === "string" ? value.completedAt : null,
  };
}

/** Clicking Next / Continue never completes a create or interact step. */
export function canAdvanceWithoutProductEvent(step: GuideStep): boolean {
  return step.expectedAction === "acknowledge" || step.expectedAction === "navigate";
}

export type GuidanceLayer = "tour" | "help" | "tip" | "checklist" | "none";

export function pickGuidanceLayer(input: {
  helpOpen: boolean;
  tourActive: boolean;
  tipVisible: boolean;
  checklistVisible: boolean;
}): GuidanceLayer {
  if (input.helpOpen) return "help";
  if (input.tourActive) return "tour";
  if (input.tipVisible) return "tip";
  if (input.checklistVisible) return "checklist";
  return "none";
}
