import { readJsonObject } from "@/lib/request-json";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { humanizeDataError } from "@/lib/data-errors";
import { isMissingColumnError } from "@/lib/schema-errors";
import { isValidUsername } from "@/lib/profile-state";
import {
  ensurePersonalWorkspaceServer,
  ensureProfileServer,
} from "@/lib/auth-flow";
import {
  createOnboardingRequestId,
  reportOnboardingDiagnostic,
} from "@/lib/onboarding-diagnostics";

/**
 * NEXUS — PROFILE COMPLETION (OPTIONAL, POST-DASHBOARD)
 *
 * The single write path for finishing a NEXUS profile from inside the
 * product (the completion modal or Settings → Profile).
 *
 * Contract:
 *   - authentication identity (email) is never touched;
 *   - full name and username are the two identity fields; both are
 *     optional on every individual call so a user can complete the
 *     profile progressively, but at least one field must be provided;
 *   - avatar URL, job title and bio are optional;
 *   - the workspace bootstrap RPC runs FIRST (the production incident
 *     lesson: never write profile state before the workspace context is
 *     guaranteed), but a bootstrap failure does NOT block profile saving
 *     — profile completeness and workspace readiness are separate state
 *     axes and neither gates the other;
 *   - the write is update-first with an insert fallback for orphan
 *     accounts, followed by a read-back verification;
 *   - the UI never receives a raw Supabase/Postgres message.
 */

type ProfilePayload = {
  displayName?: unknown;
  username?: unknown;
  avatarUrl?: unknown;
  jobTitle?: unknown;
  bio?: unknown;
};

const ENDPOINT = "/api/profile";

function responseError(
  requestId: string,
  status: number,
  error: string
): NextResponse {
  return NextResponse.json(
    { ok: false, error, requestId },
    { status, headers: { "cache-control": "no-store" } }
  );
}

function responseOk(
  requestId: string,
  profile: {
    displayName: string | null;
    username: string | null;
    profileComplete: boolean;
  }
): NextResponse {
  return NextResponse.json(
    { ok: true, profile, requestId },
    { headers: { "cache-control": "no-store" } }
  );
}

function validate(body: ProfilePayload): {
  payload: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    job_title: string | null;
    bio: string | null;
  } | null;
  error: string | null;
} {
  const clean = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

  const displayName = clean(body.displayName, 120);
  const username = clean(body.username, 32).toLowerCase();
  const avatarUrl = clean(body.avatarUrl, 500);
  const jobTitle = clean(body.jobTitle, 120);
  const bio = clean(body.bio, 500);

  if (!displayName && !username && !avatarUrl && !jobTitle && !bio) {
    return { payload: null, error: "Nothing to save. Add a name or a username first." };
  }
  if (displayName.length > 120) {
    return { payload: null, error: "Your name must be 120 characters or fewer." };
  }
  if (username && !isValidUsername(username)) {
    return {
      payload: null,
      error:
        "Usernames are 3–32 characters: letters, numbers, dots, underscores and dashes.",
    };
  }
  if (
    avatarUrl &&
    !/^(https?:\/\/[^\s]+\.[^\s]+|data:image\/[a-z+]+;base64,[^\s]+)$/i.test(
      avatarUrl
    )
  ) {
    return {
      payload: null,
      error: "Profile photo must be a valid image link.",
    };
  }

  return {
    payload: {
      display_name: displayName || null,
      username: username || null,
      avatar_url: avatarUrl || null,
      job_title: jobTitle || null,
      bio: bio || null,
    },
    error: null,
  };
}

