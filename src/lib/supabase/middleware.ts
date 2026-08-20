import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseConfig } from "@/lib/supabase/config";

/**
 * `/intelligence` serves two audiences at one URL:
 *   - a visitor gets the public NEXUS Intelligence product landing page,
 *   - a signed-in user keeps the workspace Intelligence page unchanged.
 *
 * The public page lives at its own file route and is rewritten in — the URL
 * the visitor sees stays `/intelligence`, and no existing product route,
 * layout or navigation entry has to move.
 */
const INTELLIGENCE_PATH = "/intelligence";
const INTELLIGENCE_LANDING_PATH = "/intelligence-landing";

function isIntelligencePath(pathname: string) {
  return pathname === INTELLIGENCE_PATH || pathname === `${INTELLIGENCE_PATH}/`;
}

function rewriteToIntelligenceLanding(
  request: NextRequest,
  refreshed?: NextResponse
) {
  const url = request.nextUrl.clone();
  url.pathname = INTELLIGENCE_LANDING_PATH;
  const response = NextResponse.rewrite(url);
  // Keep any refreshed Supabase cookies from the request above.
  refreshed?.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

/**
 * Refreshes the Supabase session cookies on every request and enforces
 * route-level authentication. Invoked from `proxy.ts` (Next.js 16 file
 * convention, previously `middleware.ts`).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const { config } = readSupabaseConfig();

  // Without configuration there is no session to read: let the request
  // through so the pages can display an explicit configuration error
  // instead of an infinite redirect loop towards /login.
  if (!config) {
    if (isIntelligencePath(request.nextUrl.pathname)) {
      // No session is possible without Supabase — serve the public page.
      return rewriteToIntelligenceLanding(request);
    }
    return response;
  }

  const pathname = request.nextUrl.pathname;

  // Email links sometimes land on Site URL (/), /onboarding or /login with
  // `?code=` / `?token_hash=` instead of /auth/callback. Catch them here so
  // confirmation is handled in one place — and never dumps a visitor into
  // onboarding before they choose Sign in or Create account.
  const authCode = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  if (
    (authCode || tokenHash) &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/api/")
  ) {
    const target = request.nextUrl.clone();
    target.pathname = "/auth/callback";
    if (pathname.startsWith("/reset-password") && !target.searchParams.get("next")) {
      target.searchParams.set("next", "/reset-password");
    }
    return NextResponse.redirect(target);
  }

  const supabase = createServerClient(
    config.url,
    config.key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route handlers must answer with their own status codes (401/403/400)
  // instead of being redirected to an HTML page. The session cookies are
  // still refreshed above, and /api/auth/signin|signup must stay reachable
  // for users who are in the middle of authenticating.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // Public NEXUS Intelligence landing: visitors see the product page at
  // /intelligence, signed-in users continue to the workspace page.
  if (!user && isIntelligencePath(pathname)) {
    return rewriteToIntelligenceLanding(request, response);
  }

  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith(INTELLIGENCE_LANDING_PATH) ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/check-email") ||
    pathname.startsWith("/auth/");

  const isAuthForm =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/check-email");

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthForm) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
