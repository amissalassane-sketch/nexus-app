import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminAccessDenied } from "@/components/admin/access-denied";
import { AdminShell } from "@/components/admin/admin-shell";
import { recordAdminAccessDenied } from "@/lib/admin/audit";
import { formatRelativeTime } from "@/lib/admin/format";
import { getPlatformAdminState } from "@/lib/admin/guard";
import { getAuthenticatedUser } from "@/lib/auth";

// ============================================================
// NEXUS ADMIN — LAYOUT (THE GATE)
// ============================================================
// Server-side gate for the NEXUS Control Plane.
//
// Special exemption:
//   /admin/login, /admin/forgot-password, /admin/reset-password
//   are authentication surfaces and must NOT be gated by this layout,
//   otherwise an unauthenticated operator would hit an infinite redirect
//   loop (/admin/login -> layout -> redirect /admin/login).
//
// What this file guarantees for all other /admin/* routes:
//   * no session            → redirect to /admin/login
//   * signed in, not admin  → refusal screen & audit log entry
//   * check failed          → refusal screen with operational diagnosis
//   * verified admin        → render AdminShell
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const pathname =
    headerList.get("x-pathname") ||
    headerList.get("next-url") ||
    "";

  // Dedicated auth sub-routes bypass the platform-admin shell gate.
  // Their own pages manage login/recovery flows.
  const isAuthRoute =
    pathname.includes("/admin/login") ||
    pathname.includes("/admin/forgot-password") ||
    pathname.includes("/admin/reset-password");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  const state = await getPlatformAdminState();

  // No session at all -> redirect to /admin/login
  if (state.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (state.status !== "admin") {
    await recordAdminAccessDenied({
      reason:
        state.status === "not_admin"
          ? "NOT_A_PLATFORM_ADMIN"
          : `CHECK_${state.reason}`,
      path: "/admin",
    });
    return <AdminAccessDenied state={state} />;
  }

  const user = await getAuthenticatedUser();

  return (
    <AdminShell
      role={state.role}
      email={user?.email ?? null}
      platformLabel={`Platform · ${state.role}`}
      platformTone="neutral"
      lastUpdated={`Loaded ${formatRelativeTime(new Date().toISOString())}`}
    >
      {children}
    </AdminShell>
  );
}
