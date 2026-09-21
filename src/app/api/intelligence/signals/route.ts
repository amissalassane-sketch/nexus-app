import { readJsonObject } from "@/lib/request-json";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { handleSignalsRequest } from "@/lib/intelligence/signal-api";

// ============================================================
// NEXUS INTELLIGENCE — PROACTIVE SIGNALS API (thin wrapper)
// ============================================================
//
// GET  /api/intelligence/signals
//   session → workspace actif → snapshot réel → proactive engine →
//   priorisation → déduplication → cooldown → signaux triés.
//
// POST /api/intelligence/signals
//   actions: refresh | markSeen | dismiss | resolve | focus
//
// The request logic lives in src/lib/intelligence/signal-api.ts
// (injectable, unit-tested); this file only supplies the real
// Supabase client, the authenticated user and the active membership.
// ============================================================

export async function GET(request: Request) {
  return route(request, "GET");
}

export async function POST(request: Request) {
  return route(request, "POST");
}

async function route(request: Request, method: "GET" | "POST") {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase is not configured in this environment" },
        { status: 503 }
      );
    }

    const user = await getAuthenticatedUser();
    const supabase = await createClient();
    const { membership } = await getActiveMembership(supabase, user?.id ?? "");
    const workspaceId = membership?.workspaceId ?? null;

    const body = method === "POST" ? await readJsonObject(request).catch(() => null) : {};
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const { status, body: payload } = await handleSignalsRequest({
      db: supabase,
      userId: user?.id ?? null,
      workspaceId,
      method,
      body,
    });

    return NextResponse.json(payload, { status });
  } catch (error) {
    console.error("Intelligence signals error:", error);
    return NextResponse.json(
      { error: "Failed to process intelligence signals" },
      { status: 500 }
    );
  }
}
