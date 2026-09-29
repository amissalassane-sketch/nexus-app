import type { Metadata } from "next";
import {
  IconBan,
  IconChecklist,
  IconLayoutKanban,
  IconTarget,
} from "@tabler/icons-react";
import { ShowcaseShell } from "@/components/showcase/showcase-shell";
import { KpiGrid, type KpiItem } from "@/components/dashboard/kpi-grid";
import { BriefingPanel } from "@/components/dashboard/briefing-panel";
import { PriorityQueuePanel } from "@/components/dashboard/priority-queue";
import { ActiveProjectsPanel } from "@/components/dashboard/active-projects";
import { UpcomingPanel } from "@/components/dashboard/upcoming-panel";
import { ActivityList } from "@/components/activity-list";
import { CaptureBar } from "@/components/capture/capture-bar";
import {
  SHOWCASE_USER,
  SHOWCASE_BRIEFING,
  SHOWCASE_PRIORITY_QUEUE,
  SHOWCASE_ACTIVE_PROJECTS,
  SHOWCASE_UPCOMING_ITEMS,
  SHOWCASE_ACTIVITIES,
} from "@/lib/showcase/mock-data";

export const metadata: Metadata = {
  title: "Dashboard Showcase — NEXUS Motion Design Asset",
  description: "Motion-design visual asset for NEXUS Dashboard / Overview.",
};

export default function ShowcaseDashboardPage() {
  const kpiItems: KpiItem[] = [
    {
      label: "Active tasks",
      value: 24,
      icon: IconChecklist,
      href: "/showcase/tasks",
      tone: "default",
    },
    {
      label: "Blocked / At risk",
      value: 3,
      icon: IconBan,
      href: "/showcase/tasks",
      tone: "danger",
    },
    {
      label: "Active projects",
      value: 6,
      icon: IconLayoutKanban,
      href: "/showcase/dashboard",
      tone: "success",
    },
    {
      label: "Goals on track",
      value: 4,
      icon: IconTarget,
      href: "/showcase/dashboard",
      tone: "accent",
    },
  ];

  return (
    <ShowcaseShell activeTab="dashboard">
      <div className="space-y-6">
        {/* Session Header */}
        <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-text-primary">
              Good morning, {SHOWCASE_USER.name}
            </h1>
            <p className="text-[13px] text-text-secondary mt-0.5">
              Wednesday, Sep 28 · 6 projects active · 3 items require attention
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-3 py-1 text-[11px] font-mono text-text-tertiary">
            <span className="size-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
            NEXUS OS v3.0 · Online
          </span>
        </header>

        {/* Quick Capture Omnibar */}
        <section aria-label="Quick capture" className="w-full">
          <CaptureBar />
        </section>

        {/* Key Metrics Grid */}
        <KpiGrid items={kpiItems} />

        {/* Two-Column Focus & Intelligence Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Briefing + Priority Queue (7 cols) */}
          <div className="space-y-6 lg:col-span-7">
            <BriefingPanel briefing={SHOWCASE_BRIEFING} />
            <PriorityQueuePanel items={SHOWCASE_PRIORITY_QUEUE} />
          </div>

          {/* Right Column: Active Projects Health + Upcoming Schedule (5 cols) */}
          <div className="space-y-6 lg:col-span-5">
            <ActiveProjectsPanel forecasts={SHOWCASE_ACTIVE_PROJECTS} />
            <UpcomingPanel items={SHOWCASE_UPCOMING_ITEMS} />
          </div>
        </div>

        {/* Live Activity Stream */}
        <section aria-label="Activity history" className="pt-2">
          <div className="rounded-panel border border-border-default bg-bg-surface p-5">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div>
                <p className="eyebrow text-text-quaternary">AUDIT LOG</p>
                <h2 className="text-[16px] font-semibold text-text-primary">Workspace activity</h2>
              </div>
              <span className="text-caption text-text-tertiary">Live stream</span>
            </div>
            <div className="pt-4">
              <ActivityList activities={SHOWCASE_ACTIVITIES} />
            </div>
          </div>
        </section>
      </div>
    </ShowcaseShell>
  );
}
