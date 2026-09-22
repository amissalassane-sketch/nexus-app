// ============================================================
// NEXUS — INTEGRATION OAUTH CALLBACK
// GET /api/integrations/callback/[providerId]
// ============================================================
// Completes the handshake: verify the CSRF state cookie, exchange
// the code for tokens, seal the tokens, persist the connection.
// A failure redirects to the Integrations page with a typed error
// message — never a silent failure and never a fake "connected".

import { validateOAuthAttempt, integrationOrigin } from "@/lib/integrations/oauth-state";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getProvider } from "@/lib/integrations/providers";
import {
  exchangeCodeForTokens,
  persistConnection,
  OAUTH_STATE_COOKIE,
} from "@/lib/integrations/connections";

function redirectWithError(origin: string, code: string, message: string) {
  const url = new URL("/integrations", origin);
  url.searchParams.set("connect_error", code);
  url.searchParams.set("connect_message", message.slice(0, 300));
  const response = NextResponse.redirect(url);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await context.params;
  const requestUrl = new URL(request.url);
  const origin = integrationOrigin(request.url);
  if (!origin) return NextResponse.json({ error: "The public OAuth callback origin is not configured." }, { status: 503 });

  if (!isSupabaseConfigured()) {
    return redirectWithError(
      origin,
      "NOT_CONFIGURED",
      "Supabase is not configured, so the connection cannot be saved."
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return redirectWithError(origin, "UNAUTHORIZED", "Your session expired during the connection.");
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return redirectWithError(origin, "UNKNOWN_PROVIDER", "Unknown provider.");
  }

  // ---- CSRF: the state must match the sealed cookie ----------------
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const providerError = requestUrl.searchParams.get("error");

  if (providerError) {
    return redirectWithError(
      origin,
      "PROVIDER_REJECTED",
      `${provider.name} did not authorize the connection. Review permissions and start again.`
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState) {
    return redirectWithError(
      origin,
      "STATE_MISMATCH",
      "The connection request could not be verified (missing or mismatched state). Start the connection again."
    );
  }

  // ---- Session + workspace (re-validated, never trusted) -----------
  const supabase = await createClient();
  const { membership } = await getActiveMembership(supabase, user.id);
  if (!membership?.workspaceId) {
    return redirectWithError(
      origin,
      "NO_WORKSPACE",
      "No active workspace is associated with your account."
    );
  }

  // ---- Exchange ----------------------------------------------------
  const redirectUri = `${origin}/api/integrations/callback/${provider.id}`;
  const attempt = validateOAuthAttempt(expectedState, { state, providerId: provider.id, userId: user.id,
    workspaceId: membership.workspaceId, redirectUri });
  if (!attempt) return redirectWithError(origin, "STATE_MISMATCH", "This connection expired or belongs to another account, workspace or provider. Start again.");
  // Consume this browser attempt before making an external request. Authorization codes are provider-side single use.
  cookieStore.delete(OAUTH_STATE_COOKIE);
  const exchange = await exchangeCodeForTokens({ provider, code, redirectUri, codeVerifier: attempt.codeVerifier });

  if (!exchange.ok) {
    return redirectWithError(origin, exchange.errorCode, exchange.message);
  }

  // ---- Persist -----------------------------------------------------
  const persisted = await persistConnection({
    supabase,
    workspaceId: membership.workspaceId,
    userId: user.id,
    provider,
    accessToken: exchange.accessToken,
    refreshToken: exchange.refreshToken,
    expiresAt: exchange.expiresAt,
    accountLabel: exchange.accountLabel,
    grantedScopes: exchange.grantedScopes,
  });

  if (!persisted.ok) {
    return redirectWithError(origin, persisted.errorCode, persisted.message);
  }

  cookieStore.delete(OAUTH_STATE_COOKIE);
  const url = new URL("/integrations", origin);
  url.searchParams.set("connected", provider.id);
  return NextResponse.redirect(url);
}
