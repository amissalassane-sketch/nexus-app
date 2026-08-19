// ============================================================
// NEXUS — (app) LAYOUT GUARD (P0)
// No page behind this layout can render without a VERIFIED
// workspace link. A broken or half-onboarded account is sent to
// /onboarding, which acts as the repair path (it re-creates the
// workspace and verifies the membership row exists in the
// database BEFORE redirecting — never a fake redirect).
// ============================================================

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getProfileSummary } from "@/lib/profile";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const summary = await getProfileSummary();

  if (!summary) {
    redirect("/login");
  }

  if (!summary.onboardingCompleted || !summary.hasWorkspace) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
