"use client";

import { usePathname } from "next/navigation";
import { SonarGrid } from "@/components/ui/sonar-grid";

/**
 * Global background layer for NEXUS.
 *
 * Provides the interactive SonarGrid wave field across all public pages,
 * landing page sections, onboarding, auth screens, legal notices and admin views.
 *
 * The dashboard and workspace application routes remain completely untouched.
 */
export function NexusBackground() {
  const pathname = usePathname();

  // Paths that belong to the active workspace app / dashboard shell
  const isDashboardApp =
    pathname?.startsWith("/dashboard") ||
    pathname === "/app" ||
    pathname?.startsWith("/app/") ||
    pathname?.startsWith("/tasks") ||
    pathname?.startsWith("/projects") ||
    pathname?.startsWith("/notes") ||
    pathname?.startsWith("/goals") ||
    pathname?.startsWith("/calendar") ||
    pathname?.startsWith("/files") ||
    pathname?.startsWith("/activity") ||
    pathname?.startsWith("/notifications") ||
    pathname?.startsWith("/settings") ||
    pathname?.startsWith("/billing") ||
    pathname?.startsWith("/plans") ||
    pathname?.startsWith("/upgrade") ||
    pathname?.startsWith("/integrations");

  if (isDashboardApp) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <SonarGrid
        id="nexus-global-sonar-grid"
        ringWidth={90}
        speed={260}
        amplitude={2.2}
        pingEvery={2.4}
        interactive={true}
        spacing={26}
        baseOpacity={0.28}
        color="#6366f1"
        seedPing={true}
        pingArea={[0.22, 0.18, 0.78, 0.82]}
        className="pointer-events-none fixed inset-0 h-screen w-screen overflow-hidden"
      />
    </div>
  );
}
