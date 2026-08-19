import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  // /auth/callback carries the PKCE code WITHOUT a session yet:
  // it must reach its route handler in every case (pitfall #3).
  const isCallbackRoute = pathname.startsWith("/auth/callback");

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup");

  if (!user && !isAuthRoute && !isCallbackRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthRoute && !isCallbackRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
