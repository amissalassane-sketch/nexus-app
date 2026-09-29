/**
 * NEXUS SHOWCASE — DETERMINISTIC MOCK DATA
 * =========================================
 * Used exclusively by the /showcase/* presentation routes for
 * motion-design screen capture (Figma + Butter).
 *
 * This file is completely isolated from production database queries
 * and authentication logic.
 */

import type {
  ProjectForecast,
  WeeklyBriefing,
  PrioritizedTask,
} from "@/lib/intelligence/advanced";
import type { TaskStatus, Priority } from "@/components/tasks/nexus-kanban";
import type { ActivityRow } from "@/components/activity-list";
import type { ShellCounts, ShellPlan, ShellUser, ShellWorkspace } from "@/components/layout/workspace-sidebar";

// ============================================================
// WORKSPACE & USER CONTEXT
// ============================================================

export const SHOWCASE_USER: ShellUser = {
  name: "Alex Chen",
  username: "alexchen",
  email: "alex@nexus.os",
  profileComplete: true,
};

export const SHOWCASE_WORKSPACE: ShellWorkspace = {
  name: "NEXUS Core",
  role: "owner",
  status: "ready",
};

export const SHOWCASE_COUNTS: ShellCounts = {
  tasks: 24,
  projects: 6,
  goals: 4,
  unreadNotifications: 2,
};

export const SHOWCASE_PLAN: ShellPlan = {
  name: "PRO",
  projectsUsed: 6,
  projectsLimit: 50,
  tasksUsed: 24,
  tasksLimit: 500,
  goalsUsed: 4,
  goalsLimit: 50,
};

// ============================================================
// DASHBOARD SHOWCASE DATA
// ============================================================

export const SHOWCASE_BRIEFING: WeeklyBriefing = {
  headline: "6 active projects on track, 3 blocked tasks require attention",
  summary:
    "Velocity is up +18% over the last 7 days. Q4 Launch and Mobile App represent 68% of active workload. Immediate resolution of API blockers will unlock 3 downstream tasks.",
  completedThisWeek: 14,
  completedPrevWeek: 11,
  momentumDelta: 18,
  openedThisWeek: 6,
  topMoves: [],
  outlook: "Strong pace ahead of Q4 milestone.",
};

export const SHOWCASE_PRIORITY_QUEUE: PrioritizedTask[] = [
  {
    task: {
      id: "task-p0-api",
      title: "Resolve API integration blocker",
      status: "blocked",
      priority: "urgent",
      due_at: "2026-09-29T15:00:00Z",
      project_id: "proj-q4-launch",
      updated_at: "2026-09-28T09:00:00Z",
      created_at: "2026-09-27T10:00:00Z",
    },
    score: 98,
    reasons: ["Blocks 3 downstream tasks", "Due tomorrow · 15:00"],
    href: "/showcase/tasks",
  },
  {
    task: {
      id: "task-p1-deploy",
      title: "Deploy staging environment #infra",
      status: "in_progress",
      priority: "high",
      due_at: "2026-09-29T18:00:00Z",
      project_id: "proj-nexus-website",
      updated_at: "2026-09-28T08:30:00Z",
      created_at: "2026-09-26T14:00:00Z",
    },
    score: 88,
    reasons: ["Release candidate verification pending", "Due tomorrow"],
    href: "/showcase/tasks",
  },
  {
    task: {
      id: "task-p1-design",
      title: "Finalize design system tokens",
      status: "in_progress",
      priority: "high",
      due_at: "2026-09-30T12:00:00Z",
      project_id: "proj-design-system",
      updated_at: "2026-09-28T07:45:00Z",
      created_at: "2026-09-25T11:00:00Z",
    },
    score: 82,
    reasons: ["Key dependency for mobile navigation", "Due in 2 days"],
    href: "/showcase/tasks",
  },
  {
    task: {
      id: "task-p2-onboarding",
      title: "Review mobile onboarding flow",
      status: "todo",
      priority: "medium",
      due_at: "2026-10-01T17:00:00Z",
      project_id: "proj-mobile-app",
      updated_at: "2026-09-27T16:00:00Z",
      created_at: "2026-09-24T09:00:00Z",
    },
    score: 74,
    reasons: ["Milestone preparation", "Due in 3 days"],
    href: "/showcase/tasks",
  },
];

