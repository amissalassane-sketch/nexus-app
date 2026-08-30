import type { ReactNode } from "react";
import {
  Activity,
  Bell,
  CalendarClock,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Pause,
  Radar,
  Target,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/feedback";

// ============================================================
// NEXUS LANDING — PRODUCT PREVIEW
// A faithful, static representation of the real overview: sidebar +
// top bar, then the four things the overview is actually about —
// next best action, workspace health, the active mission, the
// signals and the activity feed. Rendered with the real NEXUS
// tokens and component vocabulary (severity badges, operating
// index, mission progress), so the visitor recognises the product.
//
// This is a product visualisation, clearly labelled as such — not
// a screenshot of live data. Decorative for assistive tech.
// ============================================================

const NAV_PRIMARY = [
  { icon: LayoutDashboard, label: "Overview", count: null, active: true },
  { icon: Radar, label: "Intelligence", count: null, active: false },
];

const NAV_WORK = [
  { icon: FolderKanban, label: "Projects", count: 3, active: false },
  { icon: CheckSquare, label: "Tasks", count: 12, active: false },
  { icon: Target, label: "Goals", count: 2, active: false },
];

const NAV_WORKSPACE = [
  { icon: Activity, label: "Activity", count: null, active: false },
  { icon: Bell, label: "Notifications", count: 1, active: false },
];

const SIGNALS = [
  {
    icon: CalendarClock,
    kind: "Deadline",
    tone: "danger" as const,
    title: "2 tasks are past their due date",
    body: "The oldest is “Ship onboarding emails”, due 5 days ago.",
  },
  {
    icon: Pause,
    kind: "Blocked",
    tone: "warning" as const,
    title: "“Migrate auth cookies” is blocked",
    body: "Nothing downstream of it can move.",
  },
  {
    icon: Waves,
    kind: "At risk",
    tone: "warning" as const,
    title: "“Website redesign” may miss its date",
    body: "Deadline in 3 days, 4 tasks incomplete.",
  },
];

const HEALTH_FACTORS = [
  { label: "Momentum", intact: 0.72 },
  { label: "Overdue", intact: 0.84 },
  { label: "Blocked", intact: 0.9 },
];

const MISSION_STEPS = 5;
const MISSION_DONE = 2;

function NavGroup({
  label,
  items,
}: {
  label?: string;
  items: {
    icon: typeof LayoutDashboard;
    label: string;
    count: number | null;
    active: boolean;
  }[];
}) {
  return (
    <div>
      {label ? (
        <p className="px-2 pb-1 pt-3 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary">
          {label}
        </p>
      ) : null}
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <span
            key={item.label}
            className={`flex h-7 items-center gap-2 rounded-nav border px-2 text-[11px] ${
              item.active
                ? "border-border-subtle bg-white/[0.09] font-medium text-text-primary"
                : "border-transparent text-text-secondary"
            }`}
          >
            <item.icon
              size={12}
              strokeWidth={1.75}
              className={item.active ? "text-text-primary" : "text-text-tertiary"}
            />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count !== null ? (
              <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
                {item.count}
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/70 ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ label }: { label: string }) {
  return (
    <div className="border-b border-border-subtle px-3 py-2">
      <p className="text-[10.5px] font-semibold text-text-primary">{label}</p>
    </div>
  );
}

export function ProductPreview() {
  return (
    <div className="group/preview relative" aria-hidden="true">
      <div className="overflow-hidden rounded-[14px] border border-border-strong bg-bg-surface shadow-[0_32px_80px_-16px_rgba(0,0,0,0.7)] transition-transform duration-500 ease-out-expo sm:rounded-[16px] sm:[transform:perspective(1600px)_rotateX(2.5deg)] sm:group-hover/preview:[transform:perspective(1600px)_rotateX(0deg)_translateY(-4px)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-subtle px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
          </div>
          <span className="mx-auto inline-flex h-6 min-w-0 items-center rounded-pill border border-border-subtle bg-bg-surface px-3 font-mono text-[10.5px] text-text-secondary">
            nexus.app/dashboard
          </span>
          <span className="hidden shrink-0 font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-quaternary sm:block">
            Product visualisation
          </span>
          <span className="w-4 shrink-0 sm:hidden" />
        </div>

        {/* App surface */}
        <div className="grid grid-cols-1 bg-bg-base lg:grid-cols-[196px_minmax(0,1fr)]">
          {/* Sidebar */}
          <div className="hidden flex-col border-r border-border-subtle bg-bg-subtle/50 p-2.5 lg:flex">
            <div className="flex h-9 items-center gap-2 rounded-nav border border-border-subtle bg-bg-surface/50 px-2">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] border border-border-default bg-bg-surface-2 text-[10px] font-semibold text-text-primary">
                S
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium text-text-primary">
                  Studio
                </span>
                <span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-tertiary">
                  owner
                </span>
              </span>
            </div>

            <div className="mt-1.5 flex h-7 items-center gap-2 rounded-nav border border-border-subtle px-2 text-[10.5px] text-text-tertiary">
              <span className="flex-1">Search NEXUS…</span>
              <span className="font-mono text-[9.5px]">⌘K</span>
            </div>

            <div className="mt-2.5">
              <NavGroup items={NAV_PRIMARY} />
              <NavGroup label="Work" items={NAV_WORK} />
              <NavGroup label="Workspace" items={NAV_WORKSPACE} />
            </div>

            <div className="mt-auto border-t border-border-subtle pt-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary">
                  Plan
                </span>
                <span className="font-mono text-[10px] text-text-secondary">FREE</span>
              </div>
              <Progress value={60} className="mt-2" />
            </div>
          </div>

          {/* Main surface */}
          <div className="min-w-0 bg-bg-base">
            {/* Top bar */}
            <div className="flex h-9 items-center gap-2 border-b border-border-subtle px-4">
              <span className="text-[10.5px] font-medium text-text-primary">
                Overview
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-border-subtle px-1.5 py-0.5">
                <span className="h-1 w-1 rounded-pill bg-success" />
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-secondary">
                  Observing
                </span>
              </span>
              <span className="h-5 w-5 rounded-pill border border-border-default bg-bg-surface-2" />
            </div>

            <div className="p-4 sm:p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary">
                    Tuesday, August 19
                  </p>
                  <p className="mt-1.5 truncate text-[15px] font-semibold tracking-[-0.025em] text-text-primary">
                    Good morning, Alex.
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-secondary">
                    3 signals need a decision.
                  </p>
                </div>
                <Badge tone="quiet">Free</Badge>
              </div>

              <div className="mt-3.5 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
                {/* Left column — the decision */}
                <div className="flex min-w-0 flex-col gap-3">
                  {/* Next best action */}
                  <div className="rounded-card border border-lavender-border bg-lavender-subtle p-3.5">
                    <div className="flex items-center gap-2">
                      <CalendarClock
                        size={11}
                        strokeWidth={1.75}
                        className="text-lavender"
                      />
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary">
                        Next best action
                      </span>
                    </div>
                    <p className="mt-2 text-[12.5px] font-medium text-text-primary">
                      Finish “Ship onboarding emails”
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">
                      Oldest overdue task in the workspace (5 days ago).
                    </p>
                    <span className="mt-2.5 inline-flex h-6 items-center rounded-input bg-accent px-2.5 text-[10.5px] font-medium text-accent-fg">
                      Open task
                    </span>
                  </div>

                  {/* Needs attention */}
                  <Card>
                    <CardHeader label="Needs attention" />
                    {SIGNALS.map((signal) => (
                      <div
                        key={signal.title}
                        className="flex items-start gap-2.5 border-b border-border-subtle px-3 py-2.5 last:border-b-0"
                      >
                        <signal.icon
                          size={11}
                          strokeWidth={1.75}
                          className={`mt-0.5 shrink-0 ${
                            signal.tone === "danger"
                              ? "text-danger"
                              : "text-warning"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <Badge tone={signal.tone}>{signal.kind}</Badge>
                          <p className="mt-1 truncate text-[11px] font-medium text-text-primary">
                            {signal.title}
                          </p>
                          <p className="mt-0.5 truncate text-[10.5px] text-text-secondary">
                            {signal.body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>

                {/* Right column — health, mission, activity */}
                <div className="flex min-w-0 flex-col gap-3">
                  {/* Workspace health */}
                  <Card className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary">
                          Workspace health
                        </p>
                        <p className="mt-1 text-[11px] text-text-secondary">
                          Operating index
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[20px] leading-none tabular-nums text-text-primary">
                          82
                        </span>
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-tertiary">
                          /100
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-border-subtle pt-2.5">
                      {HEALTH_FACTORS.map((factor) => (
                        <div key={factor.label} className="py-1.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-secondary">
                              {factor.label}
                            </span>
                            <span className="font-mono text-[9.5px] tabular-nums text-text-tertiary">
                              {Math.round(factor.intact * 100)}%
                            </span>
                          </div>
                          <div
                            className="mt-1 h-[3px] overflow-hidden rounded-pill bg-white/[0.06]"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full rounded-pill bg-white/25"
                              style={{ width: `${factor.intact * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Mission */}
                  <Card className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary">
                        Mission
                      </span>
                      <Badge tone="warning">Blocked</Badge>
                    </div>
                    <p className="mt-2 text-[12.5px] font-medium text-text-primary">
                      Unblock the launch
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">
                      {MISSION_DONE}/{MISSION_STEPS} steps completed
                    </p>
                    <Progress
                      value={(MISSION_DONE / MISSION_STEPS) * 100}
                      tone="warning"
                      className="mt-2"
                    />
                  </Card>

                  {/* Activity */}
                  <Card>
                    <CardHeader label="Activity" />
                    <div className="flex items-start gap-2.5 px-3 py-2.5">
                      <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-text-quaternary" />
                      <p className="text-[10.5px] leading-[15px] text-text-secondary">
                        Alex completed “Review signup flow” · 12m
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5 border-t border-border-subtle px-3 py-2.5">
                      <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-text-quaternary" />
                      <p className="text-[10.5px] leading-[15px] text-text-secondary">
                        Milestone “Ship v1” updated · 1h
                      </p>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/50 sm:grid-cols-5 [&>*]:border-r [&>*]:border-border-subtle [&>*:last-child]:border-r-0">
                {[
                  { label: "Open", value: "12" },
                  { label: "Overdue", value: "2", tone: "text-danger" },
                  { label: "Blocked", value: "1", tone: "text-warning" },
                  { label: "This week", value: "4" },
                  { label: "Completed", value: "68%" },
                ].map((metric) => (
                  <div key={metric.label} className="flex flex-col gap-1.5 px-2.5 py-2.5">
                    <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-tertiary">
                      {metric.label}
                    </span>
                    <span
                      className={`font-mono text-[14px] leading-none tabular-nums ${
                        metric.tone || "text-text-primary"
                      }`}
                    >
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
