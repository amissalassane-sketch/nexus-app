/**
 * NEXUS — product onboarding model tests (pure).
 */
const model = await import("../../src/lib/onboarding/model.ts");
const i18n = await import("../../src/lib/onboarding/i18n.ts");

const {
  EMPTY_ONBOARDING,
  GUIDE_STEPS,
  isActivated,
  isGuideFinished,
  nextPendingStep,
  parseOnboarding,
  shouldAutoStartGuide,
  checklistProgress,
  isStepSatisfied,
  canAdvanceWithoutProductEvent,
  pickGuidanceLayer,
} = model;

let passed = 0;
let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log("  PASS", name);
  } else {
    failed += 1;
    console.log("  FAIL", name, detail);
  }
}

const emptyFacts = {
  projectCount: 0,
  taskCount: 0,
  goalCount: 0,
  profileComplete: false,
  intelligenceInteracted: false,
};

console.log("-- first-run ------------------------------------------");
ok("new user auto-starts guide", shouldAutoStartGuide(EMPTY_ONBOARDING, emptyFacts));
ok("first pending step is welcome", nextPendingStep(emptyFacts, []).id === "welcome");
ok("signup is not activation", isActivated(emptyFacts) === false);
ok(
  "opening intelligence is not activation",
  isActivated({ ...emptyFacts, projectCount: 1, taskCount: 1 }) === false
);
ok(
  "activation requires project + task + intelligence interaction",
  isActivated({
    ...emptyFacts,
    projectCount: 1,
    taskCount: 1,
    intelligenceInteracted: true,
  }) === true
);

console.log("-- action-based completion ----------------------------");
const createProject = GUIDE_STEPS.find((s) => s.id === "create_project");
ok(
  "create_project is not satisfied by Next / completed flag alone without facts",
  isStepSatisfied(createProject, emptyFacts, ["welcome"], "/projects") === false
);
ok(
  "create_project is not satisfied by opening the form",
  isStepSatisfied(createProject, emptyFacts, ["welcome"], "/projects") === false
);
ok(
  "create_project is satisfied by a real project count",
  isStepSatisfied(createProject, { ...emptyFacts, projectCount: 1 }, [], "/dashboard")
);
ok(
  "navigate_projects is satisfied by being on /projects",
  isStepSatisfied(
    GUIDE_STEPS.find((s) => s.id === "navigate_projects"),
    emptyFacts,
    ["welcome"],
    "/projects"
  )
);
ok(
  "Next cannot complete a create step",
  canAdvanceWithoutProductEvent(createProject) === false
);
ok(
  "welcome can advance without a product event",
  canAdvanceWithoutProductEvent(GUIDE_STEPS[0]) === true
);

const interact = GUIDE_STEPS.find((s) => s.id === "interact_intelligence");
ok(
  "opening Intelligence does not complete interact step",
  isStepSatisfied(interact, emptyFacts, [], "/app/intelligence") === false
);
ok(
  "real intelligence interaction completes the step",
  isStepSatisfied(
    interact,
    { ...emptyFacts, intelligenceInteracted: true },
    [],
    "/app/intelligence"
  )
);

console.log("-- existing work --------------------------------------");
const experienced = { ...emptyFacts, projectCount: 2, taskCount: 5 };
ok(
  "experienced idle user does not auto-start first-run",
  shouldAutoStartGuide(EMPTY_ONBOARDING, experienced) === false
);
ok(
  "create-project is satisfied by real project count",
  isStepSatisfied(createProject, experienced, [])
);
ok(
  "next step after existing project+task is intelligence navigation",
  nextPendingStep(experienced, ["welcome"])?.id === "navigate_intelligence"
);

console.log("-- skip / resume --------------------------------------");
ok(
  "skipped guide does not auto-restart",
  shouldAutoStartGuide({ ...EMPTY_ONBOARDING, status: "skipped" }, emptyFacts) ===
    false
);
ok(
  "active guide resumes when unfinished",
  shouldAutoStartGuide(
    { ...EMPTY_ONBOARDING, status: "active", completedSteps: ["welcome"] },
    emptyFacts
  ) === true
);
ok(
  "completed status does not restart",
  shouldAutoStartGuide({ ...EMPTY_ONBOARDING, status: "completed" }, emptyFacts) ===
    false
);
ok(
  "resume after project+task continues at intelligence",
  nextPendingStep(
    { ...emptyFacts, projectCount: 1, taskCount: 1 },
    ["welcome", "create_project", "create_task"]
  )?.id === "navigate_intelligence"
);
ok(
  "completed steps never return when facts still hold",
  nextPendingStep(
    { ...emptyFacts, projectCount: 1, taskCount: 1, intelligenceInteracted: true },
    ["welcome"]
  ) === null
);

console.log("-- stuck escapes (no dead steps) ----------------------");
ok(
  "skipping create_project advances to navigate_tasks",
  nextPendingStep(
    emptyFacts,
    ["welcome", "navigate_projects", "create_project"]
  )?.id === "navigate_tasks"
);
ok(
  "skipping create_task advances to navigate_intelligence",
  nextPendingStep(
    emptyFacts,
    ["welcome", "navigate_projects", "create_project", "navigate_tasks", "create_task"]
  )?.id === "navigate_intelligence"
);
ok(
  "skipping interact_intelligence finishes the tour",
  nextPendingStep(
    { ...emptyFacts, projectCount: 1, taskCount: 1 },
    ["welcome", "create_project", "create_task", "navigate_intelligence", "interact_intelligence"]
  ) === null
);
ok(
  "fresh project count unblocks a pending create_project step (no event needed)",
  nextPendingStep(
    { ...emptyFacts, projectCount: 1 },
    ["welcome", "navigate_projects"]
  )?.id === "navigate_tasks"
);
ok(
  "create_project is satisfied by existing work even mid-welcome flow",
  isStepSatisfied(
    GUIDE_STEPS.find((s) => s.id === "create_project"),
    { ...emptyFacts, projectCount: 1 },
    [],
    "/projects"
  ) === true
);

