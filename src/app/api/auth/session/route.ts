import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SessionPayload = {
  access_token?: unknown;
  refresh_token?: unknown;
};

export async function POST(request: Request) {
  let payload: SessionPayload;

  try {
    payload = (await request.json()) as SessionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (typeof payload.access_token !== "string" || typeof payload.refresh_token !== "string") {
    return NextResponse.json({ error: "Missing Supabase session tokens" }, { status: 400 });
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
    return NextResponse.json({ error: userError?.message ?? "Session could not be verified" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
