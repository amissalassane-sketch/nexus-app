import { IntelligenceDataError } from "@/lib/intelligence/data-error";
import { readJsonObject } from "@/lib/request-json";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { handleOrchestrateMissionRequest } from "@/lib/intelligence/autonomous-orchestrator";

// ============================================================
// NEXUS INTELLIGENCE — AUTONOMOUS MISSION ORCHESTRATION API
// POST /api/intelligence/missions/orchestrate
// Body: { missionId?: string, proposal?: unknown, language?: "fr" | "en" }
// ============================================================

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase is not configured in this environment" },
        { status: 503 }
      );
    }

    const user = await getAuthenticatedUser();
    const supabase = await createClient();
    const { membership, error: membershipError } = await getActiveMembership(supabase, user?.id ?? "");
    if (membershipError) throw new IntelligenceDataError();
    const workspaceId = membership?.workspaceId ?? null;

    const body = await readJsonObject(request).catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const missionId = typeof body.missionId === "string" && body.missionId.length > 0 && body.missionId.length <= 200
      ? body.missionId
      : undefined;
    const proposal = body.proposal;
    const language = body.language === "en" ? "en" : "fr";

    const { status, body: payload } = await handleOrchestrateMissionRequest({
      db: supabase,
      userId: user?.id ?? null,
      workspaceId,
      missionId,
      proposal,
      language,
    });

    return NextResponse.json(payload, { status });
  } catch (error) {
    if (error instanceof IntelligenceDataError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message, error: error.message },
        { status: error.status }
      );
    }
    console.error("Mission orchestration error:", error);
    return NextResponse.json(
      { error: "Failed to orchestrate mission" },
      { status: 500 }
    );
  }
}
