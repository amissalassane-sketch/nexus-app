const { askWorkspace, reasonWorkspace } = await import("../../src/lib/intelligence/advanced.ts");
const { buildWorkspaceContext } = await import("../../src/lib/intelligence/context-builder.ts");
const { detectAIProvider } = await import("../../src/lib/intelligence/ai-provider.ts");
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

console.log("-- intelligence 6 core capabilities (reasonWorkspace) ---");
{
  const res = reasonWorkspace(mockSnapshot, "Quels projets nécessitent mon attention ?");
  ok("A. Analyse: intent is analysis", res.intent === "analysis");
  ok("A. Analyse: headline highlights projects needing attention", res.headline.includes("require"));
  ok("A. Analyse: evidence metrics attached", res.evidence.metrics.length > 0);
  ok("A. Analyse: provider is honest nexus-engine", res.provider === "nexus-engine");
  ok("A. Analyse: items include Website Redesign", res.items?.some((i) => i.title === "Website Redesign"));
}

{
  const res = reasonWorkspace(mockSnapshot, "Quelles sont mes 3 prochaines tâches prioritaires ?");
  ok("B. Priorisation: intent is prioritization", res.intent === "prioritization");
  ok("B. Priorisation: top task is Deploy auth service", res.items?.[0]?.title === "Deploy auth service");
  ok("B. Priorisation: action opens top task", res.action?.type === "open_task");
}

{
  const res = reasonWorkspace(mockSnapshot, "Aide-moi à organiser cette semaine.");
  ok("C. Planification: intent is planning", res.intent === "planning");
  ok("C. Planification: sequenced steps generated", (res.items?.length ?? 0) >= 3);
  ok("C. Planification: immediate focus clears overdue debt", res.items?.[0]?.title.includes("Clear deadline debt"));
}

{
  const res = reasonWorkspace(mockSnapshot, "Organise ma journée.");
  ok("C. Planification du jour: intent is planning", res.intent === "planning");
  ok("C. Planification du jour: structured time slots", res.items?.some((i) => i.title.includes("09:00")));
  ok("C. Planification du jour: 09:00 clears overdue debt", res.items?.[0]?.title.includes("09:00"));
  ok("C. Planification du jour: 09:00 task is Deploy auth service", res.items?.[0]?.title.includes("Deploy auth service"));
  ok("C. Planification du jour: has quick actions", (res.quickActions?.length ?? 0) > 0);
}

{
  const res = reasonWorkspace(mockSnapshot, "Résume mon activité cette semaine.");
  ok("D. Synthèse: intent is synthesis", res.intent === "synthesis");
  ok("D. Synthèse: mentions completed tasks", res.evidence.metrics.some((m) => m.label.includes("Completed")));
  ok("D. Synthèse: links to activity log", res.action?.payload?.url === "/activity");
}

{
  const res = reasonWorkspace(mockSnapshot, "Quels projets semblent bloqués ?");
  ok("E. Détection: intent is detection", res.intent === "detection");
  ok("E. Détection: identifies blocked project", res.headline.includes("blocked"));
  ok("E. Détection: items include blocked task", res.items?.some((i) => i.title.includes("Deploy auth service")));
}

{
  const res = reasonWorkspace(mockSnapshot, "Je dois préparer ma présentation de vendredi.");
  ok("F. Action: intent is action from 'Je dois préparer...'", res.intent === "action");
  ok("F. Action: requires confirmation before mutating", res.action?.confirmationRequired === true);
  ok("F. Action: action type is create_task", res.action?.type === "create_task");
  ok("F. Action: extracted title is clean", res.action?.payload?.title?.toLowerCase().includes("préparer ma présentation"));
  ok("F. Action: calculated deadline for Friday", Boolean(res.action?.payload?.dueDate));
}

{
  const res = reasonWorkspace(mockSnapshot, "Crée un projet pour mon portfolio.");
  ok("F. Action: creates project intent", res.intent === "action");
  ok("F. Action: action type is create_project", res.action?.type === "create_project");
  ok("F. Action: requires confirmation", res.action?.confirmationRequired === true);
  ok("F. Action: extracted name is Portfolio", res.action?.payload?.name === "Portfolio");
}

console.log("-- session memory & follow-ups -------------------------");
{
  const turn1History = [
    {
      id: "turn-1",
      query: "Quels projets sont en retard ?",
      intent: "analysis",
      headline: "2 projects require attention",
      targetEntities: ["Website Redesign", "API Migration"],
    },
  ];

  const res = reasonWorkspace(mockSnapshot, "Et lequel est le plus urgent ?", undefined, turn1History);
  ok("Session follow-up: resolves pronoun follow-up", res.intent === "prioritization");
  ok("Session follow-up: identifies Website Redesign as most urgent", res.headline.includes("Website Redesign"));
  ok("Session follow-up: evidence traces back to previous turn", res.evidence.traceCount.includes("previous query"));
}

console.log("-- empty workspace handling ----------------------------");
{
  const emptySnapshot = { now: new Date("2026-08-25T10:00:00Z"), projects: [], tasks: [], goals: [] };
  const res = reasonWorkspace(emptySnapshot, "Que dois-je faire ?");
  ok("Empty workspace: headline explains ready state", res.headline === "Intelligence is ready.");
  ok("Empty workspace: guides to create first project", res.action?.type === "create_project");
  ok("Empty workspace: provides quick action links", (res.quickActions?.length ?? 0) >= 2);
}

