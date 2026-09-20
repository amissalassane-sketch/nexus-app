import Link from "next/link";
import { IconLayoutKanban } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState, Progress } from "@/components/ui/feedback";
import type {
  ForecastStatus,
  ProjectForecast,
} from "@/lib/intelligence/advanced";

// ============================================================
// NEXUS — ACTIVE PROJECTS (health table)
// Renders `forecastWorkspace()` from the existing Intelligence
// engine: real progress, real task counts, real velocity and the
// projection that follows from them. Health is the engine's own
// status — never a decorative guess.
// ============================================================

const HEALTH: Record<
  ForecastStatus,
  { label: string; tone: BadgeTone }
> = {
  "on-track": { label: "On track", tone: "success" },
  watch: { label: "Watch", tone: "warning" },
  "at-risk": { label: "At risk", tone: "danger" },
  stalled: { label: "Stalled", tone: "warning" },
  unknown: { label: "No data", tone: "neutral" },
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  }).format(date);
};

export function ActiveProjectsPanel({
  forecasts,
}: {
  forecasts: ProjectForecast[];
}) {
  return (
    <Panel
      title="Active projects"
      description="Health, pace and projection — derived from real completions"
      bodyClassName="p-0"
      actions={
        <Link
          href="/projects"
          className="text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:text-text-primary"
        >
          View all
        </Link>
      }
    >
      {forecasts.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No active projects yet"
            description="Projects give NEXUS the context to track pace, deadlines and risk."
            icon={<NexusIcon icon={IconLayoutKanban} size="state" />}
            action={
              <Link
                href="/projects?create=1"
                className="inline-flex h-9 items-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-colors hover:bg-accent-hover"
              >
                Create a project
              </Link>
            }
          />
        </div>
      ) : (
        <div>
          {/* Column heads — desktop only */}
          <div className="hidden items-center gap-4 border-b border-border-subtle px-4 py-2 text-[10.5px] uppercase tracking-wider text-text-quaternary sm:grid sm:grid-cols-[minmax(0,2.4fr)_92px_minmax(120px,1fr)_120px_84px]">
            <span>Project</span>
            <span>Health</span>
            <span>Progress</span>
            <span>Tasks</span>
            <span className="text-right">Due</span>
          </div>

          <ul>
            {forecasts.map((forecast) => {
              const health = HEALTH[forecast.status];
              const progress = Math.min(
                100,
                Math.max(0, Math.round(forecast.progress))
              );
              const overdueDue =
                forecast.slipDays !== null && forecast.slipDays > 0;

              return (
                <li key={forecast.projectId}>
                  <Link
                    href="/projects"
                    className="grid grid-cols-1 gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3 transition-colors duration-150 ease-nexus last:border-b-0 hover:bg-white/[0.02] sm:grid-cols-[minmax(0,2.4fr)_92px_minmax(120px,1fr)_120px_84px] sm:items-center"
                  >
                    {/* Name + engine note */}
                    <span className="flex min-w-0 items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary"
                      >
                        <NexusIcon icon={IconLayoutKanban} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-body-medium text-text-primary">
                          {forecast.name}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-caption leading-snug text-text-tertiary">
                          {forecast.note}
                        </span>
                      </span>
                    </span>

                    {/* Health */}
                    <span className="flex items-center gap-2 sm:block">
                      <span className="text-caption text-text-quaternary sm:hidden">
                        Health
                      </span>
                      <Badge tone={health.tone}>{health.label}</Badge>
                    </span>

                    {/* Progress */}
                    <span className="flex items-center gap-2.5">
                      <Progress
                        value={progress}
                        label={`${forecast.name} progress`}
                        tone={
                          forecast.status === "at-risk"
                            ? "danger"
                            : forecast.status === "watch" ||
                                forecast.status === "stalled"
                            ? "warning"
                            : "white"
                        }
                      />
                      <span className="w-9 shrink-0 text-right font-mono text-mono tabular-nums text-text-secondary">
                        {progress}%
                      </span>
                    </span>

                    {/* Task counts */}
                    <span className="font-mono text-mono tabular-nums text-text-secondary">
                      {forecast.openTasks} open · {forecast.doneTasks} done
                    </span>

                    {/* Due */}
                    <span
                      className={cn(
                        "font-mono text-mono tabular-nums sm:text-right",
                        overdueDue ? "text-danger" : "text-text-secondary"
                      )}
                    >
                      {formatDate(forecast.dueDate)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}
