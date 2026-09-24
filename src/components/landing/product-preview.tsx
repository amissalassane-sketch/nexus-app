"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconActivity,
  IconArrowRight,
  IconBell,
  IconCalendar,
  IconChecklist,
  IconGitBranch,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconMail,
  IconNotes,
  IconRadar,
  IconShieldCheck,
  IconTarget,
  type TablerIcon,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";

// ============================================================
// NEXUS LANDING — PRODUCT DEMONSTRATION (17-DAY CATCH-UP)
//
// The central proof beat of the landing page:
// Sarah returns after 17 days away. Rather than forcing her to
// dig through 41 notifications across 5 different apps, NEXUS
// connects her Gmail, Calendar, Project tracker, and Docs to
// reconstruct the operating context:
//
//   1. What changed while she was away (3 deadlines shifted,
//      2 client requests, 1 blocked project, 4 key emails, 1 sync)
//   2. What deserves her immediate attention today
//   3. The EVIDENCE CARD: Why it matters, the impact, confidence,
//      and explicit cross-tool source citations.
//
// Honest product demonstration using NEXUS semantic surface tokens.
// ============================================================

const NAV_PRIMARY = [
  { icon: IconLayoutDashboard, label: "Overview", count: null },
  { icon: IconRadar, label: "Intelligence", count: 3 },
];

const NAV_WORK = [
  { icon: IconLayoutKanban, label: "Projects", count: 4 },
  { icon: IconChecklist, label: "Tasks", count: 18 },
  { icon: IconTarget, label: "Goals", count: 2 },
];

const NAV_WORKSPACE = [
  { icon: IconActivity, label: "Activity", count: 41 },
  { icon: IconBell, label: "Notifications", count: 1 },
];

type EvidenceItem = {
  id: string;
  badge: string;
  tone: "danger" | "warning" | "neutral";
  title: string;
  subtitle: string;
  reason: string;
  whySteps: string[];
  what: string;
  whyNow: string;
  impact: string;
  sources: { tool: string; label: string; time: string; icon: TablerIcon }[];
  confidence: { level: "Confirmed" | "Likely" | "Uncertain"; sourcesCount: number };
  primaryAction: string;
  secondaryAction: string;
};

const EVIDENCE_ITEMS: EvidenceItem[] = [
  {
    id: "reply-marc",
    badge: "High Priority · Blocked Project",
    tone: "danger",
    title: "Reply to Marc — Design Validation",
    subtitle: "His validation is blocking Prototype V2",
    reason: "Because Marc's request blocks Project X, whose deadline is Friday.",
    whySteps: [
      "Client requested validation yesterday at 16:42",
      "Prototype V2 deadline is Friday (in 3 days)",
      "This blocks 3 downstream tasks in Linear and GitHub",
    ],
    what: "Send revised figma specs and confirmation for token migration.",
    whyNow: "Received yesterday; delaying past today forces sprint slip.",
    impact: "Unblocks Prototype V2 and 3 engineering implementation tasks.",
    sources: [
      { tool: "Gmail", label: "Re: Prototype V2 token sign-off", time: "Yesterday 16:42", icon: IconMail },
      { tool: "Project X", label: "Prototype V2 · Sprint Milestone", time: "Due Friday", icon: IconLayoutKanban },
      { tool: "Calendar", label: "Sprint Review & Demo", time: "Friday 14:00", icon: IconCalendar },
    ],
    confidence: { level: "Confirmed", sourcesCount: 3 },
    primaryAction: "Draft reply in Gmail",
    secondaryAction: "Inspect Project X context",
  },
  {
    id: "review-project-x",
    badge: "Risk Detected · Stalled Dependency",
    tone: "warning",
    title: "Review Project X Technical Blockers",
    subtitle: "API authentication migration stalled for 4 days",
    reason: "GitHub PR #142 waiting on database schema approval before Friday.",
    whySteps: [
      "No commit activity on branch auth-v2 for 96 hours",
      "Two open review comments from David remain unresolved",
      "Prototype V2 demo depends directly on this branch",
    ],
    what: "Unblock schema migration review or reassign database sign-off.",
    whyNow: "4 days without activity while the target milestone is Friday.",
    impact: "Prevents auth token invalidation during client demonstration.",
    sources: [
      { tool: "GitHub", label: "PR #142: auth-session-v2", time: "4 days ago", icon: IconGitBranch },
      { tool: "Slack", label: "#eng-core: review requested", time: "3 days ago", icon: IconNotes },
      { tool: "Linear", label: "TASK-89: DB migration", time: "High priority", icon: IconChecklist },
    ],
    confidence: { level: "Confirmed", sourcesCount: 3 },
    primaryAction: "Open PR #142 in GitHub",
    secondaryAction: "Reassign reviewer",
  },
  {
    id: "client-sync",
    badge: "Action Required · Tomorrow",
    tone: "neutral",
    title: "Prepare Acme Leadership Sync",
    subtitle: "Quarterly review tomorrow at 10:00 AM",
    reason: "2 action items from last week's Notion meeting notes require status updates.",
    whySteps: [
      "Meeting on Google Calendar tomorrow at 10:00 AM (4 attendees)",
      "Last week's Notion sync notes have 2 open unchecked deliverables",
      "Acme VP requested quarterly telemetry numbers in email",
    ],
    what: "Compile quarterly deliverables update before tomorrow's call.",
    whyNow: "Client executive call in 20 hours; data not yet assembled.",
    impact: "Ensures client renewal alignment and prevents meeting derailment.",
    sources: [
      { tool: "Calendar", label: "Acme Leadership Sync", time: "Tomorrow 10:00", icon: IconCalendar },
      { tool: "Notion", label: "Acme Client Notes & Actions", time: "Updated 5 days ago", icon: IconNotes },
      { tool: "Gmail", label: "Telemetry request from VP", time: "2 days ago", icon: IconMail },
    ],
    confidence: { level: "Likely", sourcesCount: 3 },
    primaryAction: "Open briefing notes",
    secondaryAction: "View calendar invite",
  },
];

