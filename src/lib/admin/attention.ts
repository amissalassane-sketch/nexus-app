// ============================================================
// NEXUS ADMIN — ATTENTION ACTIONS
// ============================================================
// The SQL layer (admin_overview) reports *conditions*; this module
// maps each known condition to the recommended operator action:
// what to do, where, and why. Keeping this in code (not SQL) means
// the links can point at real routes and evolve without a migration.
// ============================================================

import type { AdminAttentionAction } from "./types";

const ATTENTION_ACTIONS: Record<string, AdminAttentionAction> = {
  workspaces_without_owner: {
    label: "Inspect workspaces",
    href: "/admin/workspaces",
    rationale:
      "A workspace without an active owner cannot be opened by anyone. Inspect the list to find the failed bootstrap.",
  },
  users_without_profile: {
    label: "Inspect accounts",
    href: "/admin/users",
    rationale:
      "The signup trigger did not create a profile row. The app self-repairs on the user's next load; inspect to confirm.",
  },
  subscriptions_past_due: {
    label: "Inspect subscriptions",
    href: "/admin/subscriptions",
    rationale:
      "Billing could not collect. No provider is connected yet, so a non-empty list here is unexpected and worth a look.",
  },
  activity_not_instrumented: {
    label: "Inspect instrumentation",
    href: "/admin/activity",
    rationale:
      "public.activities is filled by the migration 015 triggers on task/project/goal changes — an empty stream means no workspace has changed anything yet.",
  },
  ai_provider_not_configured: {
    label: "Read the setup guide",
    href: "/admin/security",
    rationale:
      "Intelligence falls back to the deterministic engine until a model provider key is set. Configuration is a deployment decision.",
  },
};

export function attentionActionFor(
  itemId: string
): AdminAttentionAction | null {
  return ATTENTION_ACTIONS[itemId] ?? null;
}
