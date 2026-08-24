import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseConfig } from "@/lib/supabase/config";

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
  const pathname = request.nextUrl.pathname;

  // A deployment without Supabase cannot have an authenticated session.
  // Keep marketing/auth surfaces reachable (the forms explain the missing
  // configuration), but preserve the protected-route contract instead of
  // allowing product server components to throw a configuration error.
  if (!config) {
    const publicWithoutAuth =
      pathname === "/" ||
      pathname === "/intelligence" ||
      pathname === "/pricing" ||
      pathname === "/how-it-works" ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password") ||
      pathname.startsWith("/check-email") ||
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/api/") ||
      pathname === "/robots.txt" ||
      pathname === "/sitemap.xml";
    return publicWithoutAuth
      ? response
      : NextResponse.redirect(new URL("/login", request.url));
  }

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

  // Public NEXUS Intelligence product landing: /intelligence is a plain
  // public marketing route for everyone — it never depends on auth or
  // onboarding state. The authenticated workspace lives at /app/intelligence.
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/intelligence" ||
    pathname === "/intelligence/" ||
    pathname === "/pricing" ||
    pathname === "/pricing/" ||
    pathname === "/how-it-works" ||
    pathname === "/how-it-works/" ||
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
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}
