// ============================================================
// NEXUS — INTEGRATION CONNECT (start OAuth)
// GET /api/integrations/[providerId]/connect
// ============================================================
// Redirects to the provider's authorization page. The OAuth `state`
// is a CSRF token sealed in a short-lived httpOnly cookie; the
// callback refuses any code that does not come with the matching
// state.

import { createOAuthAttempt, integrationOrigin } from "@/lib/integrations/oauth-state";
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

  const origin = integrationOrigin(request.url);
  if (!origin) return NextResponse.json({ error: "Configure NEXT_PUBLIC_SITE_URL with the public HTTPS origin before connecting." }, { status: 503 });
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

  const attempt = createOAuthAttempt({ state: result.state, providerId: provider.id, userId: user.id,
    workspaceId: membership.workspaceId, redirectUri: `${origin}/api/integrations/callback/${provider.id}` },
    ["gmail", "google-calendar", "google-drive", "linear"].includes(provider.id));
  const authorizeUrl = new URL(result.url);
  if (attempt.codeChallenge) {
    authorizeUrl.searchParams.set("code_challenge", attempt.codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
  }
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, attempt.cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
  });

  return NextResponse.redirect(authorizeUrl);
}