console.log("-- intelligence legacy adapter (askWorkspace) ------------");
{
  const answer = askWorkspace(mockSnapshot, "Quels projets nécessitent mon attention ?");
  ok("Analysis intent matches projects_attention", answer.kind === "projects_attention");
  ok("Analysis references Website Redesign", answer.lines.some((l) => l.label === "Website Redesign"));
}

{
  const answer = askWorkspace(mockSnapshot, "Quelles sont mes 3 prochaines tâches prioritaires ?");
  ok("Prioritization intent matches priorities", answer.kind === "priorities");
  ok("Priorities include urgent blocked task", answer.lines.some((l) => l.label.includes("Deploy auth service")));
}

{
  const answer = askWorkspace(mockSnapshot, "Quels projets semblent bloqués ?");
  ok("Detection intent matches projects_blocked", answer.kind === "projects_blocked");
  ok("Blocked projects detect Website Redesign", answer.lines.some((l) => l.label.includes("Website Redesign")));
}

{
  const answer = askWorkspace(mockSnapshot, "Résume l'activité de cette semaine.");
  ok("Synthesis intent matches synthesis", answer.kind === "synthesis");
  ok("Synthesis shows weekly completion", answer.lines.some((l) => l.label.includes("Completed")));
}

{
  const answer = askWorkspace(mockSnapshot, "Crée une tâche pour préparer la présentation de vendredi.");
  ok("Action intent matches action_proposal", answer.kind === "action_proposal");
  ok("Action proposal has valid title", answer.actionProposal?.title?.toLowerCase().includes("préparer la présentation"));
  ok("Action proposal computes deadline for Friday", Boolean(answer.actionProposal?.dueDate));
}

console.log("-- context builder with real activity & dependencies -----");
{
  const mockActivities = [
    {
      id: "act-1",
      entityType: "task",
      action: "completed",
      title: "Update documentation",
      actorName: "Sarah",
      createdAt: "2026-08-24T12:00:00Z",
    },
  ];

  const mockDependencies = [
    {
      taskId: "t1",
      taskTitle: "Deploy auth service",
      dependsOnTaskId: "t0",
      dependsOnTitle: "Database migration",
    },
  ];

  const context = buildWorkspaceContext("ws-123", mockSnapshot, {
    activities: mockActivities,
    dependencies: mockDependencies,
  });

  ok("Context builder assigns workspaceId", context.workspaceId === "ws-123");
  ok("Context builder counts total projects", context.totals.projects === 2);
  ok("Context builder counts open tasks", context.totals.openTasks === 2);
  ok("Context builder identifies overdue task", context.totals.overdueTasks === 1);
  ok("Context builder identifies blocked task", context.totals.blockedTasks === 1);
  ok("Context builder includes recent activities", context.recentActivities.length === 1);
  ok("Context builder compactPrompt contains health and risk", context.compactPrompt.includes("OPERATING HEALTH INDEX"));
  ok("Context builder compactPrompt includes audit activity", context.compactPrompt.includes("Update documentation"));
}

console.log("-- AI provider detection & fallback ---------------------");
{
  const provider = detectAIProvider();
  ok("Provider defaults to honest nexus-engine when env vars missing", provider.provider === "nexus-engine");
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

console.log("-- natural language & synonyms (FR / EN) --------------");
{
  const res1 = reasonWorkspace(mockSnapshot, "Qu'est-ce qui risque de prendre du retard ?");
  ok("Synonym: 'Qu'est-ce qui risque de prendre du retard' -> analysis", res1.intent === "analysis");
  ok("Synonym: analysis includes evidence", res1.evidence.metrics.length > 0);

  const res2 = reasonWorkspace(mockSnapshot, "What should I do first?");
  ok("Synonym: 'What should I do first?' -> prioritization", res2.intent === "prioritization");
  ok("Synonym: prioritization top task identified", res2.items?.[0]?.title === "Deploy auth service");

  const res3 = reasonWorkspace(mockSnapshot, "Qu'est-ce qui a changé récemment ?");
  ok("Synonym: 'Qu'est-ce qui a changé récemment' -> synthesis", res3.intent === "synthesis");

  const res4 = reasonWorkspace(mockSnapshot, "Qu'est-ce qui empêche mon travail d'avancer ?");
  ok("Synonym: 'Qu'est-ce qui empêche mon travail d'avancer' -> detection", res4.intent === "detection");
}

console.log("-- task dependencies & blocker tracing in context ------");
{
  const mockDeps = [
    {
      taskId: "t1",
      taskTitle: "Deploy auth service",
      dependsOnTaskId: "t0",
      dependsOnTitle: "Database migration",
    },
  ];

  const context = buildWorkspaceContext("ws-123", mockSnapshot, { dependencies: mockDeps });
  const blockedTask = context.blockedTasksDetail.find((b) => b.id === "t1");
  ok("Context traces blocker dependency to prerequisite task", blockedTask?.blockedBy?.includes("Database migration"));
}

console.log(`\n================ ${passed} passed / ${failed} failed ================`);
if (failed > 0) process.exit(1);