const CONNECTED_TOOLS = [
  { name: "Gmail", status: "Synced 2m ago", healthy: true },
  { name: "Google Calendar", status: "Synced 4m ago", healthy: true },
  { name: "GitHub", status: "Synced 1m ago", healthy: true },
  { name: "Notion", status: "Synced 12m ago", healthy: true },
  { name: "Linear", status: "Synced 3m ago", healthy: true },
];

export function ProductPreview() {
  const [selectedId, setSelectedId] = useState<string>("reply-marc");
  const [activeNav, setActiveNav] = useState<string>("Intelligence");

  const currentItem =
    EVIDENCE_ITEMS.find((item) => item.id === selectedId) || EVIDENCE_ITEMS[0];

  return (
    <div className="relative rounded-card border border-border-default bg-bg-surface shadow-overlay">
      {/* Chrome Window Title Bar */}
      <div className="flex h-11 items-center justify-between border-b border-border-subtle bg-bg-subtle px-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" aria-hidden="true" />
          <span className="ml-2 font-mono text-[11px] text-text-tertiary">
            nexus · context layer · 17-day catch-up briefing
          </span>
        </div>
        <div className="hidden items-center gap-2 font-mono text-[10.5px] text-text-secondary sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success signal-pulse" aria-hidden="true" />
          <span>5 tools connected · Continuous context</span>
        </div>
      </div>

      {/* Main App Workspace Layout */}
      <div className="grid grid-cols-1 bg-bg-base lg:grid-cols-[210px_minmax(0,1fr)]">
        {/* Mock Navigation Sidebar */}
        <aside
          aria-label="Workspace navigation"
          className="hidden flex-col border-r border-border-subtle bg-bg-subtle p-3 lg:flex"
        >
          {/* Workspace Switcher */}
          <div className="flex h-10 items-center gap-2.5 rounded-nav border border-border-subtle bg-bg-surface px-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-xs border border-border-default bg-bg-surface-2 font-mono text-[10.5px] font-semibold text-text-primary">
              N
            </span>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-medium text-text-primary">
                Acme Studio
              </span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
                Context Layer
              </span>
            </div>
          </div>

          <div className="mt-3">
            <NavList items={NAV_PRIMARY} active={activeNav} onSelect={setActiveNav} />
            <p className="px-2 pb-1 pt-3 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary">
              Work
            </p>
            <NavList items={NAV_WORK} active={activeNav} onSelect={setActiveNav} />
            <p className="px-2 pb-1 pt-3 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary">
              Workspace
            </p>
            <NavList items={NAV_WORKSPACE} active={activeNav} onSelect={setActiveNav} />
          </div>

          {/* Connected Tools Status in Sidebar */}
          <div className="mt-auto border-t border-border-subtle pt-3">
            <p className="px-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary">
              Live Sources
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {CONNECTED_TOOLS.slice(0, 4).map((tool) => (
                <li
                  key={tool.name}
                  className="flex items-center justify-between px-1 text-[10.5px] text-text-secondary"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-success" aria-hidden="true" />
                    <span>{tool.name}</span>
                  </span>
                  <span className="font-mono text-[9.5px] text-text-quaternary">
                    {tool.status.replace("Synced ", "")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Primary Content Area: The Demonstration */}
        <div className="min-w-0 p-4 sm:p-6 lg:p-7">
          {/* Scenario Banner */}
          <div className="rounded-card border border-border-default bg-bg-surface p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="nexus-eyebrow-pill">
                    <span className="h-1.5 w-1.5 rounded-full bg-lavender" aria-hidden="true" />
                    Scenario Demonstration
                  </span>
                  <span className="font-mono text-[11px] text-text-tertiary">
                    Sarah returns after 17 days
                  </span>
                </div>
                <h3 className="mt-2 text-[17px] font-semibold text-text-primary sm:text-[19px]">
                  &ldquo;I haven&apos;t opened my tools in 17 days.&rdquo;
                </h3>
                <p className="mt-1 text-small text-text-secondary">
                  NEXUS connected Gmail, Calendar, Linear and GitHub to surface what drifted while
                  Sarah was away—and recommends what to tackle first.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 rounded-nav border border-border-subtle bg-bg-subtle px-3 py-2 text-right">
                <span className="font-mono text-xl font-semibold text-text-primary">41</span>
                <span className="text-[11px] leading-tight text-text-tertiary">
                  events<br />synthesized
                </span>
              </div>
            </div>

            {/* Detected Delta Metrics Row */}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-subtle pt-4 sm:grid-cols-5">
              <div className="rounded-row border border-border-subtle bg-bg-subtle p-2 text-center">
                <span className="block font-mono text-[18px] font-semibold text-text-primary">3</span>
                <span className="block text-[10.5px] text-text-secondary">Deadlines changed</span>
              </div>
              <div className="rounded-row border border-border-subtle bg-bg-subtle p-2 text-center">
                <span className="block font-mono text-[18px] font-semibold text-text-primary">2</span>
                <span className="block text-[10.5px] text-text-secondary">Client requests</span>
              </div>
              <div className="rounded-row border border-border-subtle bg-bg-subtle p-2 text-center">
                <span className="block font-mono text-[18px] font-semibold text-danger">1</span>
                <span className="block text-[10.5px] text-text-secondary">Blocked project</span>
              </div>
              <div className="rounded-row border border-border-subtle bg-bg-subtle p-2 text-center">
                <span className="block font-mono text-[18px] font-semibold text-text-primary">4</span>
                <span className="block text-[10.5px] text-text-secondary">Actionable emails</span>
              </div>
              <div className="col-span-2 rounded-row border border-border-subtle bg-bg-subtle p-2 text-center sm:col-span-1">
                <span className="block font-mono text-[18px] font-semibold text-text-primary">1</span>
                <span className="block text-[10.5px] text-text-secondary">Sync tomorrow</span>
              </div>
            </div>
          </div>

          {/* Interactive Recommendation + Evidence Card Split */}
          <div className="mt-5 grid items-start gap-4 lg:grid-cols-[1.05fr_1.45fr]">
            {/* Left: Recommended Focus Today */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-tertiary">
                  Recommended Focus Today (3 decisions)
                </p>
                <span className="font-mono text-[10.5px] text-text-quaternary">
                  Select to inspect
                </span>
              </div>

              {EVIDENCE_ITEMS.map((item, idx) => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "flex flex-col rounded-card border p-3.5 text-left transition-colors duration-150 ease-nexus",
                      active
                        ? "border-border-strong bg-bg-surface-2 shadow-sm"
                        : "border-border-subtle bg-bg-surface hover:border-border-default hover:bg-bg-subtle"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                        <span>0{idx + 1}</span>
                        <span>·</span>
                        <span className={item.tone === "danger" ? "text-danger" : "text-text-secondary"}>
                          {item.badge}
                        </span>
                      </span>
                      <Badge tone={item.tone}>{item.confidence.level}</Badge>
                    </div>

                    <p className="mt-1.5 text-[13.5px] font-semibold text-text-primary">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-small text-text-secondary">
                      {item.subtitle}
                    </p>

                    <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[10px] text-text-quaternary">
                      <span>Sources:</span>
                      {item.sources.map((s, sIdx) => (
                        <span key={s.tool} className="flex items-center gap-1">
                          <NexusIcon icon={s.icon} px={11} className="text-text-tertiary" />
                          <span>{s.tool}</span>
                          {sIdx < item.sources.length - 1 ? <span>·</span> : null}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: THE EVIDENCE CARD (Audit Component #46) */}
            <div className="rounded-card border border-border-strong bg-bg-surface-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-border-default">
                    <NexusIcon icon={IconShieldCheck} px={12} className="text-lavender" />
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-secondary">
                    Evidence Card
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-pill border border-border-default bg-bg-surface px-2 py-0.5 font-mono text-[10.5px] text-text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                  <span>{currentItem.confidence.level} · {currentItem.confidence.sourcesCount} sources verified</span>
                </div>
              </div>

              {/* Title & Core Reason */}
              <div className="mt-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-danger">
                  {currentItem.badge}
                </span>
                <h4 className="mt-1 text-[16px] font-semibold text-text-primary sm:text-[18px]">
                  {currentItem.title}
                </h4>
                <p className="mt-1 text-small text-text-secondary">
                  {currentItem.reason}
                </p>
              </div>

              {/* WHY THIS MATTERS: Visual Reasoning Chain */}
              <div className="mt-4 rounded-row border border-border-subtle bg-bg-subtle p-3.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                  Why this matters now
                </p>
                <ol className="mt-2.5 flex flex-col gap-2">
                  {currentItem.whySteps.map((step, sIdx) => (
                    <li key={step} className="flex items-start gap-2.5 text-small text-text-secondary">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-surface font-mono text-[9px] text-text-tertiary">
                        {sIdx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Explicit What / Why / Impact Grid */}
              <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-row border border-border-subtle bg-bg-subtle/70 p-2.5">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-tertiary">
                    Action required
                  </p>
                  <p className="mt-1 text-[12.5px] text-text-primary">
                    {currentItem.what}
                  </p>
                </div>
                <div className="rounded-row border border-border-subtle bg-bg-subtle/70 p-2.5">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-tertiary">
                    Downstream impact
                  </p>
                  <p className="mt-1 text-[12.5px] text-text-primary">
                    {currentItem.impact}
                  </p>
                </div>
              </div>

              {/* Explicit Cross-Tool Sources */}
              <div className="mt-3.5 border-t border-border-subtle pt-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                  Verified Cross-Tool Sources
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {currentItem.sources.map((source) => (
                    <div
                      key={source.label}
                      className="flex items-center justify-between rounded-row border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-[11.5px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-xs border border-border-subtle bg-bg-subtle">
                          <NexusIcon icon={source.icon} px={11} className="text-text-primary" />
                        </span>
                        <span className="font-medium text-text-primary">{source.tool}:</span>
                        <span className="text-text-secondary">{source.label}</span>
                      </div>
                      <span className="font-mono text-[10px] text-text-quaternary">
                        {source.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3.5">
                <Link
                  href="/signup"
                  className="inline-flex h-8 items-center gap-1.5 rounded-input bg-accent px-3 text-[12px] font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover"
                >
                  <span>{currentItem.primaryAction}</span>
                  <NexusIcon icon={IconArrowRight} px={12} />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-8 items-center rounded-input border border-border-default bg-bg-surface px-3 text-[12px] font-medium text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:text-text-primary"
                >
                  {currentItem.secondaryAction}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavList({
  items,
  active,
  onSelect,
}: {
  items: { icon: TablerIcon; label: string; count: number | null }[];
  active: string;
  onSelect: (label: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => {
        const isCurrent = active === item.label;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect(item.label)}
            className={cn(
              "flex h-7 items-center justify-between rounded-nav border px-2 text-left text-[11px] transition-colors duration-150 ease-nexus",
              isCurrent
                ? "border-border-default bg-bg-surface-2 font-medium text-text-primary"
                : "border-transparent text-text-secondary hover:bg-bg-surface hover:text-text-primary"
            )}
          >
            <span className="flex items-center gap-2">
              <NexusIcon icon={item.icon} px={12} />
              <span>{item.label}</span>
            </span>
            {item.count !== null ? (
              <span className="font-mono text-[9.5px] tabular-nums text-text-quaternary">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
