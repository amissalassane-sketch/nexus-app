import { readJsonObject } from "@/lib/request-json";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLAN_NAMES, type PlanName } from "@/lib/plan-limits";

type UpgradeRequestBody = {
  targetPlan?: unknown;
};

function isPlanName(value: unknown): value is PlanName {
  return typeof value === "string" && PLAN_NAMES.includes(value as PlanName);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UpgradeRequestBody;
  try {
    body = (await readJsonObject(request)) as UpgradeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!isPlanName(body.targetPlan) || body.targetPlan === "FREE") {
    return NextResponse.json({ error: "Invalid target plan" }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "No active workspace found" }, { status: 403 });
  }

  if (!["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only workspace owners and admins can upgrade billing" }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: "PAYMENT_PROVIDER_NOT_CONFIGURED",
      provider: "fedapay",
      targetPlan: body.targetPlan,
      workspaceId: membership.workspace_id,
    },
    { status: 501 }
  );
}
