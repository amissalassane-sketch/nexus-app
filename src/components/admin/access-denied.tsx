import Link from "next/link";
import type { PlatformAdminState } from "@/lib/admin/types";
import { AdminIconTile } from "./admin-icons";

// ============================================================
// NEXUS ADMIN — ACCESS REFUSED
// ============================================================
// Rendered by the admin layout when the database did not confirm a
// platform admin. Two different refusals get two different messages,
// because they need different responses:
//
//   not_admin    — you are signed in as a customer. Nothing is broken.
//   unavailable  — the check itself could not be completed. That is an
//                  operational problem, and the message says what to
//                  look at instead of blaming the visitor.
//
// This screen reveals no data: no counts, no user list, no hint about
// who does have access.
// ============================================================

const UNAVAILABLE_HELP: Record<string, { title: string; detail: string }> = {
  SUPABASE_NOT_CONFIGURED: {
    title: "Supabase is not configured on this deployment",
    detail:
      "NEXT_PUBLIC_SUPABASE_URL and a publishable key are required before the control plane can resolve anyone. See .env.example.",
  },
  MIGRATION_NOT_APPLIED: {
    title: "The admin control plane is not installed in this database",
    detail:
      "Apply supabase/migrations/026_admin_control_plane.sql, then insert the operator's user id into public.platform_admins. Until then no one can enter, which is the intended default.",
  },
  TIMEOUT: {
    title: "The identity check timed out",
    detail:
      "The platform admin lookup did not answer within 6 seconds. Access is refused rather than assumed. Check the database connection and retry.",
  },
  QUERY_FAILED: {
    title: "The identity check failed",
    detail:
      "Postgres rejected the platform admin lookup. Access is refused rather than assumed; the raw error is in the server log, not on this page.",
  },
};

export function AdminAccessDenied({ state }: { state: PlatformAdminState }) {
  const unavailable =
    state.status === "unavailable"
      ? UNAVAILABLE_HELP[state.reason]
      : undefined;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-admin-base px-4 py-16 text-admin-text">
      <div className="w-full max-w-[560px] rounded-[12px] border border-admin-border bg-admin-surface p-6 sm:p-8">
        <AdminIconTile name="shield" />

        <p className="mt-4 font-mono text-[10.5px] uppercase leading-[14px] tracking-[0.12em] text-admin-text-3">
          NEXUS Admin
        </p>

        <h1 className="mt-1.5 text-[20px] font-semibold leading-[28px] tracking-[-0.02em]">
          {unavailable ? unavailable.title : "Platform access required"}
        </h1>

        <p className="mt-2 text-[13px] leading-[20px] text-admin-text-2">
          {unavailable
            ? unavailable.detail
            : "This surface is the internal control plane for the operator of NEXUS. The account you are signed in with is not a platform admin, so nothing here is returned — not even an empty version of it."}
        </p>

        {unavailable ? null : (
          <p className="mt-3 text-[13px] leading-[20px] text-admin-text-2">
            Access is decided by a row in <code className="font-mono text-[12px] text-admin-text">public.platform_admins</code>, checked server-side on every
            request. The URL is not a secret and it is not the gate.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link
            href="/app"
            className="inline-flex h-9 items-center rounded-[8px] bg-admin-text px-3.5 text-[13px] font-medium leading-[20px] text-admin-base transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
          >
            Back to NEXUS
          </Link>
          <Link
            href="/admin/login"
            className="inline-flex h-9 items-center rounded-[8px] border border-admin-border bg-admin-surface-2 px-3.5 text-[13px] leading-[20px] text-admin-text-2 transition-colors duration-150 hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
          >
            Sign in with an Administrator Account
          </Link>
        </div>
      </div>
    </div>
  );
}
