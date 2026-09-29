"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconEye, IconEyeOff, IconLoader2 } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { AdminIcon } from "@/components/admin/admin-icons";

// ============================================================
// NEXUS ADMIN — RESET PASSWORD
// ============================================================
// The second half of recovery: the operator arrives here from the
// emailed link and sets a new password. Same overlay card, same field
// recipe, same primary action as sign-in and recovery.
//
// Errors are stated once, next to the fields they belong to, and the
// submit button says what it is doing rather than spinning silently.
// ============================================================

const FIELD =
  "h-10 w-full rounded-control border border-admin-border bg-admin-surface-2 px-3 text-body text-admin-text placeholder:text-admin-text-3 transition-colors duration-[120ms] hover:border-admin-border-strong focus-visible:border-admin-accent-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-admin-accent disabled:opacity-50";

export default function AdminResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    if (password.length < 8) {
      setError("Administrator passwords must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
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
        setError(payload?.error ?? "Could not update the administrator password.");
        return;
      }

      router.replace("/admin/login?notice=password_updated");
    } catch {
      setError("Network failure. The credentials were not updated.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-root flex min-h-dvh items-center justify-center bg-admin-base px-4 py-12 text-admin-text">
      <div className="w-full max-w-[420px] rounded-overlay border border-admin-border bg-admin-surface p-6 sm:p-8">
        {/* Brand / Title Header — identical to the sign-in card. */}
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-admin-accent-border bg-admin-accent-bg mono-token font-semibold text-admin-accent"
          >
            N
          </span>
          <div className="min-w-0">
            <h1 className="text-h3 text-admin-text">Set a new password</h1>
            <p className="mt-0.5 mono-token text-admin-text-3">
              Operator credentials
            </p>
          </div>
        </div>

        <div className="my-5 h-px w-full bg-admin-border" />

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <p className="text-small text-admin-text-2">
            This changes the password for the operator account you are signed
            in as. Signing in elsewhere is not affected until the session
            there expires.
          </p>

          <div className="space-y-1.5">
            <label
              htmlFor="new-admin-password"
              className="block text-small font-medium text-admin-text-2"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="new-admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="new-password"
                disabled={loading}
                required
                className={`${FIELD} pl-3 pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-control text-admin-text-3 transition-colors duration-[120ms] hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent disabled:opacity-50"
              >
                {showPassword ? (
                  <NexusIcon icon={IconEyeOff} />
                ) : (
                  <NexusIcon icon={IconEye} />
                )}
              </button>
            </div>
            <p className="text-caption text-admin-text-3">
              Minimum 8 characters.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-admin-password"
              className="block text-small font-medium text-admin-text-2"
            >
              Confirm new password
            </label>
            <input
              id="confirm-admin-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="new-password"
              disabled={loading}
              required
              className={FIELD}
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-surface border border-admin-danger-border bg-admin-danger-bg px-3 py-2 text-small text-admin-danger"
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
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-control bg-accent px-4 text-button font-medium text-accent-fg transition-colors duration-[120ms] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
          >
            {loading ? (
              <NexusIcon icon={IconLoader2} className="animate-spin" />
            ) : null}
            {loading ? "Updating…" : "Update password"}
          </button>

          <div className="pt-1 text-center">
            <Link
              href="/admin/login"
              className="text-small text-admin-text-3 transition-colors duration-[120ms] hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
            >
              Cancel and return to sign-in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