export const SHOWCASE_ACTIVE_PROJECTS: ProjectForecast[] = [
  {
    projectId: "proj-q4-launch",
    name: "Q4 Launch",
    projectStatus: "active",
    progress: 78,
    dueDate: "2026-10-15T00:00:00Z",
    doneTasks: 18,
    openTasks: 5,
    velocity: 4.2,
    slipDays: -1,
    status: "watch",
    note: "2 blocked dependencies on critical path",
    projectedCompletion: "2026-10-14",
  },
  {
    projectId: "proj-mobile-app",
    name: "Mobile App",
    projectStatus: "active",
    progress: 62,
    dueDate: "2026-10-22T00:00:00Z",
    doneTasks: 14,
    openTasks: 8,
    velocity: 3.8,
    slipDays: -2,
    status: "on-track",
    note: "Pacing ahead of target date",
    projectedCompletion: "2026-10-20",
  },
  {
    projectId: "proj-design-system",
    name: "Design System",
    projectStatus: "active",
    progress: 91,
    dueDate: "2026-10-05T00:00:00Z",
    doneTasks: 21,
    openTasks: 2,
    velocity: 5.1,
    slipDays: -1,
    status: "on-track",
    note: "Final token audit in progress",
    projectedCompletion: "2026-10-04",
  },
  {
    projectId: "proj-nexus-website",
    name: "NEXUS Website",
    projectStatus: "active",
    progress: 85,
    dueDate: "2026-10-08T00:00:00Z",
    doneTasks: 17,
    openTasks: 3,
    velocity: 4.5,
    slipDays: -1,
    status: "on-track",
    note: "Staging deployment scheduled",
    projectedCompletion: "2026-10-07",
  },
  {
    projectId: "proj-auth-security",
    name: "Auth & Security Hardening",
    projectStatus: "completed",
    progress: 100,
    dueDate: "2026-09-28T00:00:00Z",
    doneTasks: 12,
    openTasks: 0,
    velocity: 3.0,
    slipDays: 0,
    status: "on-track",
    note: "Completed on schedule",
    projectedCompletion: "2026-09-28",
  },
  {
    projectId: "proj-ai-engine",
    name: "AI Context Engine",
    projectStatus: "active",
    progress: 70,
    dueDate: "2026-10-30T00:00:00Z",
    doneTasks: 7,
    openTasks: 3,
    velocity: 3.4,
    slipDays: -1,
    status: "watch",
    note: "Signal calibration underway",
    projectedCompletion: "2026-10-29",
  },
];

export const SHOWCASE_UPCOMING_ITEMS = [
  {
    id: "up-1",
    title: "Deploy staging environment #infra",
    dueAt: "2026-09-29T18:00:00Z",
    projectName: "NEXUS Website",
  },
  {
    id: "up-2",
    title: "Approve App Store assets",
    dueAt: "2026-09-30T10:00:00Z",
    projectName: "Mobile App",
  },
  {
    id: "up-3",
    title: "Review onboarding flow with design",
    dueAt: "2026-10-01T14:00:00Z",
    projectName: "Mobile App",
  },
  {
    id: "up-4",
    title: "Prepare Q4 Launch press release",
    dueAt: "2026-10-03T18:00:00Z",
    projectName: "Q4 Launch",
  },
];

