import {
  CalendarDays,
  FileText,
  GitBranch,
  MessagesSquare,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

// ============================================================
// NEXUS — INTEGRATIONS
// The catalogue of sources NEXUS can read once a provider is connected.
//
// No integration provider is wired to this deployment yet, so every
// entry is shown in its real state — "Not connected" — and the connect
// action is disabled with the reason stated. Nothing here simulates a
// live sync, and no fabricated record counts are displayed.
// ============================================================

export const metadata = {
  title: "Integrations — NEXUS",
  description:
    "Connect the tools your work already lives in so NEXUS can read them.",
};

type ConnectionState = "not-connected" | "connecting" | "connected" | "error" | "syncing";

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  state: ConnectionState;
};

type Category = {
  id: string;
  label: string;
  description: string;
  items: Integration[];
};

const CATEGORIES: Category[] = [
  {
    id: "project-management",
    label: "Project management",
    description: "Where the work items live.",
    items: [
      {
        id: "linear",
        name: "Linear",
        description: "Issues, cycles and project status.",
        icon: Workflow,
        state: "not-connected",
      },
      {
        id: "jira",
        name: "Jira",
        description: "Epics, sprints and issue transitions.",
        icon: Workflow,
        state: "not-connected",
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    description: "Where decisions get made.",
    items: [
      {
        id: "slack",
        name: "Slack",
        description: "Channel activity tied to projects and owners.",
        icon: MessagesSquare,
        state: "not-connected",
      },
    ],
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Where the deadlines actually are.",
    items: [
      {
        id: "google-calendar",
        name: "Google Calendar",
        description: "Milestones, reviews and launch dates.",
        icon: CalendarDays,
        state: "not-connected",
      },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    description: "Where the context is written down.",
    items: [
      {
        id: "notion",
        name: "Notion",
        description: "Specs and project pages linked to work items.",
        icon: FileText,
        state: "not-connected",
      },
    ],
  },
  {
    id: "development",
    label: "Development",
    description: "Where shipping is measured.",
    items: [
      {
        id: "github",
        name: "GitHub",
        description: "Pull requests and merge activity per project.",
        icon: GitBranch,
        state: "not-connected",
      },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    description: "Where NEXUS can act, not just observe.",
    items: [
      {
        id: "webhooks",
        name: "Webhooks",
        description: "Push detected signals into your own systems.",
        icon: Zap,
        state: "not-connected",
      },
    ],
  },
];

const STATE_LABEL: Record<ConnectionState, string> = {
  "not-connected": "Not connected",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
  syncing: "Syncing",
};

const STATE_TONE = {
  "not-connected": "quiet",
  connecting: "info",
  connected: "success",
  error: "danger",
  syncing: "info",
} as const;

export default async function IntegrationsPage() {
  await requireUser();

  const connectedCount = CATEGORIES.flatMap((category) => category.items).filter(
    (item) => item.state === "connected"
  ).length;

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Integrations"
        count={`${connectedCount} connected`}
        description="NEXUS reads the work where it already happens. Connect a source and its projects, deadlines and activity become part of what NEXUS understands."
      />

      <Alert tone="info" title="No integration provider is configured yet">
        This deployment has no OAuth provider connected, so nothing can be
        authorised from here. The catalogue below shows what NEXUS will read once
        a provider is configured — no connection is simulated.
      </Alert>

      <div className="grid gap-5">
        {CATEGORIES.map((category) => (
          <Panel
            key={category.id}
            title={category.label}
            description={category.description}
            bodyClassName="p-0"
          >
            <ul>
              {category.items.map((integration) => (
                <li
                  key={integration.id}
                  className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3.5 transition-colors duration-150 ease-nexus last:border-b-0 hover:bg-white/[0.02]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary"
                  >
                    <integration.icon size={16} strokeWidth={1.75} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-medium text-text-primary">
                      {integration.name}
                    </p>
                    <p className="truncate text-caption text-text-tertiary">
                      {integration.description}
                    </p>
                  </div>

                  <Badge tone={STATE_TONE[integration.state]}>
                    {STATE_LABEL[integration.state]}
                  </Badge>

                  <button
                    type="button"
                    disabled
                    title="No integration provider is configured for this deployment"
                    className="inline-flex h-8 shrink-0 cursor-not-allowed items-center rounded-input border border-border-subtle px-3 text-caption text-text-quaternary"
                  >
                    Connect
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel
        title="Until then"
        description="What NEXUS already reads without any integration"
      >
        <p className="max-w-[62ch] text-small text-text-secondary">
          Everything you create inside NEXUS — projects, tasks, goals and the
          workspace activity log — is already analysed. Signals on this workspace
          do not depend on any external tool.
        </p>
        <div className="mt-4">
          <ButtonLink href="/intelligence" variant="secondary">
            See what NEXUS detected
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
