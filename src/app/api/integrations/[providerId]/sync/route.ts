import { randomUUID } from "node:crypto";
// ============================================================
// NEXUS — INTEGRATION SYNC
// POST /api/integrations/[providerId]/sync
// ============================================================
// Runs a real sync through the provider adapter and records the run.
// Providers whose data adapter is not implemented yet answer
// ADAPTER_NOT_IMPLEMENTED — an honest 501, never a fake success.

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getProvider } from "@/lib/integrations/providers";
import {
  readConnections,
  readCredential,
  recordSyncRun,
} from "@/lib/integrations/connections";
import { listEventsInRange } from "@/lib/integrations/adapters/google-calendar";

const SYNC_WINDOW_DAYS = 14;

export async function POST(
  _request: Request,
  context: { params: Promise<{ providerId: string }> }
) {
  const requestId = randomUUID();
  const startedAt = new Date().toISOString();
  try {
  const { providerId } = await context.params;

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

  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const supabase = await createClient();
  const { membership } = await getActiveMembership(supabase, user.id);
  const workspaceId = membership?.workspaceId;
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No active workspace associated with user" },
      { status: 400 }
    );
  }

  // ---- Connection must exist ---------------------------------------
  const connections = await readConnections(supabase, workspaceId);
  const connection = connections.find((row) => row.provider_id === provider.id);
  if (!connection) {
    return NextResponse.json(
      {
        error: `${provider.name} is not connected. Connect it first.`,
        code: "NOT_CONNECTED",
      },
      { status: 409 }
    );
  }

  // ---- Adapter must exist ------------------------------------------
  // The capability model is public: only google-calendar has a
  // server-side data adapter today. Everything else is honestly 501.
  if (provider.id !== "google-calendar") {
    return NextResponse.json(
      {
        error: `${provider.name} has no server-side data adapter yet. The connection is stored; the sync path is implemented for Google Calendar first.`,
        code: "ADAPTER_NOT_IMPLEMENTED",
      },
      { status: 501 }
    );
  }

  // ---- Mark syncing -------------------------------------------------
  if (connection.state === "syncing") return NextResponse.json({ error: "A sync is already running. Wait for its result.", code: "SYNC_IN_PROGRESS" }, { status: 409 });
  const { data: claimed, error: claimError } = await supabase
    .from("integration_connections").update({ state: "syncing" })
    .eq("id", connection.id).eq("workspace_id", workspaceId).eq("state", connection.state)
    .select("id").maybeSingle();
  if (claimError) throw new Error("SYNC_STATE_WRITE_FAILED");
  if (!claimed) return NextResponse.json({ error: "The connection changed. Refresh before syncing again." }, { status: 409 });

  // ---- Read credential (server-only) --------------------------------
  const accessToken = await readCredential(supabase, connection);
  if (!accessToken) {
    await recordSyncRun({
      supabase,
      workspaceId,
      connectionId: connection.id,
      providerId: provider.id,
      requestId, startedAt,
      status: "failed",
      itemsRead: 0,
      itemsCreated: 0,
      errorCode: "CREDENTIAL_UNREADABLE",
      error:
        "The stored credential is expired or cannot be opened. Reconnect to restore access.",
    });
    return NextResponse.json(
      {
        error: "The stored credential is expired or cannot be opened. Reconnect to restore access.",
        code: "REAUTH_REQUIRED",
      },
      { status: 409 }
    );
  }

  // ---- Adapter run ---------------------------------------------------
  const now = new Date();
  const from = new Date(now.getTime() - SYNC_WINDOW_DAYS / 2 * 86_400_000);
  const to = new Date(now.getTime() + (SYNC_WINDOW_DAYS / 2) * 86_400_000);

  const result = await listEventsInRange({
    accessToken,
    range: { fromIso: from.toISOString(), toIso: to.toISOString() },
  });

  if (!result.ok) {
    await recordSyncRun({
      supabase,
      workspaceId,
      connectionId: connection.id,
      providerId: provider.id,
      requestId, startedAt,
      status: "failed",
      itemsRead: 0,
      itemsCreated: 0,
      errorCode: result.errorCode,
      error: result.message,
    });

    const reauth = result.errorCode === "UNAUTHORIZED";
    if (reauth) {
      await supabase
        .from("integration_connections")
        .update({ state: "reauth_required" })
        .eq("id", connection.id);
    }

    return NextResponse.json(
      { error: result.message, code: result.errorCode, reauthRequired: reauth },
      { status: reauth ? 409 : 502 }
    );
  }

  // ---- Success --------------------------------------------------------
  // The adapter reads; it does not copy. Events stay provider-owned
  // (referenced by externalId + URL); NEXUS keeps only normalized
  // run counts only. itemsCreated is 0 by design — no blind import.
  await recordSyncRun({
    supabase,
    workspaceId,
    connectionId: connection.id,
    providerId: provider.id,
    requestId, startedAt,
    status: "success",
    itemsRead: result.events.length,
    itemsCreated: 0,
  });

  return NextResponse.json({
    provider: provider.id,
    requestId,
    itemsRead: result.events.length,
    windowDays: SYNC_WINDOW_DAYS,
    note: "Calendar read completed. Events are not stored or supplied to Intelligence by this route.",
  });
  } catch {
    return NextResponse.json({ error: "Sync could not be recorded or connection state could not be read. Refresh and retry; if syncing persists, reconnect.", code: "SYNC_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}
