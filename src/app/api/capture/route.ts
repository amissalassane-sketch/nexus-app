// ============================================================
// NEXUS — CAPTURE API
// POST /api/capture  { text: string }
// ============================================================
// One sentence in, one structured task out. The parse is
// deterministic (src/lib/capture.ts), the write is a normal RLS
// task insert, and the response says exactly what was understood so
// the UI can confirm it. Nothing external is touched.

import { readJsonObject } from "@/lib/request-json";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { parseCapture, describeCapture } from "@/lib/capture";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiError("Supabase is not configured in this environment", {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError("Unauthorized", {
      code: "UNAUTHORIZED",
      status: 401,
    });
  }

  const body = await readJsonObject(request).catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text) {
    return apiError("Write what to capture — a task, a date, a context.", {
      code: "BAD_REQUEST",
      status: 400,
    });
  }
  if (text.length > 500) {
    return apiError("Capture is for short intentions (500 characters max). Use a note for longer content.", {
      code: "PAYLOAD_TOO_LARGE",
      status: 400,
    });
  }

  const supabase = await createClient();
  const { membership } = await getActiveMembership(supabase, user.id);
  const workspaceId = membership?.workspaceId;
  if (!workspaceId) {
    return apiError("No active workspace associated with user", {
      code: "NO_ACTIVE_WORKSPACE",
      status: 400,
    });
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
    return apiError(
      planLimited
        ? "Your workspace reached its active task limit. Complete or cancel tasks, or upgrade the plan."
        : `Capture could not create the task: ${message}`,
      {
        code: planLimited ? "PLAN_LIMIT_EXCEEDED" : "CREATE_FAILED",
        status: planLimited ? 402 : 500,
        extra: {
          understood: describeCapture(intent),
        },
      }
    );
  }

  return apiSuccess({
    task,
    understood: describeCapture(intent),
    dueExpression: intent.dueExpression,
    priority: intent.priority,
  });
}
