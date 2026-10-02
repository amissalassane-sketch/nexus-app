import { IntelligenceDataError } from "@/lib/intelligence/data-error";
import { readJsonObject } from "@/lib/request-json";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { handleAutomationRequest } from "@/lib/intelligence/proactive-automation";

// ============================================================
// NEXUS INTELLIGENCE — PROACTIVE AUTOMATION API
// GET  /api/intelligence/automation
// POST /api/intelligence/automation (custom thresholds)
// ============================================================

export async function GET(request: Request) {
  return handleRequest(request, false);
}

export async function POST(request: Request) {
  return handleRequest(request, true);
}

async function handleRequest(request: Request, isPost: boolean) {
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

    let civilDate: string | undefined;
    let language: "fr" | "en" | undefined;

    if (isPost) {
      const body = (await readJsonObject(request).catch(() => ({}))) as Record<string, unknown>;
      if (typeof body.civilDate === "string") civilDate = body.civilDate;
      if (body.language === "fr" || body.language === "en") language = body.language;
    } else {
      const url = new URL(request.url);
      const qDate = url.searchParams.get("date");
      const qLang = url.searchParams.get("lang");
      if (qDate) civilDate = qDate;
      if (qLang === "fr" || qLang === "en") language = qLang;
    }

    const { status, body: payload } = await handleAutomationRequest({
      db: supabase,
      userId: user?.id ?? null,
      workspaceId,
      civilDate,
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
    console.error("Proactive automation error:", error);
    return NextResponse.json(
      { error: "Failed to generate automation proposals" },
      { status: 500 }
    );
  }
}
