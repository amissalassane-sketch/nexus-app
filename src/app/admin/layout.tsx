import type { Metadata } from "next";
import type { ReactNode } from "react";
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
// This file is the server-side gate for the whole control plane. Every
// route below /admin renders inside it, so there is no admin page that
// can be reached without passing through here — including a route added
// later by someone who forgets to protect it.
//
// The decision is not made in this file, though. It is made in Postgres:
// getPlatformAdminState() asks platform_admin_context(), a SECURITY
// DEFINER function that reads public.platform_admins — a table with RLS
// enabled and no policies, so the only way to appear in it is for an
// operator to have inserted the row.
//
// What this file guarantees:
//   * no session            → redirect to /login
//   * signed in, not admin  → a refusal screen, and an audit entry
//   * check could not run   → the same refusal screen, with the reason
//   * admin                 → the shell, and only the shell
//
// There is no client-side half of this check, no cookie to forge, no
// React state to prime, and no pathname to memorise.
// ============================================================

// An internal surface must never be prerendered: the identity of the
// caller is the entire input to this layout.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  // Belt and braces: the product's marketing pages are indexable, and an
  // internal control plane must not be crawled even if it ever leaks.
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const state = await getPlatformAdminState();

  // No session at all. The proxy already sends anonymous visitors to
  // /login for page navigations; this covers a direct document request
  // and keeps the behaviour identical either way.
  if (state.status === "unauthenticated") {
    redirect("/login");
  }

  if (state.status !== "admin") {
    // A refused attempt is the most security-relevant event in the whole
    // surface, so it is recorded. The writer is narrow by construction
    // (fixed action, actor from the JWT, one row per actor per 5 minutes)
    // and best effort: a failure here must not turn a refusal into a 500.
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
