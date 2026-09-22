// ============================================================
// NEXUS INTEGRATIONS — STATUS VIEW (server-side)
// ============================================================
// Resolves the honest per-provider state for the Integrations page:
// DB connection row (if any) + server OAuth configuration. This is
// the only shape the UI renders; it contains no secrets.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROVIDERS,
  getProviderConfiguration,
  type IntegrationCapability,
  type ProviderId,
} from "./providers";
import {
  readConnections,
  toConnectionView,
  type ConnectionView,
} from "./connections";
import { isCredentialStorageConfigured } from "./crypto";

export type ProviderStatusView = {
  id: ProviderId;
  name: string;
  categoryLabel: string;
  description: string;
  phase: 1 | 2;
  /** True when the OAuth client env vars exist on the server. */
  oauthConfigured: boolean;
  connectionAvailable: boolean;
  missingEnvVars: string[];
  /** Scopes NEXUS will request — shown BEFORE connecting. */
  scopes: string[];
  scopeNotes: Record<string, string>;
  capabilities: IntegrationCapability[];
  value: {
    context: string;
    actions: string;
    signals: string;
  };
  connection: ConnectionView;
};

export type IntegrationsSnapshot = {
  encryptionConfigured: boolean;
  providers: ProviderStatusView[];
};

export async function buildIntegrationsSnapshot(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<IntegrationsSnapshot> {
  const connections = await readConnections(supabase, workspaceId);
  const byProvider = new Map(connections.map((row) => [row.provider_id, row]));

  return {
    encryptionConfigured: isCredentialStorageConfigured(),
    providers: PROVIDERS.map((provider) => {
      const configuration = getProviderConfiguration(provider);
      return {
        id: provider.id,
        name: provider.name,
        categoryLabel: provider.categoryLabel,
        description: provider.description,
        phase: provider.phase,
        oauthConfigured: configuration.configured,
        connectionAvailable: configuration.configured && isCredentialStorageConfigured(),
        missingEnvVars: configuration.configured ? [] : configuration.missing,
        scopes: provider.oauth.scopes,
        scopeNotes: provider.oauth.scopeNotes,
        capabilities: provider.capabilities,
        value: provider.value,
        connection: toConnectionView(byProvider.get(provider.id), provider.id),
      };
    }),
  };
}
