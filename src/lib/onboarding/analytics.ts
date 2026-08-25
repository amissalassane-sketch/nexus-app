// Product analytics for activation and onboarding. No PII.

export type AnalyticsEvent =
  | "onboarding_started"
  | "onboarding_skipped"
  | "onboarding_step_viewed"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "first_project_created"
  | "first_task_created"
  | "first_goal_created"
  | "first_intelligence_interaction"
  | "profile_started"
  | "profile_completed"
  | "activation_reached"
  | "intelligence_opened"
  | "intelligence_interaction"
  | "feature_first_visit"
  | "tour_replayed";

export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean | null>
): void {
  if (typeof window === "undefined") return;
  const payload = {
    event,
    properties: properties ?? {},
    at: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent("nexus:analytics", { detail: payload }));
  if (process.env.NODE_ENV !== "production") {
    console.info("[nexus:analytics]", payload.event, payload.properties);
  }
}

export function emitActivation(type: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("nexus:activation", { detail: { type } })
  );
}
