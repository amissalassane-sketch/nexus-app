// ============================================================
// NEXUS INTEGRATIONS — CONNECTION SERVICE
// ============================================================
// Server-side lifecycle for provider connections:
//
//   connect  → OAuth authorize redirect (route layer)
//   callback → exchange code for tokens, seal them, persist state
//   read     → connection rows + resolved lifecycle state
//   disconnect → delete connection row (credentials cascade)
//
// Security properties (tested in supabase/tests/integrations-contract.test.mjs):
//   * Tokens are sealed with AES-256-GCM before insertion.
//   * No function in this file ever returns a plaintext token to a
//     caller that is not the adapter layer itself.
//   * Every DB write is scoped by RLS to the active workspace.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import {
  buildAuthorizeUrl,
  callbackPathFor,
  getProvider,
  type ProviderDefinition,
} from "./providers";
import { encryptSecret } from "./crypto";

export type ConnectionRow = {
  id: string;
  workspace_id: string;
  provider_id: string;
  state: "connecting" | "connected" | "syncing" | "stale" | "error" | "reauth_required";
  account_label: string | null;
  scopes: string[] | null;
  last_sync_at: string | null;
  last_error: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
};

/** A connection as the product sees it (no secrets, ever). */
export type ConnectionView = {
  providerId: string;
  connectionId: string | null;
  lifecycle: "disconnected" | ConnectionRow["state"];
  accountLabel: string | null;
  scopes: string[];
  lastSyncAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

const TOKEN_TIMEOUT_MS = 10_000;

// ------------------------------------------------------------
// Authorize
// ------------------------------------------------------------

export function beginConnect(options: {
  providerId: string;
  origin: string;
}): { url: string; state: string } | { error: "UNKNOWN_PROVIDER" | "NOT_CONFIGURED"; missing?: string[] } {
  const provider = getProvider(options.providerId);
  if (!provider) return { error: "UNKNOWN_PROVIDER" };

  const redirectUri = `${options.origin}${callbackPathFor(provider.id)}`;
  const state = randomBytes(24).toString("base64url");

  const result = buildAuthorizeUrl({ provider, redirectUri, state });
  if ("error" in result) {
    return { error: result.error, missing: result.missing };
  }

  return { url: result.url, state: result.state };
}

// ------------------------------------------------------------
// Token exchange
// ------------------------------------------------------------

export type TokenExchangeResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string | null;
      expiresAt: string | null;
      accountLabel: string | null;
    }
  | { ok: false; errorCode: string; message: string };

/** Exchange an OAuth authorization code for tokens. Provider-agnostic. */
export async function exchangeCodeForTokens(options: {
  provider: ProviderDefinition;
  code: string;
  redirectUri: string;
}): Promise<TokenExchangeResult> {
  const { provider } = options;
  const credentials = process.env[provider.oauth.clientIdEnv]?.trim();
  const clientSecret = process.env[provider.oauth.clientSecretEnv]?.trim();

  if (!credentials || !clientSecret) {
    return {
      ok: false,
      errorCode: "NOT_CONFIGURED",
      message: `${provider.oauth.clientIdEnv} / ${provider.oauth.clientSecretEnv} are not set on the server.`,
    };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    redirect_uri: options.redirectUri,
    client_id: credentials,
    client_secret: clientSecret,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);

  try {
    const response = await fetch(provider.oauth.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: provider.oauth.tokenAcceptHeader ?? "application/json",
      },
      body,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // GitHub returns urlencoded bodies when the accept header is lost.
      for (const [key, value] of new URLSearchParams(text)) {
        payload[key] = value;
      }
    }

    // Slack answers 200 with {"ok": false} on failure.
    if (provider.oauth.tokenErrorInBody && payload.ok === false) {
      return {
        ok: false,
        errorCode: "PROVIDER_REJECTED",
        message: String(payload.error ?? "slack rejected the exchange"),
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        errorCode: `PROVIDER_HTTP_${response.status}`,
        message: String(
          payload.error_description ?? payload.error ?? `HTTP ${response.status}`
        ),
      };
    }

    const tokenKey = provider.oauth.accessTokenPath ?? "access_token";
    const accessToken = payload[tokenKey];
    if (typeof accessToken !== "string" || !accessToken) {
      return {
        ok: false,
        errorCode: "NO_TOKEN_RETURNED",
        message: "The provider did not return an access token.",
      };
    }

    const refreshToken =
      typeof payload.refresh_token === "string" ? payload.refresh_token : null;
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : null;
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Best-effort account label per provider (display only).
    const accountLabel = describeAccount(provider.id, payload);

    return { ok: true, accessToken, refreshToken, expiresAt, accountLabel };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network failure";
    return { ok: false, errorCode: "EXCHANGE_FAILED", message };
  } finally {
    clearTimeout(timer);
  }
}

function describeAccount(
  providerId: string,
  payload: Record<string, unknown>
): string | null {
  if (providerId === "slack") {
    const team = payload.team as { name?: string } | undefined;
    const user = payload.user as { name?: string } | undefined;
    if (team?.name && user?.name) return `${user.name} @ ${team.name}`;
    if (team?.name) return team.name;
    return null;
  }
  if (providerId === "notion" && payload.workspace_name) {
    return String(payload.workspace_name);
  }
  if (providerId === "linear" && payload.user) {
    const user = payload.user as { name?: string; email?: string } | undefined;
    return user?.name ?? user?.email ?? null;
  }
  return null;
}

// ------------------------------------------------------------
// Persistence
// ------------------------------------------------------------

export type PersistResult =
  | { ok: true; connectionId: string }
  | { ok: false; errorCode: string; message: string };

