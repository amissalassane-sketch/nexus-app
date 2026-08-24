#!/usr/bin/env node
/**
 * Direct authenticated smoke test for the production bootstrap RPC.
 *
 * Required environment (export only in the shell running this script):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *   ONBOARDING_ACCESS_TOKEN   # short-lived access token for a test account
 *
 * This script never uses service_role and never writes credentials to disk.
 * The SQL/catalog and historical-account checks live in
 * supabase/diagnostics/onboarding-production.sql.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();
const accessToken = process.env.ONBOARDING_ACCESS_TOKEN?.trim();

if (!url || !key || !accessToken) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, a public Supabase key, or ONBOARDING_ACCESS_TOKEN."
  );
  process.exit(2);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
});

const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
  console.error("Authenticated user lookup failed:", userError?.message ?? "no user");
  process.exit(1);
}

console.log(`Authenticated test user: ${user.id}`);

const { data, error: rpcError } = await supabase.rpc(
  "get_or_create_personal_workspace"
);

if (rpcError) {
  console.error("get_or_create_personal_workspace failed:", {
    code: rpcError.code,
    message: rpcError.message,
    details: rpcError.details,
    hint: rpcError.hint,
  });
  process.exit(1);
}

const membership = (Array.isArray(data) ? data[0] : data);
if (
  !membership?.workspace_id ||
  membership.role !== "owner" ||
  membership.status !== "active"
) {
  console.error("RPC returned an invalid personal context:", membership);
  process.exit(1);
}

const { data: visibleMembership, error: membershipError } = await supabase
  .from("workspace_members")
  .select("workspace_id, user_id, role, status")
  .eq("workspace_id", membership.workspace_id)
  .eq("user_id", user.id)
  .eq("status", "active")
  .maybeSingle();

if (membershipError || !visibleMembership) {
  console.error("Owner membership read-back failed:", {
    code: membershipError?.code,
    message: membershipError?.message,
  });
  process.exit(1);
}

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, onboarding_completed")
  .eq("id", user.id)
  .maybeSingle();

if (profileError) {
  console.error("Profile read failed:", {
    code: profileError.code,
    message: profileError.message,
  });
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      userId: user.id,
      workspaceId: membership.workspace_id,
      role: visibleMembership.role,
      status: visibleMembership.status,
      hasProfile: Boolean(profile),
      onboardingCompleted: profile?.onboarding_completed === true,
    },
    null,
    2
  )
);