export const SHOWCASE_ACTIVITIES: ActivityRow[] = [
  {
    id: "act-1",
    action: "completed",
    entity_type: "task",
    metadata: { title: "Define product architecture" },
    actor: "Alex Chen",
    created_at: "2026-09-28T09:42:00Z",
  },
  {
    id: "act-2",
    action: "created",
    entity_type: "task",
    metadata: { title: "Connect analytics API" },
    actor: "Alex Chen",
    created_at: "2026-09-28T08:15:00Z",
  },
  {
    id: "act-3",
    action: "updated",
    entity_type: "project",
    metadata: { title: "Design System" },
    actor: "Alex Chen",
    created_at: "2026-09-27T17:30:00Z",
  },
  {
    id: "act-4",
    action: "created",
    entity_type: "goal",
    metadata: { title: "Reach 99.9% Core Contract Reliability" },
    actor: "Alex Chen",
    created_at: "2026-09-27T14:20:00Z",
  },
];

// ============================================================
// TASKS KANBAN SHOWCASE DATA
// ============================================================

export type ShowcaseTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  priorityCode: "P0" | "P1" | "P2" | "P3";
  projectName: string;
  dueDate: string;
  blockedReason?: string;
};

export const SHOWCASE_KANBAN_TASKS: ShowcaseTask[] = [
  // TO DO
  {
    id: "task-todo-1",
    title: "Prepare launch assets",
    status: "todo",
    priority: "medium",
    priorityCode: "P2",
    projectName: "Q4 Launch",
    dueDate: "Oct 10",
  },
  {
    id: "task-todo-2",
    title: "Review onboarding flow",
    status: "todo",
    priority: "medium",
    priorityCode: "P2",
    projectName: "Mobile App",
    dueDate: "Oct 01",
  },
  {
    id: "task-todo-3",
    title: "Write release notes",
    status: "todo",
    priority: "low",
    priorityCode: "P3",
    projectName: "Q4 Launch",
    dueDate: "Oct 14",
  },

  // IN PROGRESS
  {
    id: "task-prog-1",
    title: "Build mobile navigation",
    status: "in_progress",
    priority: "high",
    priorityCode: "P1",
    projectName: "Mobile App",
    dueDate: "Oct 04",
  },
  {
    id: "task-prog-2",
    title: "Finalize design system",
    status: "in_progress",
    priority: "high",
    priorityCode: "P1",
    projectName: "Design System",
    dueDate: "Sep 30",
  },
  {
    id: "task-prog-3",
    title: "Deploy staging environment #infra",
    status: "in_progress",
    priority: "high",
    priorityCode: "P1",
    projectName: "NEXUS Website",
    dueDate: "Tomorrow",
  },

  // BLOCKED
  {
    id: "task-block-1",
    title: "Connect analytics API",
    status: "blocked",
    priority: "urgent",
    priorityCode: "P0",
    projectName: "Q4 Launch",
    dueDate: "Sep 29",
    blockedReason: "Awaiting API credentials",
  },
  {
    id: "task-block-2",
    title: "Approve App Store assets",
    status: "blocked",
    priority: "high",
    priorityCode: "P1",
    projectName: "Mobile App",
    dueDate: "Sep 30",
    blockedReason: "Compliance sign-off",
  },

  // DONE
  {
    id: "task-done-1",
    title: "Create landing page",
    status: "done",
    priority: "high",
    priorityCode: "P1",
    projectName: "NEXUS Website",
    dueDate: "Yesterday",
  },
  {
    id: "task-done-2",
    title: "Define product architecture",
    status: "done",
    priority: "urgent",
    priorityCode: "P0",
    projectName: "NEXUS Core",
    dueDate: "Sep 26",
  },
  {
    id: "task-done-3",
    title: "Setup Supabase auth schema",
    status: "done",
    priority: "urgent",
    priorityCode: "P0",
    projectName: "NEXUS Core",
    dueDate: "Sep 25",
  },
];

// ============================================================
// AI INTELLIGENCE SHOWCASE DATA
// ============================================================

