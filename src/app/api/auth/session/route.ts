import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";

type SessionPayload = {
  access_token?: unknown;
  refresh_token?: unknown;
};

/**
 * Synchronises the browser session with the server so Server Components,
 * the proxy and the Route Handlers all see the same authenticated user.
 * Called by /login and /signup right after Supabase returns a session.
 */
export async function POST(request: Request) {
  const { error: configError } = readSupabaseConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  let payload: SessionPayload;

  try {
    payload = (await request.json()) as SessionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (
    typeof payload.access_token !== "string" ||
    typeof payload.refresh_token !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing Supabase session tokens" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: userError?.message ?? "Session could not be verified" },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true, userId: user.id });
}

/**
 * Server-side sign-out: clears the SSR auth cookies. The browser client also
 * signs out locally, but this guarantees the server session is dropped even
 * if the client-side cookie write is blocked.
 */
export async function DELETE() {
  const { error: configError } = readSupabaseConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
