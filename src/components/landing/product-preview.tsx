import {
  Bell,
  BrainCircuit,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/feedback";

// ============================================================
// NEXUS LANDING — PRODUCT PREVIEW
// A faithful, static representation of the real NEXUS workspace
// (rail + workspace sidebar + dashboard), rendered with the actual
// NEXUS V3 tokens and shared components. No invented UI language:
// this is the same surface an account-holder lands on, scaled down.
// ============================================================

const RAIL = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: CheckSquare, label: "Tasks", active: false },
  { icon: FolderKanban, label: "Projects", active: false },
  { icon: Target, label: "Goals", active: false },
  { icon: BrainCircuit, label: "Intelligence", active: false },
  { icon: Bell, label: "Notifications", active: false },
];

const SIDEBAR_ITEMS = [
  { label: "Dashboard", count: null as number | null, active: true },
  { label: "Tasks", count: 12, active: false },
  { label: "Projects", count: 3, active: false },
  { label: "Goals", count: 2, active: false },
  { label: "Intelligence", count: null, active: false },
  { label: "Notifications", count: 1, active: false },
];

const TASKS = [
  { title: "Ship onboarding emails", due: "Aug 16", tone: "danger" as const, done: false },
  { title: "Finalize Q3 goal review", due: "Today", tone: "warning" as const, done: false },
  { title: "Update project roadmap", due: "Aug 21", tone: "neutral" as const, done: false },
  { title: "Draft launch notes", due: "Done", tone: "success" as const, done: true },
];

const ACTIVITY = [
  { text: "Completed \"Draft launch notes\"", at: "09:41" },
  { text: "Added 3 tasks to \"Launch\"", at: "09:12" },
  { text: "Moved \"Launch\" to In progress", at: "08:57" },
];