export type ShowcaseSignal = {
  id: string;
  type: "risk" | "blocker" | "opportunity";
  severity: "critical" | "warning" | "info";
  headline: string;
  summary: string;
  entityLabel: string;
  entityType: "project" | "task" | "workspace";
  suggestedAction: string;
  evidence: string[];
};

export const SHOWCASE_SIGNALS: ShowcaseSignal[] = [
  {
    id: "sig-risk-1",
    type: "risk",
    severity: "critical",
    headline: "Q4 Launch is trending behind schedule",
    summary:
      "Task completion velocity slowed by 14% this week. Two critical path tasks are blocked by third-party integrations.",
    entityLabel: "Q4 Launch",
    entityType: "project",
    suggestedAction: "Reassign 2 auxiliary tasks to unblock path",
    evidence: ["Velocity drop from 5.4 to 4.2", "2 blocked dependencies", "Due in 17 days"],
  },
  {
    id: "sig-block-1",
    type: "blocker",
    severity: "warning",
    headline: "API integration is blocking 3 tasks",
    summary:
      "Task 'Connect analytics API' is holding up Staging deployment verification and Release notes drafting.",
    entityLabel: "Connect analytics API",
    entityType: "task",
    suggestedAction: "Execute mock remediation mission",
    evidence: ["Blocks 'Deploy staging environment'", "Blocks 'Write release notes'", "Overdue by 1 day"],
  },
  {
    id: "sig-opp-1",
    type: "opportunity",
    severity: "info",
    headline: "2 tasks can be completed in parallel",
    summary:
      "Design System token finalization and Mobile Navigation share no conflicting dependencies and can run concurrently.",
    entityLabel: "Design System & Mobile App",
    entityType: "workspace",
    suggestedAction: "Batch review scheduled for tomorrow",
    evidence: ["Independent Git branches", "Matching author: Alex Chen", "+12% projected throughput"],
  },
];

export const SHOWCASE_NEXT_BEST_ACTION = {
  title: "Resolve API integration blocker",
  subtitle: "Unlocks 3 downstream tasks in Q4 Launch",
  rationale:
    "NEXUS calculated this action provides the highest velocity gain (+24%) for today's milestone by unblocking Staging and Mobile analytics.",
  impactScore: "+24% velocity recovery",
  actionLabel: "Execute resolution plan",
};

export const SHOWCASE_MISSION = {
  id: "mis-q4-remediation",
  title: "API Blocker Remediation",
  objective: "Unblock API dependencies for Q4 Launch milestone",
  status: "running" as const,
  progress: 50,
  steps: [
    {
      id: "step-1",
      title: "Analyze dependency tree",
      status: "completed" as const,
      detail: "Mapped 3 downstream tasks depending on analytics API endpoint.",
    },
    {
      id: "step-2",
      title: "Identify blocking task",
      status: "completed" as const,
      detail: "Identified Task #task-block-1 ('Connect analytics API').",
    },
    {
      id: "step-3",
      title: "Notify project owner & suggest mock bridge",
      status: "in_progress" as const,
      detail: "Generated fallback stub contract to continue staging verification.",
    },
    {
      id: "step-4",
      title: "Create resolution task & unblock pipeline",
      status: "planned" as const,
      detail: "Will mark downstream tasks ready once mock bridge is active.",
    },
  ],
};

export const SHOWCASE_AI_ASK = {
  query: "What's putting the Q4 launch at risk?",
  answer:
    "The Q4 Launch is primarily at risk due to 2 blocked tasks in the infrastructure layer: **API integration** and **Staging deployment verification**. Resolving the API endpoint mock will unlock all 3 downstream items without slipping the October 15 milestone.",
  sources: [
    { label: "Task: Connect analytics API", status: "Blocked" },
    { label: "Project: Q4 Launch", status: "Watch (78%)" },
    { label: "Velocity Trend", status: "4.2 tasks/week" },
  ],
};
