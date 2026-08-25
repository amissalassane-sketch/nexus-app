const { askWorkspace } = await import("../../src/lib/intelligence/advanced.ts");
const { buildWorkspaceContext } = await import("../../src/lib/intelligence/context-builder.ts");
const navConfig = await import("../../src/components/layout/nav-config.ts");
const { NAV_GROUPS, MOBILE_NAV } = navConfig;

let passed = 0;
let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

const mockSnapshot = {
  now: new Date("2026-08-25T10:00:00Z"),
  projects: [
    {
      id: "p1",
      name: "Website Redesign",
      status: "active",
      due_date: "2026-08-20T00:00:00Z", // overdue deadline
      progress: 40,
    },
    {
      id: "p2",
      name: "API Migration",
      status: "active",
      due_date: "2026-09-15T00:00:00Z",
      progress: 75,
    },
  ],
  tasks: [
    {
      id: "t1",
      title: "Deploy auth service",
      status: "blocked",
      priority: "urgent",
      due_at: "2026-08-22T00:00:00Z", // overdue + blocked
      project_id: "p1",
      created_at: "2026-08-10T00:00:00Z",
    },
    {
      id: "t2",
      title: "Prepare sprint review",
      status: "todo",
      priority: "high",
      due_at: "2026-08-25T18:00:00Z", // due today
      project_id: "p2",
      created_at: "2026-08-20T00:00:00Z",
    },
    {
      id: "t3",
      title: "Update documentation",
      status: "done",
      priority: "medium",
      due_at: "2026-08-23T00:00:00Z",
      completed_at: "2026-08-24T12:00:00Z", // completed this week
      project_id: "p2",
      created_at: "2026-08-15T00:00:00Z",
    },
  ],
  goals: [
    {
      id: "g1",
      title: "Launch v2",
      status: "active",
      progress: 60,
      target_date: "2026-09-30T00:00:00Z",
    },
  ],
};

console.log("-- intelligence intents --------------------------------");
{
  const answer = askWorkspace(mockSnapshot, "Quels projets nécessitent mon attention ?");
  ok("Analysis intent matches projects_attention", answer.kind === "projects_attention");
  ok("Analysis references Website Redesign", answer.lines.some((l) => l.label === "Website Redesign"));
}

{
  const answer = askWorkspace(mockSnapshot, "Quelles sont mes 3 prochaines tâches prioritaires ?");
  ok("Prioritization intent matches priorities", answer.kind === "priorities");
  ok("Priorities include urgent blocked task", answer.lines.some((l) => l.value.includes("Deploy auth service")));
}

{
  const answer = askWorkspace(mockSnapshot, "Quels projets semblent bloqués ?");
  ok("Detection intent matches projects_blocked", answer.kind === "projects_blocked");
  ok("Blocked projects detect Website Redesign", answer.lines.some((l) => l.label === "Website Redesign" && l.value.includes("blocked")));
}

{
  const answer = askWorkspace(mockSnapshot, "Résume l'activité de cette semaine.");
  ok("Synthesis intent matches synthesis", answer.kind === "synthesis");
  ok("Synthesis shows weekly completion", answer.lines.some((l) => l.label.includes("Completed")));
}

{
  const answer = askWorkspace(mockSnapshot, "Aide-moi à organiser cette semaine.");
  ok("Planning intent matches planning", answer.kind === "planning");
  ok("Planning prioritizes urgent tasks", answer.lines.some((l) => l.label.includes("Urgent today")));
}

{
  const answer = askWorkspace(mockSnapshot, "Crée une tâche pour préparer la présentation de vendredi.");
  ok("Action intent matches action_proposal", answer.kind === "action_proposal");
  ok("Action proposal has valid title", answer.actionProposal?.title?.toLowerCase().includes("préparer la présentation"));
  ok("Action proposal computes deadline for Friday", Boolean(answer.actionProposal?.dueDate));
}

console.log("-- context builder ------------------------------------");
{
  const context = buildWorkspaceContext("ws-123", mockSnapshot);
  ok("Context builder assigns workspaceId", context.workspaceId === "ws-123");
  ok("Context builder counts total projects", context.totals.projects === 2);
  ok("Context builder counts open tasks", context.totals.openTasks === 2);
  ok("Context builder identifies overdue task", context.totals.overdueTasks === 1);
  ok("Context builder identifies blocked task", context.totals.blockedTasks === 1);
  ok("Context builder identifies projects needing attention", context.projectsNeedingAttention.length > 0);
  ok("Context builder ranks priorities", context.topPriorityTasks.length > 0);
}

console.log("-- navigation model -----------------------------------");
{
  const workGroup = NAV_GROUPS.find((g) => g.id === "work");
  const workspaceGroup = NAV_GROUPS.find((g) => g.id === "workspace");
  ok("Work group label is uppercase WORK", workGroup?.label === "WORK");
  ok("Workspace group label is uppercase WORKSPACE", workspaceGroup?.label === "WORKSPACE");

  const mobileHrefs = MOBILE_NAV.map((n) => n.href);
  ok("Mobile nav includes Overview", mobileHrefs.includes("/dashboard"));
  ok("Mobile nav includes Intelligence", mobileHrefs.includes("/app/intelligence"));
  ok("Mobile nav includes Projects", mobileHrefs.includes("/projects"));
  ok("Mobile nav includes Tasks", mobileHrefs.includes("/tasks"));
}

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
if (failed > 0) process.exit(1);