export async function POST(request: Request) {
  const requestId = createOnboardingRequestId();

  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch {
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
      step: 1,
      operation: "auth.getUser",
      code: userError?.code,
      message: userError?.message ?? "no authenticated user",
    });
    return responseError(
      requestId,
      401,
      "Your session has expired. Sign in again, then retry this change."
    );
  }

  let body: ProfilePayload;
  try {
    body = (await readJsonObject(request)) as ProfilePayload;
  } catch {
    return responseError(requestId, 400, "Please enter a valid profile.");
  }

  const { payload, error: validationError } = validate(body);
  if (!payload) {
    return responseError(requestId, 400, validationError ?? "Invalid profile.");
  }

  // Ensure the profile row exists first (orphan repair, minimal record) so
  // the update below has something to match.
  await ensureProfileServer(supabase, user.id);

  // Guarantee the workspace context BEFORE persisting profile state — the
  // same ordering that repaired the historical incident. A transient
  // bootstrap failure is reported (diagnostics only) but does not block
  // profile completion: the two state axes stay independent.
  const { membership, error: bootstrapError } =
    await ensurePersonalWorkspaceServer(supabase);
  if (!membership) {
    reportOnboardingDiagnostic({
      requestId,
      endpoint: ENDPOINT,
      step: 1,
      userId: user.id,
      operation: "rpc.get_or_create_personal_workspace",
      message: `bootstrap not verified (${bootstrapError}); profile save continues independently`,
    });
  }

  const written = await upsertProfile(
    supabase,
    user.id,
    { id: user.id, ...payload, updated_at: new Date().toISOString() },
    requestId
  );

  if (!written.ok) {
    return responseError(requestId, 503, written.error);
  }

  // Read back and confirm the write actually landed (an update that matched
  // zero rows must not be reported as saved).
  const { data: verified, error: verifyError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .eq("id", user.id)
    .maybeSingle();

  if (
    verifyError ||
    verified?.id !== user.id ||
    verified.display_name !== payload.display_name ||
    verified.username !== payload.username
  ) {
    reportOnboardingDiagnostic({
      requestId,
      endpoint: ENDPOINT,
      step: 1,
      userId: user.id,
      operation: "profiles.select.verify",
      code: verifyError?.code,
      message: verifyError?.message ?? "profile read-back did not match",
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
    step: 1,
    userId: user.id,
    workspaceId: membership?.workspace_id,
    operation: "profiles.save",
    message: "ok",
  });

  return responseOk(requestId, {
    displayName: payload.display_name,
    username: payload.username,
    profileComplete:
      payload.display_name !== null && payload.username !== null,
  });
}

/**
 * Update-first, insert-fallback write. A plain `upsert` is avoided:
 * PostgREST evaluates both the INSERT and UPDATE RLS paths for an upsert,
 * which makes an existing profile fail on hosted databases that still
 * carry the original self-update policy without the self-repair insert
 * policy. The explicit sequence keeps the operation unambiguous.
 *
 * If the live database predates migration 020 (no `job_title` column),
 * the write is retried without that column so progress on name/username
 * is never blocked by a schema gap.
 */
async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  profile: Record<string, unknown>,
  requestId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const attempt = async (
    payload: Record<string, unknown>
  ): Promise<{ ok: true } | { ok: false; error: string; missingColumn?: boolean }> => {
    const updated = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    if (updated.error) {
      return {
        ok: false,
        error: humanizeDataError(
          updated.error,
          "Your profile could not be saved. Please try again."
        ),
        missingColumn: isMissingColumnError(updated.error.message, "job_title"),
      };
    }

    if (updated.data?.id) return { ok: true };

    // Historical accounts can be missing the trigger-created profile row.
    const inserted = await supabase
      .from("profiles")
      .insert({ id: userId, ...payload })
      .select("id")
      .maybeSingle();

    if (inserted.error || !inserted.data?.id) {
      const error = inserted.error;
      return {
        ok: false,
        error: humanizeDataError(
          error,
          "Your profile could not be saved. Please try again."
        ),
        missingColumn: isMissingColumnError(error?.message, "job_title"),
      };
    }

    return { ok: true };
  };

  let result = await attempt(profile);
  if (!result.ok && result.missingColumn) {
    const withoutJobTitle = { ...profile };
    delete withoutJobTitle.job_title;
    result = await attempt(withoutJobTitle);
  }

  reportOnboardingDiagnostic({
    requestId,
    endpoint: ENDPOINT,
    step: 1,
    userId,
    operation: result.ok ? "profiles.write" : "profiles.write.fail",
    message: result.ok ? "ok" : result.error,
  });

  return result;
}
