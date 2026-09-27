import { getBillingProviderStatus } from "@/lib/billing/provider";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readJsonObject } from "@/lib/request-json";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { PLAN_NAMES, type PlanName } from "@/lib/plan-limits";

type UpgradeRequestBody = {
  targetPlan?: unknown;
};

function isPlanName(value: unknown): value is PlanName {
  return typeof value === "string" && PLAN_NAMES.includes(value as PlanName);
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiError("Billing is temporarily unavailable", {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", {
      code: "UNAUTHORIZED",
      status: 401,
    });
  }

  let body: UpgradeRequestBody;
  try {
    body = (await readJsonObject(request)) as UpgradeRequestBody;
  } catch {
    return apiError("Invalid JSON payload", {
      code: "INVALID_JSON_PAYLOAD",
      status: 400,
    });
  }

  if (!isPlanName(body.targetPlan) || body.targetPlan === "FREE") {
    return apiError("Invalid target plan", {
      code: "INVALID_TARGET_PLAN",
      status: 400,
    });
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
    return apiError("Unable to verify billing access", {
      code: "BILLING_UNAVAILABLE",
      status: 500,
    });
  }

  if (!membership) {
    return apiError("No active workspace found", {
      code: "NO_ACTIVE_WORKSPACE",
      status: 403,
    });
  }

  if (!["owner", "admin"].includes(membership.role)) {
    return apiError("Only workspace owners and admins can upgrade billing", {
      code: "FORBIDDEN",
      status: 403,
    });
  }

  const provider = getBillingProviderStatus();
  return NextResponse.json(
    {
      ok: false,
      code: provider.code,
      message: provider.message,
      error: provider.code,
      provider: provider.provider,
      targetPlan: body.targetPlan,
      workspaceId: membership.workspace_id,
    },
    { status: 501 }
  );
}
