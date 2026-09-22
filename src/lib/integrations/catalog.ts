// ============================================================
// NEXUS INTEGRATIONS — CATALOG (derived)
// ============================================================
// Kept as the client-safe summary of the provider registry: the
// landing page and old call sites consume this shape. Connection
// state is NOT part of this file — it lives in the database and is
// resolved by buildProviderStatusViews (server) / /api/integrations.
// ============================================================

import {
  PROVIDERS,
  type ProviderId,
} from "./providers";

export type IntegrationCategory =
  | "calendar"
  | "development"
  | "communication"
  | "documents"
  | "files"
  | "automation";

export type IntegrationDefinition = {
  id: ProviderId | "webhooks";
  name: string;
  category: IntegrationCategory;
  categoryLabel: string;
  description: string;
  capabilities: string[];
  phase: 1 | 2 | 0;
};

const WEBHOOKS: IntegrationDefinition = {
  id: "webhooks",
  name: "NEXUS Webhooks",
  category: "automation",
  categoryLabel: "Automation",
  description:
    "A secure event boundary for systems that need to work with NEXUS. Designed, not yet available.",
  capabilities: ["Event delivery", "Automation triggers"],
  phase: 0,
};

export const INTEGRATION_CATALOG: IntegrationDefinition[] = [
  ...PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    category: provider.category as IntegrationCategory,
    categoryLabel: provider.categoryLabel,
    description: provider.description,
    capabilities: provider.capabilities
      .filter((capability) => capability.adapter === "implemented")
      .map((capability) => capability.label),
    phase: provider.phase,
  })),
  WEBHOOKS,
];

export const INTEGRATION_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "calendar", label: "Calendar" },
  { id: "communication", label: "Communication" },
  { id: "documents", label: "Documents" },
  { id: "development", label: "Development" },
  { id: "files", label: "Files" },
] as const;
