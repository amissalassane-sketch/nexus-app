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

  // Without configuration there is no session to read: let the request
  // through so the pages can display an explicit configuration error
  // instead of an infinite redirect loop towards /login.
  if (!config) {
    return response;
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

  const pathname = request.nextUrl.pathname;

  // Route handlers must answer with their own status codes (401/403/400)
  // instead of being redirected to an HTML page. The session cookies are
  // still refreshed above, and /api/auth/signin|signup must stay reachable
  // for users who are in the middle of authenticating.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  const isPublicRoute =
    pathname === "/" ||
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
