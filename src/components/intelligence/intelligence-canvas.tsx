"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";
import type { WorkspaceContext } from "@/lib/intelligence/engine";

// The canvas engine is ~40KB of logic that only matters once the hero is
// on screen: it is loaded on the client, after the shell has painted.
const IntelligenceNetwork = dynamic(
  () =>
    import("@/components/intelligence/intelligence-network").then(
      (module) => module.IntelligenceNetwork
    ),
  { ssr: false }
);

// ============================================================
// NEXUS — INTELLIGENCE CANVAS
// The workspace-facing hero: a subtle relationship field behind a
// factual read of what NEXUS currently understands. The visual is
// atmosphere; the numbers are the content, and they come from the
// real snapshot. Motion is calm, paused off-screen, and disabled
// entirely under prefers-reduced-motion (handled by the engine).
// ============================================================

export function IntelligenceCanvas({
  context,
  signalCount,
  criticalCount,
  className,
}: {
  context: WorkspaceContext;
  signalCount: number;
  criticalCount: number;
  className?: string;
}) {
  const stats: { value: string; label: string; tone?: "danger" }[] = [
    { value: String(context.activeProjects), label: "Projects tracked" },
    { value: String(context.openTasks), label: "Open tasks" },
    { value: String(context.datedItems), label: "Dated items" },
    {
      value: String(criticalCount),
      label: "Critical signals",
      ...(criticalCount > 0 ? { tone: "danger" as const } : {}),
    },
  ];

  return (
    <section
      aria-label="What NEXUS understands about this workspace"
      className={cn(
        "relative isolate overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/70",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <IntelligenceNetwork
          className="h-full w-full"
          config={{
            nodeCount: 54,
            connectionDistance: 128,
            calmRadius: 300,
            calmCenterY: 0.5,
            nodeOpacity: [0.1, 0.34],
            linkOpacity: [0.03, 0.1],
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,transparent_20%,rgba(0,0,0,0.75)_100%)]"
        />
      </div>

      <div className="px-4 py-6 sm:px-6 sm:py-7">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-pill bg-lavender signal-pulse"
          />
          <p className="eyebrow text-text-tertiary">Workspace context</p>
        </div>

        <p className="mt-3 max-w-[58ch] text-[15px] leading-[23px] text-text-primary">
          {summary(context, signalCount)}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dd
                className={cn(
                  "font-mono text-[20px] leading-none tabular-nums",
                  stat.tone === "danger" ? "text-danger" : "text-text-primary"
                )}
              >
                {stat.value}
              </dd>
              <dt className="eyebrow mt-2 text-text-quaternary">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** A factual sentence — never a claim NEXUS cannot back with the snapshot. */
function summary(context: WorkspaceContext, signalCount: number): string {
  if (context.projects === 0 && context.tasks === 0) {
    return "This workspace is empty. Once projects and tasks exist, NEXUS starts tracking dates, dependencies and momentum, and surfaces what needs a decision.";
  }

  if (signalCount === 0) {
    return `NEXUS is tracking ${context.activeProjects} ${
      context.activeProjects === 1 ? "project" : "projects"
    } and ${context.openTasks} open ${
      context.openTasks === 1 ? "task" : "tasks"
    }. Nothing is overdue, blocked or drifting right now.`;
  }

  const parts: string[] = [];
  if (context.blockedTasks > 0) parts.push(`${context.blockedTasks} blocked`);
  if (context.overdueTasks > 0) parts.push(`${context.overdueTasks} overdue`);
  if (context.dueThisWeek > 0) parts.push(`${context.dueThisWeek} due this week`);

  const detail = parts.length > 0 ? `: ${parts.join(", ")}.` : ".";

  return `NEXUS read ${context.tasks} ${
    context.tasks === 1 ? "task" : "tasks"
  } across ${context.activeProjects} ${
    context.activeProjects === 1 ? "project" : "projects"
  } and found ${signalCount} ${
    signalCount === 1 ? "signal" : "signals"
  } worth your attention${detail}`;
}
