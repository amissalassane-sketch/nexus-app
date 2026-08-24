import { randomUUID } from "node:crypto";

/**
 * Onboarding diagnostics are deliberately opt-in. They are useful while
 * tracing one production incident, but this module emits nothing unless
 * NEXUS_ONBOARDING_DIAGNOSTICS=1 is explicitly enabled on the server.
 *
 * The UI never receives the Supabase/Postgres message. The request id is safe
 * to return to a user who needs to contact support; user/workspace identifiers
 * remain server-log-only.
 */
export type OnboardingDiagnostic = {
  requestId: string;
  endpoint: string;
  step: number;
  userId?: string;
  workspaceId?: string;
  operation: string;
  code?: string | null;
  message?: string | null;
};

export function createOnboardingRequestId(): string {
  return randomUUID();
}

export function reportOnboardingDiagnostic(event: OnboardingDiagnostic): void {
  if (process.env.NEXUS_ONBOARDING_DIAGNOSTICS !== "1") return;

  // Keep the event structured for Vercel logs. This is intentionally not a
  // client-visible error path and is disabled in normal production traffic.
  console.error("[nexus:onboarding]", JSON.stringify(event));
}
