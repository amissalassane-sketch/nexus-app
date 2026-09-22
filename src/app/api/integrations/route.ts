// ============================================================
// NEXUS — INTEGRATIONS STATUS API
// GET /api/integrations
// ============================================================
// The honest state of every provider for the active workspace:
//   * lifecycle state from the database (never assumed),
//   * whether the OAuth client is configured on the server,
//   * the capability model with adapter status.
// No secrets are returned — tokens never leave the server.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  PROVIDERS,
  getProviderConfiguration,
} from "@/lib/integrations/providers";
import { readConnections, toConnectionView } from "@/lib/integrations/connections";
import { isCredentialStorageConfigured } from "@/lib/integrations/crypto";

export async function GET() {
  try {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured in this environment" },
      { status: 503 }
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { membership, error: membershipError } = await getActiveMembership(
    supabase,
    user.id
  );
  if (membershipError) {
    return NextResponse.json({ error: membershipError }, { status: 500 });
  }
  const workspaceId = membership?.workspaceId;
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No active workspace associated with user" },
      { status: 400 }
    );
  }

  const connections = await readConnections(supabase, workspaceId);
  const byProvider = new Map(connections.map((row) => [row.provider_id, row]));

  return NextResponse.json({
    workspaceId,
    encryptionConfigured: isCredentialStorageConfigured(),
    providers: PROVIDERS.map((provider) => {
      const configuration = getProviderConfiguration(provider);
      const view = toConnectionView(byProvider.get(provider.id), provider.id);
      return {
        id: provider.id,
        name: provider.name,
        category: provider.category,
        categoryLabel: provider.categoryLabel,
        description: provider.description,
        phase: provider.phase,
        oauthConfigured: configuration.configured,
        missingEnvVars: configuration.configured ? [] : configuration.missing,
        scopes: provider.oauth.scopes,
        scopeNotes: provider.oauth.scopeNotes,
        capabilities: provider.capabilities,
        value: provider.value,
        connection: view,
      };
    }),
  });
  } catch {
    return NextResponse.json({ code: "INTEGRATION_STATE_UNAVAILABLE", error: "Connection status could not be read. Check the database and integration migrations, then retry." }, { status: 503 });
  }
}