console.log("-- persistence ----------------------------------------");
ok("invalid payload becomes empty", parseOnboarding(null).status === "idle");
ok(
  "unknown steps are dropped",
  parseOnboarding({
    status: "active",
    completedSteps: ["welcome", "hack"],
  }).completedSteps.join(",") === "welcome"
);
ok(
  "legacy intelligence step maps to interact_intelligence",
  parseOnboarding({
    status: "active",
    completedSteps: ["intelligence"],
  }).completedSteps.includes("interact_intelligence")
);

console.log("-- checklist / layers ---------------------------------");
ok("empty checklist is 0/4", checklistProgress(emptyFacts).done === 0);
ok(
  "full checklist is 4/4 from product facts including goal",
  checklistProgress({
    projectCount: 1,
    taskCount: 1,
    goalCount: 1,
    profileComplete: false,
    intelligenceInteracted: true,
  }).done === 4
);
ok(
  "profile completeness is not required for activation",
  isActivated({
    projectCount: 1,
    taskCount: 1,
    goalCount: 0,
    profileComplete: false,
    intelligenceInteracted: true,
  })
);
ok(
  "guide finished when activation facts exist",
  isGuideFinished(
    {
      projectCount: 1,
      taskCount: 1,
      goalCount: 0,
      profileComplete: false,
      intelligenceInteracted: true,
    },
    ["welcome"]
  )
);
ok(
  "only one guidance layer: tour beats tip and checklist",
  pickGuidanceLayer({
    helpOpen: false,
    tourActive: true,
    tipVisible: true,
    checklistVisible: true,
  }) === "tour"
);
ok(
  "help beats tour",
  pickGuidanceLayer({
    helpOpen: true,
    tourActive: true,
    tipVisible: true,
    checklistVisible: true,
  }) === "help"
);
ok(
  "tip beats checklist",
  pickGuidanceLayer({
    helpOpen: false,
    tourActive: false,
    tipVisible: true,
    checklistVisible: true,
  }) === "tip"
);

console.log("-- i18n -----------------------------------------------");
ok("detects French", i18n.detectLocale("fr-FR") === "fr");
ok("defaults to English", i18n.detectLocale("de") === "en");
ok(
  "French welcome differs from English",
  i18n.t("welcome.start", "fr") !== i18n.t("welcome.start", "en")
);
ok(
  "every guide step has a copy key",
  GUIDE_STEPS.every((step) => typeof i18n.t(step.titleKey, "en") === "string")
);
ok(
  "skip-step and retry copy exist in both locales",
  ["guide.skipStep", "guide.retry"].every(
    (key) =>
      typeof i18n.t(key, "en") === "string" &&
      typeof i18n.t(key, "fr") === "string" &&
      i18n.t(key, "en") !== i18n.t(key, "fr")
  )
);

console.log("-- targets --------------------------------------------");
ok(
  "projects nav target is data-guide",
  GUIDE_STEPS.find((s) => s.id === "navigate_projects").target.includes(
    "data-guide='projects-nav'"
  )
);
ok(
  "create project target is data-guide",
  createProject.target.includes("data-guide='new-project'")
);

// Source-level wiring checks (no browser test stack by design): the escape
// hatches and live counts that keep a step from dead-ending must exist in
// the components, not just in the model.
const { readFileSync } = await import("node:fs");
const { fileURLToPath } = await import("node:url");
const { join } = await import("node:path");
const root = fileURLToPath(new URL("../..", import.meta.url));
const src = (rel) => readFileSync(join(root, "src", rel), "utf8");
const tourSrc = src("components/onboarding/guided-tour.tsx");
const providerSrc = src("components/onboarding/onboarding-provider.tsx");
const spotlightSrc = src("components/onboarding/spotlight.tsx");
const projectSrc = src("components/project-manager.tsx");
const taskSrc = src("components/task-manager.tsx");

console.log("-- no dead step (wiring) ------------------------------");
ok(
  "tour offers per-step skip for create/interact steps",
  tourSrc.includes("onSkipStep") &&
    tourSrc.includes("guide.skipStep") &&
    tourSrc.includes("!canAdvanceWithoutProductEvent(step)")
);
ok(
  "tour unlocks the button if a navigation push stalls",
  tourSrc.includes("pendingTimer") &&
    /setTimeout\(\(\) => setPending\(false\), 2500\)/.test(tourSrc)
);
ok(
  "interact step retries instead of being a silent no-op",
  tourSrc.includes("router.refresh()") && tourSrc.includes("guide.retry")
);
ok(
  "provider merges live counts from the managers",
  providerSrc.includes('addEventListener("nexus:counts"') &&
    providerSrc.includes("Math.max(projectCount, liveCounts.projects)") &&
    providerSrc.includes("Math.max(taskCount, liveCounts.tasks)")
);
ok(
  "provider exposes skipStep on the context",
  providerSrc.includes("skipStep") &&
    providerSrc.includes('trackEvent("onboarding_step_skipped"')
);
ok(
  "project manager broadcasts its real count",
  projectSrc.includes('new CustomEvent("nexus:counts"') &&
    projectSrc.includes("projects: nextProjects.length")
);
ok(
  "task manager broadcasts its real count",
  taskSrc.includes('new CustomEvent("nexus:counts"') &&
    taskSrc.includes("tasks: nextTasks.length")
);
ok(
  "spotlight only yields to a visible modal",
  spotlightSrc.includes("getBoundingClientRect().width >= 2")
);

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
process.exit(failed === 0 ? 0 : 1);
