// ============================================================
// NEXUS — INTEGRATION CONNECT (start OAuth)
// GET /api/integrations/[providerId]/connect
// ============================================================
// Redirects to the provider's authorization page. The OAuth `state`
// is a CSRF token sealed in a short-lived httpOnly cookie; the
// callback refuses any code that does not come with the matching
// state.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getProvider } from "@/lib/integrations/providers";
import {
  beginConnect,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
} from "@/lib/integrations/connections";

export async function GET(
  request: Request,
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

  const origin = new URL(request.url).origin;
  const result = beginConnect({ providerId, origin });

  if ("error" in result) {
    if (result.error === "NOT_CONFIGURED") {
      return NextResponse.json(
        {
          error: "Provider not configured",
          detail: `This deployment is missing ${result.missing?.join(" and ")}. Set them in the server environment to enable ${provider.name}.`,
          missingEnvVars: result.missing,
        },
        { status: 501 }
      );
    }
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, result.state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
  });

  return NextResponse.redirect(result.url);
}
