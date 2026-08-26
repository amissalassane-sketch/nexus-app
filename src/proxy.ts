import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 * The previous `middleware.ts` was silently NOT executed by Next 16, which
 * meant: no server-side Supabase session refresh, no route protection for
 * pages that do not check `auth.getUser()` themselves, and no redirect away
 * from /login for already-authenticated users.
 *
 * The logic is unchanged — only the file convention is corrected.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Static assets — including the web app manifest and app icons, which
    // must never be gated behind an auth redirect (browsers fetch them
    // before any session exists, e.g. when offering "Add to home screen").
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
