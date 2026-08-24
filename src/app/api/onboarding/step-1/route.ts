import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { humanizeDataError } from "@/lib/data-errors";
import {
  createOnboardingRequestId,
  reportOnboardingDiagnostic,
} from "@/lib/onboarding-diagnostics";

type IdentityPayload = {
  displayName?: unknown;
  username?: unknown;
};

type BootstrapMembership = {
  workspace_id: string;
  role: string;
  status: string;
};

type ProfilePayload = {
  id: string;
  display_name: string;
  username: string;
  updated_at: string;
};

const ENDPOINT = "/api/onboarding/step-1";
const STEP = 1;

function responseError(
  requestId: string,
  status: number,
  error: string
): NextResponse {
  return NextResponse.json(
    { ok: false, error, requestId },
    {
      status,
      headers: { "cache-control": "no-store" },
    }
  );
}

async function updateOrInsertProfile(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfilePayload,
  requestId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Do not use one `upsert` here. PostgreSQL evaluates both INSERT and UPDATE
  // RLS paths for an upsert, which makes an existing profile fail on hosted
  // databases that still have the original self-update policy but not the
  // later self-insert repair policy. Updating first also makes the operation
  // and the error unambiguous in the production trace.
  const updated = await supabase
    .from("profiles")
    .update(profile)
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (updated.error) {
    reportOnboardingDiagnostic({
      requestId,
      endpoint: ENDPOINT,
      step: STEP,
      userId,
      operation: "profiles.update",
      code: updated.error.code,
      message: updated.error.message,
    });
    return {
      ok: false,
      error: humanizeDataError(
        updated.error,
        "Your profile could not be saved. Please try again."
      ),
    };
  }

  if (updated.data?.id) {
    reportOnboardingDiagnostic({
      requestId,
      endpoint: ENDPOINT,
      step: STEP,
      userId,
      operation: "profiles.update",
      message: "ok",
    });
    return { ok: true };
  }

  // Historical accounts can be missing the trigger-created profile row.
  // The INSERT is still performed with the caller's session and remains
  // subject to the existing `auth.uid() = id` RLS policy from migration 010.
  const inserted = await supabase
    .from("profiles")
    .insert(profile)
    .select("id")
    .maybeSingle();

  if (inserted.error || !inserted.data?.id) {
    const error = inserted.error;
    reportOnboardingDiagnostic({
      requestId,
      endpoint: ENDPOINT,
      step: STEP,
      userId,
      operation: "profiles.insert",
      code: error?.code,
      message: error?.message ?? "profile insert returned no row",
    });
    return {
      ok: false,
      error: humanizeDataError(
        error,
        "Your profile could not be saved. Please try again."
      ),
    };
  }

  reportOnboardingDiagnostic({
    requestId,
    endpoint: ENDPOINT,
    step: STEP,
    userId,
    operation: "profiles.insert",
    message: "ok",
  });
  return { ok: true };
}

export async function POST(request: Request) {
  const requestId = createOnboardingRequestId();
  let supabase: SupabaseClient;

  try {
    supabase = await createClient();
  } catch (cause) {
    reportOnboardingDiagnostic({
      requestId,
      endpoint: ENDPOINT,
      step: STEP,
      operation: "supabase.client",
      message: cause instanceof Error ? cause.message : "client creation failed",
    });
    return responseError(
      requestId,
      503,
      "NEXUS could not prepare your workspace. Please try again shortly."
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    reportOnboardingDiagnostic({
      requestId,
      endpoint: ENDPOINT,
      step: STEP,
      operation: "auth.getUser",
      code: userError?.code,
      message: userError?.message ?? "no authenticated user",
    });
    return responseError(requestId, 401, "Your session has expired. Sign in again, then retry this change.");
  }

  let body: IdentityPayload;
  try {
    body = (await request.json()) as IdentityPayload;
  } catch {
    return responseError(requestId, 400, "Please enter a valid name and username.");
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";

  if (!displayName || displayName.length > 120 || !/^[A-Za-z0-9_]{3,30}$/.test(username)) {
    return responseError(requestId, 400, "Please enter a valid name and username.");
  }

  // This is the only bootstrap step. It executes before profiles.update or
  // profiles.insert and is itself restricted by the security-definer RPC to
  // auth.uid(). No workspace id supplied by the browser is trusted.
  const { data, error: bootstrapError } = await supabase.rpc(
    "get_or_create_personal_workspace"
  );

  if (bootstrapError) {
    reportOnboardingDiagnostic({
      requestId,
      endpoint: ENDPOINT,
      step: STEP,
      userId: user.id,
      operation: "rpc.get_or_create_personal_workspace",
      code: bootstrapError.code,
      message: bootstrapError.message,
    });
    return responseError(
      requestId,
      bootstrapError.code === "42501" ? 403 : 503,
      humanizeDataError(
        bootstrapError,
        "NEXUS could not prepare your workspace. Please try again shortly."
      )
    );
  }

  const membership = (Array.isArray(data) ? data[0] : data) as BootstrapMembership | null;
  reportOnboardingDiagnostic({
    requestId,
    endpoint: ENDPOINT,
    step: STEP,
    userId: user.id,
    workspaceId: membership?.workspace_id,
    operation: "rpc.get_or_create_personal_workspace",
    message: "ok",
  });
  if (
    !membership?.workspace_id ||
    membership.role !== "owner" ||
    membership.status !== "active"
  ) {
    reportOnboardingDiagnostic({
      requestId,
      endpoint: ENDPOINT,
      step: STEP,
      userId: user.id,
      workspaceId: membership?.workspace_id,
      operation: "rpc.get_or_create_personal_workspace.verify",
      message: "RPC returned no active owner membership",
    });
    return responseError(
      requestId,
      503,
      "NEXUS could not verify your personal workspace. Please try again shortly."
    );
  }

  const profileResult = await updateOrInsertProfile(
    supabase,
    user.id,
    {
      id: user.id,
      display_name: displayName,
      username,
      updated_at: new Date().toISOString(),
    },
    requestId
  );

  if (!profileResult.ok) {
    return responseError(requestId, 403, profileResult.error);
  }

  const { data: verifiedProfile, error: verifyError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .eq("id", user.id)
    .maybeSingle();

  if (
    verifyError ||
    verifiedProfile?.id !== user.id ||
    verifiedProfile.display_name !== displayName ||
    verifiedProfile.username !== username
  ) {
    reportOnboardingDiagnostic({
      requestId,
      endpoint: ENDPOINT,
      step: STEP,
      userId: user.id,
      workspaceId: membership.workspace_id,
      operation: "profiles.select.verify",
      code: verifyError?.code,
      message: verifyError?.message ?? "profile read-back did not match submitted identity",
    });
    return responseError(
      requestId,
      503,
      "Your profile could not be confirmed. Please try again shortly."
    );
  }

  reportOnboardingDiagnostic({
    requestId,
    endpoint: ENDPOINT,
    step: STEP,
    userId: user.id,
    workspaceId: membership.workspace_id,
    operation: "profiles.select.verify",
    message: "ok",
  });

  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } }
  );
}
