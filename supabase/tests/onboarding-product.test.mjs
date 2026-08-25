/**
 * NEXUS — product onboarding model tests (pure, no network).
 * Covers skip, resume, existing-project skip, activation vs tour done.
 */
const model = await import("../../src/lib/onboarding/model.ts");

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
ok(
  "new user auto-starts guide",
  shouldAutoStartGuide(EMPTY_ONBOARDING, emptyFacts)
);
ok(
  "first pending step is welcome",
  nextPendingStep(emptyFacts, []).id === "welcome"
);
ok(
  "signup is not activation",
  isActivated(emptyFacts) === false
);
ok(
  "tour completion is not activation if intelligence unused",
  isActivated({
    ...emptyFacts,
    projectCount: 1,
    taskCount: 1,
    intelligenceInteracted: false,
  }) === false
);
ok(
  "activation requires project + task + intelligence",
  isActivated({
    ...emptyFacts,
    projectCount: 1,
    taskCount: 1,
    intelligenceInteracted: true,
  }) === true
);

console.log("-- existing work --------------------------------------");
const experienced = {
  ...emptyFacts,
  projectCount: 2,
  taskCount: 5,
};
ok(
  "experienced idle user does not auto-start first-run",
  shouldAutoStartGuide(EMPTY_ONBOARDING, experienced) === false
);
ok(
  "create-project is satisfied by real project count",
  isStepSatisfied(
    GUIDE_STEPS.find((s) => s.id === "create_project"),
    experienced,
    []
  )
);
ok(
  "next step after existing project is create_task if no tasks... wait has tasks",
  nextPendingStep(experienced, ["welcome"])?.id === "intelligence"
);

console.log("-- skip / resume --------------------------------------");
ok(
  "skipped guide does not auto-restart",
  shouldAutoStartGuide(
    { ...EMPTY_ONBOARDING, status: "skipped" },
    emptyFacts
  ) === false
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
  shouldAutoStartGuide(
    { ...EMPTY_ONBOARDING, status: "completed" },
    emptyFacts
  ) === false
);
ok(
  "resume after two steps continues at intelligence if project+task exist",
  nextPendingStep(
    { ...emptyFacts, projectCount: 1, taskCount: 1 },
    ["welcome", "create_project", "create_task"]
  )?.id === "intelligence"
);

console.log("-- persistence parse ----------------------------------");
ok("invalid payload becomes empty", parseOnboarding(null).status === "idle");
ok(
  "unknown steps are dropped",
  parseOnboarding({
    status: "active",
    completedSteps: ["welcome", "hack"],
  }).completedSteps.join(",") === "welcome"
);

console.log("-- checklist ------------------------------------------");
ok("empty checklist is 0/4", checklistProgress(emptyFacts).done === 0);
ok(
  "full checklist is 4/4",
  checklistProgress({
    projectCount: 1,
    taskCount: 1,
    goalCount: 0,
    profileComplete: true,
    intelligenceInteracted: true,
  }).done === 4
);
ok(
  "guide finished when all actions done",
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

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
process.exit(failed === 0 ? 0 : 1);
