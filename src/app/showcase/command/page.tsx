import type { Metadata } from "next";
import { ShowcaseShell } from "@/components/showcase/showcase-shell";
import { CommandShowcaseView } from "@/components/showcase/command-showcase-view";
import { KpiGrid, type KpiItem } from "@/components/dashboard/kpi-grid";
import { BriefingPanel } from "@/components/dashboard/briefing-panel";
import { PriorityQueuePanel } from "@/components/dashboard/priority-queue";
import { ActiveProjectsPanel } from "@/components/dashboard/active-projects";
import { UpcomingPanel } from "@/components/dashboard/upcoming-panel";
import {
  IconBan,
  IconChecklist,
  IconLayoutKanban,
  IconTarget,
} from "@tabler/icons-react";
import {
  SHOWCASE_USER,
  SHOWCASE_BRIEFING,
  SHOWCASE_PRIORITY_QUEUE,
  SHOWCASE_ACTIVE_PROJECTS,
  SHOWCASE_UPCOMING_ITEMS,
} from "@/lib/showcase/mock-data";

export const metadata: Metadata = {
  title: "Command Center Showcase — NEXUS Motion Design Asset",
  description: "Motion-design visual asset for NEXUS Command Center ⌘K palette.",
};

export default function ShowcaseCommandPage() {
  const kpiItems: KpiItem[] = [
    { label: "Active tasks", value: 24, icon: IconChecklist, href: "#" },
    { label: "Blocked / At risk", value: 3, icon: IconBan, href: "#", tone: "danger" },
    { label: "Active projects", value: 6, icon: IconLayoutKanban, href: "#", tone: "success" },
    { label: "Goals on track", value: 4, icon: IconTarget, href: "#", tone: "accent" },
  ];

  return (
    <ShowcaseShell activeTab="command">
      {/* Background Dashboard Context (Subtly darkened for focus) */}
      <div className="space-y-6 opacity-40 select-none pointer-events-none filter blur-[1px] transition-all">
        <header className="flex items-baseline justify-between">
          <h1 className="text-[22px] font-semibold text-text-primary">
            Good morning, {SHOWCASE_USER.name}
          </h1>
          <span className="text-caption text-text-tertiary font-mono">⌘K open</span>
        </header>

        <KpiGrid items={kpiItems} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <BriefingPanel briefing={SHOWCASE_BRIEFING} />
            <PriorityQueuePanel items={SHOWCASE_PRIORITY_QUEUE} />
          </div>
          <div className="space-y-6 lg:col-span-5">
            <ActiveProjectsPanel forecasts={SHOWCASE_ACTIVE_PROJECTS} />
            <UpcomingPanel items={SHOWCASE_UPCOMING_ITEMS} />
          </div>
        </div>
      </div>

      {/* Real Command Center Overlay */}
      <CommandShowcaseView />
    </ShowcaseShell>
  );
}
