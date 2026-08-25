import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { getPostAuthDestination } from "@/lib/auth-flow";

/**
 * Refreshes the Supabase session cookies on every request and enforces
 * route-level authentication. Invoked from `proxy.ts` (Next.js 16 file
 * convention, previously `middleware.ts`).
 *
 * Responsibilities:
 *  1. Refresh session cookies (Supabase SSR)
 *  2. Redirect unauthenticated users from private routes → /login
 *  3. Redirect authenticated users from auth forms → correct destination
 *  4. Intercept stray token_hash/code params → canonical auth routes
 *
 * Does NOT check onboarding state (too expensive for middleware).
 * The app layout handles onboarding gating.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const { config } = readSupabaseConfig();
  const pathname = request.nextUrl.pathname;

  // A deployment without Supabase cannot have an authenticated session.
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

  // Intercept stray auth codes on non-auth routes
  const authCode = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  if (
    (authCode || tokenHash) &&
    !pathname.startsWith("/auth/confirm") &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/api/")
  ) {
    const target = request.nextUrl.clone();
    target.pathname = tokenHash ? "/auth/confirm" : "/auth/callback";
    if (
      pathname.startsWith("/reset-password") &&
      !target.searchParams.get("next")
    ) {
      target.searchParams.set("next", "/reset-password");
    }
    return NextResponse.redirect(target);
  }

  const supabase = createServerClient(config.url, config.key, {
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
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // API routes handle their own auth
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // Public routes (marketing + auth surfaces)
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

  // Unauthenticated users on private routes → /login
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated users on auth forms → redirect to correct destination
  // We check onboarding state so users go to /onboarding or /app correctly.
  if (user && isAuthForm) {
    try {
      const { destination } = await getPostAuthDestination(
        supabase,
        user.id,
        user.email
      );
      return NextResponse.redirect(new URL(destination, request.url));
    } catch {
      // If bootstrap fails, send to /app (the layout will handle it)
      return NextResponse.redirect(new URL("/app", request.url));
    }
  }

  return response;
}
