// ============================================================
// NEXUS — CAPTURE API
// POST /api/capture  { text: string }
// ============================================================
// One sentence in, one structured task out. The parse is
// deterministic (src/lib/capture.ts), the write is a normal RLS
// task insert, and the response says exactly what was understood so
// the UI can confirm it. Nothing external is touched.

import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { parseCapture, describeCapture } from "@/lib/capture";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured in this environment" },
      { status: 503 }
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonObject(request).catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text) {
    return NextResponse.json(
      { error: "Write what to capture — a task, a date, a context." },
      { status: 400 }
    );
  }
  if (text.length > 500) {
    return NextResponse.json(
      { error: "Capture is for short intentions (500 characters max). Use a note for longer content." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { membership } = await getActiveMembership(supabase, user.id);
  const workspaceId = membership?.workspaceId;
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No active workspace associated with user" },
      { status: 400 }
    );
  }

  const intent = parseCapture(text);

  const { data: task, error: insertError } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspaceId,
      title: intent.title.slice(0, 200),
      description: text,
      priority: intent.priority,
      status: "todo",
      due_at: intent.dueAt,
      created_by: user.id,
    })
    .select("id, title, due_at, priority")
    .single();

  if (insertError || !task) {
    const message = insertError?.message ?? "The task could not be created.";
    const planLimited = message.includes("PLAN_LIMIT_EXCEEDED");
    return NextResponse.json(
      {
        error: planLimited
          ? "Your workspace reached its active task limit. Complete or cancel tasks, or upgrade the plan."
          : `Capture could not create the task: ${message}`,
        code: planLimited ? "PLAN_LIMIT_EXCEEDED" : "CREATE_FAILED",
        understood: describeCapture(intent),
      },
      { status: planLimited ? 402 : 500 }
    );
  }

  return NextResponse.json({
    task,
    understood: describeCapture(intent),
    dueExpression: intent.dueExpression,
    priority: intent.priority,
  });
}
