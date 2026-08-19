// ============================================================
// NEXUS INTELLIGENCE — BRIEF (Layer 2, P3)
// GET /api/intelligence/brief
//
// Deterministic text always available (FREE plan, no external
// dependency). If NEXUS_AI_API_KEY is set SERVER-SIDE (never
// NEXT_PUBLIC_), an LLM rephrases ONLY the aggregated signals —
// raw workspace data never leaves the server.
//
// Rate limited per IP and per workspace. Clean degradation: any
// LLM failure falls back to the deterministic brief.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { collectWorkspaceIntel } from "@/lib/intelligence/server";

// -- In-memory rate limiter (per instance) ---------------------

const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 20;

const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(...keys: string[]): boolean {
  const key = keys.join("|");
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_CALLS_PER_WINDOW) {
    return false;
  }

  bucket.count += 1;
  return true;
}

// -- LLM layer (optional) --------------------------------------

type SignalSummary = {
  signal: string;
  severity: string;
  title: string;
  reason: string;
};

async function llmBrief(signals: SignalSummary[], momentum: string): Promise<string | null> {
  const apiKey = process.env.NEXUS_AI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.NEXUS_AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.NEXUS_AI_MODEL ?? "gpt-4o-mini";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "You are NEXUS, a terse personal operating system. Write ONE paragraph (max 90 words) summarizing which signals need arbitration today, in order of severity. Base yourself strictly on the provided signals. Direct, concrete, no fluff, no greeting.",
          },
          {
            role: "user",
            content: JSON.stringify({ signals, momentum }),
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null; // clean degradation — deterministic text is served instead
  } finally {
    clearTimeout(timer);
  }
}

// -- Route -----------------------------------------------------

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // Resolve workspace (ordered + limited — pitfall #2).
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const workspaceId = membership?.workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 403 });
  }

  if (!rateLimit(ip, workspaceId)) {
    return NextResponse.json({ error: "Too many requests — slow down" }, { status: 429 });
  }

  const { result, brief, error } = await collectWorkspaceIntel(workspaceId);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  // Only aggregated signals ever leave for the LLM — never raw rows.
  const signals: SignalSummary[] = [
    ...(result.nextAction ? [result.nextAction.insight] : []),
    ...result.insights,
  ].map((insight) => ({
    signal: insight.signal,
    severity: insight.severity,
    title: insight.title,
    reason: insight.reason,
  }));

  const llm = await llmBrief(signals, result.momentum.label);

  return NextResponse.json({
    brief: llm ?? brief,
    source: llm ? "llm" : "deterministic",
    momentum: result.momentum,
    nextAction: result.nextAction?.insight ?? null,
    insights: result.insights,
  });
}
