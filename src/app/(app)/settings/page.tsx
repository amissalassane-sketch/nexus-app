import { Suspense } from "react";
import { SettingsTabLoader } from "@/components/user-settings-panel";
import { requireUser } from "@/lib/auth";

// ============================================================
// SETTINGS — PROFILE, SECURITY, WORKSPACE, INTELLIGENCE
// The profile is completed/edited here at the user's own pace.
// `?tab=` deep-links from the account menu (Profile / Security /
// Workspace), so the menu lands on the exact section it named.
// ============================================================

export default async function Page() {
  const user = await requireUser();

  return (
    <Suspense
      fallback={
        <div className="skeleton h-40 w-full rounded-card" aria-hidden="true" />
      }
    >
      <SettingsTabLoader userId={user.id} />
    </Suspense>
  );
}