export function ProductPreview() {
  return (
    <div className="group/preview relative" aria-hidden="true">
      <div className="overflow-hidden rounded-[20px] border border-border-strong bg-bg-surface shadow-[0_32px_80px_-16px_rgba(0,0,0,0.65)] transition-transform duration-500 ease-out-expo sm:rounded-[24px] sm:[transform:perspective(1600px)_rotateX(2.5deg)] sm:group-hover/preview:[transform:perspective(1600px)_rotateX(0deg)_translateY(-4px)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-subtle px-4 py-2.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-bg-surface-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-bg-surface-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-bg-surface-3" />
          </div>
          <span className="mx-auto inline-flex h-6 min-w-0 items-center rounded-pill border border-border-subtle bg-bg-surface px-3 font-mono text-[10.5px] text-text-tertiary">
            nexus.app/dashboard
          </span>
          <span className="w-10 shrink-0" aria-hidden="true" />
        </div>

        {/* App surface */}
        <div className="grid grid-cols-1 bg-bg-base lg:grid-cols-[56px_210px_minmax(0,1fr)]">
          {/* Level 1 — rail */}
          <div
            aria-hidden="true"
            className="hidden flex-col items-center gap-1 border-r border-border-subtle bg-bg-subtle/60 py-4 lg:flex"
          >
            {RAIL.map((item) => (
              <span
                key={item.label}
                className={`flex h-8 w-8 items-center justify-center rounded-nav ${
                  item.active ? "bg-accent text-accent-fg" : "text-text-tertiary"
                }`}
              >
                <item.icon size={15} strokeWidth={1.75} />
              </span>
            ))}
          </div>

          {/* Level 2 — workspace sidebar */}
          <div
            aria-hidden="true"
            className="hidden flex-col border-r border-border-subtle bg-bg-subtle/40 p-3 lg:flex"
          >
            <div className="flex h-9 items-center rounded-input border border-border-default bg-bg-surface px-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-secondary">
              Studio
            </div>
            <div className="mt-3 flex flex-col gap-0.5">
              {SIDEBAR_ITEMS.map((item) => (
                <span
                  key={item.label}
                  className={`flex h-7 items-center justify-between rounded-nav px-2 text-[11px] ${
                    item.active
                      ? "bg-accent font-medium text-accent-fg"
                      : "text-text-secondary"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.count !== null ? (
                    <span className="font-mono text-[10px] tabular-nums opacity-60">
                      {item.count}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
            <span className="mt-auto inline-flex h-[22px] w-fit items-center rounded-pill border border-border-default bg-bg-surface px-2 font-mono text-[10px] uppercase tracking-[0.04em] text-text-secondary">
              Free plan
            </span>
          </div>

          {/* Main dashboard surface */}
          <div className="min-w-0 border-r-0 bg-bg-base p-4 sm:p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-quaternary">
                  Tue, Aug 19
                </p>
                <p className="mt-1 truncate text-[15px] font-medium tracking-[-0.02em] text-text-primary">
                  Good morning.
                </p>
              </div>
              <Badge>Free</Badge>
            </div>

            {/* Focus */}
            <div className="mt-3 rounded-card border border-border-subtle bg-bg-subtle/60 p-3.5">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-lavender" aria-hidden="true" />
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                  Focus
                </span>
              </div>
              <p className="mt-2 text-[12.5px] font-medium text-text-primary">
                2 tasks are overdue.
              </p>
              <p className="mt-0.5 text-[11px] text-text-secondary">
                The oldest is &ldquo;Ship onboarding emails&rdquo;, due Aug 16 and still open.
              </p>
              <span className="mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-pill bg-accent px-3 text-[11px] font-medium text-accent-fg">
                Open task
              </span>
            </div>

            {/* Metrics strip */}
            <div className="mt-3 grid grid-cols-3 divide-x divide-border-subtle rounded-card border border-border-subtle bg-bg-subtle/60 sm:grid-cols-5">
              {[
                { label: "Open tasks", value: "12", tone: "" },
                { label: "Overdue", value: "2", tone: "text-danger" },
                { label: "In progress", value: "4", tone: "" },
                { label: "Projects", value: "3", tone: "" },
                { label: "Goals", value: "2", tone: "" },
              ].map((metric) => (
                <div key={metric.label} className="flex flex-col gap-0.5 px-2.5 py-2.5">
                  <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-tertiary">
                    {metric.label}
                  </span>
                  <span className={`font-mono text-[15px] leading-none tabular-nums text-text-primary ${metric.tone}`}>
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Two columns */}
            <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
              {/* Tasks */}
              <div className="rounded-card border border-border-subtle bg-bg-subtle/40 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                  Today
                </p>
                <div className="mt-2 flex flex-col">
                  {TASKS.map((task) => (
                    <div
                      key={task.title}
                      className="flex h-9 items-center gap-2.5 border-b border-border-subtle last:border-b-0"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[6px] border ${
                          task.done
                            ? "border-transparent bg-accent"
                            : "border-border-strong"
                        }`}
                      >
                        {task.done ? (
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <path
                              d="M2 5.2 4 7l4-4"
                              stroke="#0A0A0A"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[11.5px] ${
                          task.done ? "text-text-tertiary line-through" : "text-text-primary"
                        }`}
                      >
                        {task.title}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-[10px] tabular-nums ${
                          task.tone === "danger"
                            ? "text-danger"
                            : task.tone === "warning"
                              ? "text-warning"
                              : task.tone === "success"
                                ? "text-success"
                                : "text-text-tertiary"
                        }`}
                      >
                        {task.due}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Goals + Activity */}
              <div className="flex flex-col gap-3">
                <div className="rounded-card border border-border-subtle bg-bg-subtle/40 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                    Goals
                  </p>
                  <div className="mt-2.5 space-y-3">
                    {[
                      { label: "Ship v1", value: 72 },
                      { label: "Grow to 100 tasks", value: 45 },
                    ].map((goal) => (
                      <div key={goal.label}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="truncate text-[11px] text-text-secondary">
                            {goal.label}
                          </span>
                          <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
                            {goal.value}%
                          </span>
                        </div>
                        <Progress value={goal.value} label={goal.label} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hidden rounded-card border border-border-subtle bg-bg-subtle/40 p-3 sm:block">
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                    Activity
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {ACTIVITY.map((entry) => (
                      <div key={entry.at} className="flex items-baseline gap-2">
                        <span className="font-mono text-[9.5px] tabular-nums text-text-quaternary">
                          {entry.at}
                        </span>
                        <span className="min-w-0 truncate text-[10.5px] text-text-secondary">
                          {entry.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
