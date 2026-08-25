import { redirect } from "next/navigation";

// ============================================================
// LEGACY ONBOARDING URL — REPURPOSED
// The mandatory multi-step onboarding wizard is gone. The dashboard
// is the first-value experience: every authenticated account enters
// /app after authentication, complete profile or not. Profile
// completion is offered from inside the product, optionally.
//
// This route exists only so old links, bookmarks and deep links keep
// working: it simply sends the visitor into NEXUS.
// ============================================================

export default function OnboardingPage() {
  redirect("/app");
}
