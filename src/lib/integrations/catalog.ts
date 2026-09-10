export type IntegrationStatus = "coming-soon" | "not-configured";
export type IntegrationCategory = "calendar" | "development" | "communication" | "documents" | "automation";

export type IntegrationDefinition = {
  id: string;
  name: string;
  category: IntegrationCategory;
  categoryLabel: string;
  description: string;
  capabilities: string[];
  status: IntegrationStatus;
  available: boolean;
};

// This registry describes product direction, not fabricated connections. A
// provider becomes available only when its server-side OAuth/sync adapter is
// implemented and security-reviewed.
export const INTEGRATION_CATALOG: IntegrationDefinition[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    categoryLabel: "Calendar",
    description: "Bring meetings and deadlines into the context NEXUS already reads.",
    capabilities: ["Calendar context", "Upcoming events"],
    status: "coming-soon",
    available: false,
  },
  {
    id: "github",
    name: "GitHub",
    category: "development",
    categoryLabel: "Development",
    description: "Connect shipping activity to the projects and tasks behind it.",
    capabilities: ["Repository context", "Issues and pull requests"],
    status: "coming-soon",
    available: false,
  },
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    categoryLabel: "Communication",
    description: "Make decisions and project signals easier to find when support arrives.",
    capabilities: ["Message context", "Project signals"],
    status: "coming-soon",
    available: false,
  },
  {
    id: "notion",
    name: "Notion",
    category: "documents",
    categoryLabel: "Documents",
    description: "Bring written project context closer to the work it explains.",
    capabilities: ["Document context", "Linked project pages"],
    status: "coming-soon",
    available: false,
  },
  {
    id: "webhooks",
    name: "NEXUS Webhooks",
    category: "automation",
    categoryLabel: "Automation",
    description: "A future secure event boundary for systems that need to work with NEXUS.",
    capabilities: ["Event delivery", "Automation triggers"],
    status: "coming-soon",
    available: false,
  },
  {
    id: "linear",
    name: "Linear",
    category: "development",
    categoryLabel: "Development",
    description: "Issue and cycle context for teams that plan work in Linear.",
    capabilities: ["Issue context", "Cycle context"],
    status: "coming-soon",
    available: false,
  },
  {
    id: "jira",
    name: "Jira",
    category: "development",
    categoryLabel: "Development",
    description: "Issue and sprint context for teams operating in Jira.",
    capabilities: ["Issue context", "Sprint context"],
    status: "coming-soon",
    available: false,
  },
];

export const INTEGRATION_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "calendar", label: "Calendar" },
  { id: "development", label: "Development" },
  { id: "communication", label: "Communication" },
  { id: "documents", label: "Documents" },
  { id: "automation", label: "Automation" },
] as const;
