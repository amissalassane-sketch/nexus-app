"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { AdminIcon } from "@/components/admin/admin-icons";

// ============================================================
// NEXUS ADMIN — RESET PASSWORD
// ============================================================

export default function AdminResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (password.length < 8) {
      setError("Administrator password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !payload?.ok) {
        setError(payload?.error ?? "Could not update administrator credentials.");
        return;
      }

      router.replace("/admin/login?notice=password_updated");
    } catch {
      setError("Network failure. Could not update credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-admin-base px-4 py-12 text-admin-text">
      <div className="w-full max-w-[420px] rounded-[12px] border border-admin-border bg-admin-surface p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-admin-accent-border bg-admin-accent-bg font-mono text-[12px] font-semibold text-admin-accent"
          >
            N
          </span>
          <div>
            <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-admin-text">
              Credentials
            </h1>
            <p className="font-mono text-[10px] uppercase leading-none tracking-[0.1em] text-admin-text-3">
              Set new operator password
            </p>
          </div>
        </div>

        <div className="my-5 h-px w-full bg-admin-border" />

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="new-admin-password"
              className="block font-mono text-[11px] uppercase tracking-[0.06em] text-admin-text-2"
            >
              New administrator password
            </label>
            <input
              id="new-admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={loading}
              required
              className="h-10 w-full rounded-[8px] border border-admin-border bg-admin-surface-2 px-3 text-[13px] text-admin-text placeholder:text-admin-text-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-admin-password"
              className="block font-mono text-[11px] uppercase tracking-[0.06em] text-admin-text-2"
            >
              Confirm new password
            </label>
            <input
              id="confirm-admin-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={loading}
              required
              className="h-10 w-full rounded-[8px] border border-admin-border bg-admin-surface-2 px-3 text-[13px] text-admin-text placeholder:text-admin-text-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent disabled:opacity-50"
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[6px] border border-admin-danger/40 bg-admin-danger-bg/40 px-3 py-2 text-[12px] text-admin-danger"
            >
              <span className="mt-0.5 shrink-0">
                <AdminIcon name="alert" size="action" />
              </span>
              <span className="leading-snug">{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-admin-accent px-4 font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 text-[13px]"
          >
            {loading ? (
              <NexusIcon icon={IconLoader2} className="animate-spin" />
            ) : null}
            {loading ? "Updating credentials…" : "Update Credentials"}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/admin/login"
              className="font-mono text-[11px] text-admin-text-3 hover:text-admin-text transition-colors"
            >
              ← Cancel and return
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
