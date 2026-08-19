import { NextResponse } from "next/server";

/**
 * Lightweight liveness probe for Vercel / uptime checks.
 * Does not touch Supabase — a 200 here means the Next.js process is up.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "nexus",
    time: new Date().toISOString(),
  });
}
