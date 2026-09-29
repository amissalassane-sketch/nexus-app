import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowRight,
  IconBolt,
  IconChecklist,
  IconCommand,
  IconLayoutDashboard,
  IconRadar,
  IconSparkles,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { Badge } from "@/components/ui/badge";
import { ShowcaseShell } from "@/components/showcase/showcase-shell";

export const metadata: Metadata = {
  title: "NEXUS Motion Design Showcase — Visual Presentation Suite",
  description: "Dedicated high-resolution presentation screens for NEXUS Motion Design in Figma & Butter.",
};

const SHOWCASE_CARDS = [
  {
    href: "/showcase/dashboard",
    num: "01",
    title: "Overview Dashboard",
    subtitle: "Complete Priority Workspace",
    description:
      "The full operating system overview: session greeting, universal capture omnibar, 4 key KPI metric cards, AI weekly briefing, ranked priority queue, project velocity health table, upcoming deadlines and chronological activity ledger.",
    icon: IconLayoutDashboard,
    badge: "Core OS",
    tone: "neutral" as const,
    highlights: ["24 Active Tasks", "4 KPI Cards", "Priority Queue (Score 98)", "Active Projects (6)"],
  },
  {
    href: "/showcase/command",
    num: "02",
    title: "Command Center (⌘K)",
    subtitle: "Keyboard Interface & Omnibar",
    description:
      "The central command palette overlaid on a live workspace. Features token-highlighted search query 'deploy', grouped results across Entities, Actions, Navigation and Recent history with keyboard navigation hints.",
    icon: IconCommand,
    badge: "⌘K Palette",
    tone: "neutral" as const,
    highlights: ["Grouped Categories", "Token Highlighting", "Keyboard Shortcuts", "Overlay Blur"],
  },
  {
    href: "/showcase/intelligence",
    num: "03",
    title: "AI Intelligence Core",
    subtitle: "Proactive Signals & Autonomous Missions",
    description:
      "The reasoning console: Next Best Action hero card (+24% velocity recovery), categorized Proactive Signals (Risk, Blocker, Opportunity), running multi-step autonomous mission and contextual grounded Ask AI console.",
    icon: IconRadar,
    badge: "Intelligence",
    tone: "lavender" as const,
    highlights: ["Next Best Action", "Proactive Signals (3)", "Live Mission (50%)", "Grounded Ask AI"],
  },
  {
    href: "/showcase/tasks",
    num: "04",
    title: "Tasks Kanban Board",
    subtitle: "4-Column Execution Workflow",
    description:
      "The 4-column canonical Kanban board (To Do, In Progress, Blocked, Done) populated with realistic tasks, priority badges (P0, P1, P2, P3), project pills, due dates, dependency blockers and view tabs.",
    icon: IconChecklist,
    badge: "Execution",
    tone: "neutral" as const,
    highlights: ["4 Columns", "P0–P3 Priority Badges", "Project Pills", "Blocked Reason Callouts"],
  },
  {
    href: "/showcase/capture",
    num: "05",
    title: "Universal Capture & NLP",
    subtitle: "Natural Language Intent Extraction",
    description:
      "The step-by-step universal capture workflow: from raw sentence 'Deploy staging tomorrow at 3pm #infra' to structured extraction (Task, Due Date, Project Tag, Priority) and real-time confirmation sync.",
    icon: IconBolt,
    badge: "NLP Engine",
    tone: "lavender" as const,
    highlights: ["5-Step Motion Lifecycle", "Task Extraction", "Date/Time Parsing", "Sync Feedback"],
  },
];

export default function ShowcaseIndexPage() {
  return (
    <ShowcaseShell activeTab="dashboard">
      <div className="mx-auto max-w-5xl space-y-6 py-2">
        {/* Hub header */}
        <header>
          <Badge
            tone="lavender"
            icon={<NexusIcon icon={IconSparkles} className="size-3" />}
            className="mb-3"
          >
            Showcase · v3
          </Badge>
          <h1 className="text-display text-text-primary">
            Product presentation suite
          </h1>
          <p className="mt-2 max-w-[72ch] text-small text-text-secondary">
            Five deterministic presentation states assembled from the real
            NEXUS shell, components and tokens — the visual reference
            environment for design review and motion capture. Mock data only:
            nothing here reads or writes a workspace.
          </p>
          <div className="mono-meta mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-subtle pt-3 text-text-quaternary">
            <span>shell · 248px sidebar / 56px topbar</span>
            <span>layers · root / chrome / switcher</span>
            <span>states · 5</span>
          </div>
        </header>

        {/* 5 Screen Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SHOWCASE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group relative flex flex-col justify-between rounded-panel border border-border-default bg-bg-surface p-5 transition-all duration-200 hover:border-border-strong hover:bg-bg-surface-2 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
              >
                <div className="space-y-3">
                  {/* Top Bar inside card */}
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-[8px] border border-border-subtle bg-bg-surface-2 text-text-primary group-hover:bg-white group-hover:text-black transition-colors">
                      <NexusIcon icon={Icon} className="size-4" />
                    </span>
                    <Badge tone={card.tone}>{card.badge}</Badge>
                  </div>

                  <div>
                    <span className="font-mono text-[11px] text-text-quaternary">
                      SCREEN {card.num}
                    </span>
                    <h2 className="text-[17px] font-semibold text-text-primary group-hover:text-white mt-0.5">
                      {card.title}
                    </h2>
                    <p className="text-[12px] font-mono text-lavender mt-0.5">
                      {card.subtitle}
                    </p>
                  </div>

                  <p className="text-caption text-text-secondary leading-relaxed line-clamp-3">
                    {card.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-[12px] font-medium text-text-secondary group-hover:text-text-primary">
                    Open screen
                  </span>
                  <NexusIcon
                    icon={IconArrowRight}
                    className="size-3.5 text-text-tertiary group-hover:text-text-primary group-hover:translate-x-1 transition-all"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </ShowcaseShell>
  );
}
