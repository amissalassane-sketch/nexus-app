// ============================================================
// NEXUS — INTEGRATION DISCONNECT
// DELETE /api/integrations/[providerId]
// ============================================================
// Removes the connection row; the credential row is removed by the
// foreign key cascade. The provider side is not touched — the user
// can revoke access from the provider's own settings at any time,
// and the Integrations page says so.

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getProvider } from "@/lib/integrations/providers";
import { disconnectConnection } from "@/lib/integrations/connections";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ providerId: string }> }
) {
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
  if (!membership?.workspaceId) {
    return NextResponse.json(
      { error: "No active workspace associated with user" },
      { status: 400 }
    );
  }

  const result = await disconnectConnection({
    supabase,
    workspaceId: membership.workspaceId,
    providerId: provider.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.errorCode },
      { status: 500 }
    );
  }

  return NextResponse.json({ disconnected: provider.id });
}