/** Persist a completed handshake: connection row + sealed credentials. */
export async function persistConnection(options: {
  supabase: SupabaseClient;
  workspaceId: string;
  userId: string;
  provider: ProviderDefinition;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  accountLabel: string | null;
}): Promise<PersistResult> {
  const sealedAccess = encryptSecret(options.accessToken);
  const sealedRefresh = options.refreshToken
    ? encryptSecret(options.refreshToken)
    : null;

  if (!sealedAccess) {
    return {
      ok: false,
      errorCode: "ENCRYPTION_NOT_CONFIGURED",
      message:
        "NEXUS_INTEGRATION_ENCRYPTION_KEY is not set, so tokens cannot be stored safely. The connection was not saved.",
    };
  }

  // Upsert by (workspace_id, provider_id): connecting again replaces.
  const { data: connection, error: upsertError } = await options.supabase
    .from("integration_connections")
    .upsert(
      {
        workspace_id: options.workspaceId,
        provider_id: options.provider.id,
        state: "connected",
        account_label: options.accountLabel,
        scopes: options.provider.oauth.scopes,
        last_error: null,
        last_error_code: null,
        last_error_at: null,
        connected_by: options.userId,
      },
      { onConflict: "workspace_id,provider_id" }
    )
    .select("id")
    .single();

  if (upsertError || !connection) {
    return {
      ok: false,
      errorCode: "PERSIST_FAILED",
      message: upsertError?.message ?? "The connection row could not be written.",
    };
  }

  const { error: credentialsError } = await options.supabase
    .from("integration_credentials")
    .upsert(
      {
        connection_id: connection.id,
        workspace_id: options.workspaceId,
        encrypted_token: sealedAccess,
        encrypted_refresh_token: sealedRefresh,
        token_expires_at: options.expiresAt,
      },
      { onConflict: "connection_id" }
    );

  if (credentialsError) {
    // Do not leave a "connected" row without credentials — it would be
    // a lie the UI shows and the adapter cannot honor.
    await options.supabase
      .from("integration_connections")
      .update({
        state: "error",
        last_error: "Credentials could not be stored.",
        last_error_code: "CREDENTIALS_PERSIST_FAILED",
        last_error_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    return {
      ok: false,
      errorCode: "CREDENTIALS_PERSIST_FAILED",
      message: credentialsError.message,
    };
  }

  return { ok: true, connectionId: connection.id };
}

/** Delete the connection (credentials cascade via FK). */
export async function disconnectConnection(options: {
  supabase: SupabaseClient;
  workspaceId: string;
  providerId: string;
}): Promise<PersistResult> {
  const { error } = await options.supabase
    .from("integration_connections")
    .delete()
    .eq("workspace_id", options.workspaceId)
    .eq("provider_id", options.providerId);

  if (error) {
    return { ok: false, errorCode: "DISCONNECT_FAILED", message: error.message };
  }
  return { ok: true, connectionId: "" };
}

// ------------------------------------------------------------
// Reading connection state
// ------------------------------------------------------------

export async function readConnections(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<ConnectionRow[]> {
  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (error) return [];
  return (data ?? []) as ConnectionRow[];
}

/** Resolve the view the Integrations page renders (no secrets). */
export function toConnectionView(row: ConnectionRow | undefined, providerId: string): ConnectionView {
  if (!row) {
    return {
      providerId,
      connectionId: null,
      lifecycle: "disconnected",
      accountLabel: null,
      scopes: [],
      lastSyncAt: null,
      lastError: null,
      lastErrorAt: null,
    };
  }
  return {
    providerId: row.provider_id,
    connectionId: row.id,
    lifecycle: row.state,
    accountLabel: row.account_label,
    scopes: row.scopes ?? [],
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    lastErrorAt: row.last_error_at,
  };
}

/**
 * Open a stored credential for the adapter layer. Server-only: this
 * function is never imported by a client component and never returns
 * through an API response.
 */
export async function readCredential(
  supabase: SupabaseClient,
  connectionId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("integration_credentials")
    .select("encrypted_token")
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (!data) return null;
  // decryptSecret is imported lazily to keep the crypto boundary obvious.
  const { decryptSecret } = await import("./crypto");
  return decryptSecret(data.encrypted_token as string);
}

/** Record a sync run + update connection state. Server-only. */
export async function recordSyncRun(options: {
  supabase: SupabaseClient;
  workspaceId: string;
  connectionId: string;
  providerId: string;
  status: "success" | "partial" | "failed";
  itemsRead: number;
  itemsCreated: number;
  errorCode?: string;
  error?: string;
}): Promise<void> {
  const finishedAt = new Date().toISOString();

  await options.supabase.from("integration_sync_runs").insert({
    connection_id: options.connectionId,
    workspace_id: options.workspaceId,
    provider_id: options.providerId,
    status: options.status,
    items_read: options.itemsRead,
    items_created: options.itemsCreated,
    error_code: options.errorCode ?? null,
    error: options.error ?? null,
    finished_at: finishedAt,
  });

  const nextState =
    options.status === "success" ? "connected" : options.status === "partial" ? "stale" : "error";

  await options.supabase
    .from("integration_connections")
    .update({
      state: nextState,
      last_sync_at: finishedAt,
      ...(options.status === "failed"
        ? {
            last_error: options.error ?? "Sync failed",
            last_error_code: options.errorCode ?? "SYNC_FAILED",
            last_error_at: finishedAt,
          }
        : {}),
    })
    .eq("id", options.connectionId);
}

// ------------------------------------------------------------
// OAuth state cookie (shared by connect + callback routes)
// ------------------------------------------------------------

/** Cookie name for the OAuth CSRF state. Exported from the lib (not a
 *  route) so the connect and callback routes share exactly one value. */
export const OAUTH_STATE_COOKIE = "nexus_oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;
