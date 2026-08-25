// ============================================================
// NEXUS INTELLIGENCE — DATA & ACTION TYPES
// Structured contract shared across UI, API, Context Builder,
// AI Provider, and Deterministic Engine.
// ============================================================

export type IntelligenceIntent =
  | "analysis"
  | "prioritization"
  | "planning"
  | "synthesis"
  | "detection"
  | "action"
  | "general";

export type IntelligenceActionType =
  | "create_task"
  | "create_project"
  | "open_project"
  | "open_task"
  | "view_blocked_tasks"
  | "view_overdue_tasks"
  | "view_risky_projects"
  | "navigate";

export interface IntelligenceAction {
  id: string;
  type: IntelligenceActionType;
  label: string;
  description?: string;
  confirmationRequired: boolean;
  payload?: {
    title?: string;
    name?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    status?: string;
    dueDate?: string | null;
    projectId?: string | null;
    description?: string;
    url?: string;
  };
}

export interface IntelligenceItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: {
    label: string;
    tone: "danger" | "warning" | "success" | "neutral" | "lavender";
  };
  href?: string;
  reasons?: string[];
}

export interface StructuredIntelligenceResponse {
  query: string;
  intent: IntelligenceIntent;
  headline: string;
  narrative: string;
  provider: "openai" | "anthropic" | "nexus-engine";
  evidence: {
    metrics: { label: string; value: string }[];
    traceCount: string;
    sources: string[];
  };
  items?: IntelligenceItem[];
  action?: IntelligenceAction;
  suggestions: string[];
}

export interface ActivityContextItem {
  id: string;
  entityType: string;
  action: string;
  title: string;
  actorName: string | null;
  createdAt: string;
}

export interface TaskDependencyContextItem {
  taskId: string;
  taskTitle: string;
  dependsOnTaskId: string;
  dependsOnTitle: string;
}
