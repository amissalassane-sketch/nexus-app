"use client";

import { FormEvent, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconEye, IconEyeOff, IconLoader2 } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { AdminIcon } from "@/components/admin/admin-icons";

// ============================================================
// NEXUS ADMIN — LOGIN FORM
// ============================================================
// Dedicated private login surface for platform operators.
//
// Properties:
//   - Zero public sign-up references or links.
//   - Strict dark institutional internal tool appearance.
//   - Submits email + password via Supabase Auth server session.
//   - Immediate verification of platform admin context post-auth.
//   - Clear, non-verbose failure states without leaking internals.
// ============================================================

export function AdminLoginForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;

      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail || !password) {
        setError("Please enter your administrator email and password.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });

        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          errorCode?: string;
        } | null;

        if (!response.ok || !payload?.ok) {
          if (payload?.errorCode === "EMAIL_NOT_CONFIRMED") {
            setError("Account email has not been confirmed. Contact the platform administrator.");
            return;
          }
          setError(payload?.error ?? "Invalid administrator credentials.");
          return;
        }

        // Session established. Now verify if this user holds platform_admins status.
        // We navigate to /admin/overview directly; if not admin, server gate displays refusal.
        router.push("/admin/overview");
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `Connection failure: ${cause.message}`
            : "Connection failure. Please retry."
        );
      } finally {
        setLoading(false);
      }
    },
    [email, password, loading, router]
  );

  return (
    <div className="flex min-h-dvh items-center justify-center bg-admin-base px-4 py-12 text-admin-text">
      <div className="w-full max-w-[420px] rounded-[12px] border border-admin-border bg-admin-surface p-6 shadow-2xl sm:p-8">
        {/* Brand / Title Header */}
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-admin-accent-border bg-admin-accent-bg font-mono text-[12px] font-semibold text-admin-accent"
          >
            N
          </span>
          <div>
            <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-admin-text">
              NEXUS Control Center
            </h1>
            <p className="font-mono text-[10px] uppercase leading-none tracking-[0.1em] text-admin-text-3">
              Operator authentication
            </p>
          </div>
        </div>

        <div className="my-5 h-px w-full bg-admin-border" />

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="admin-email"
              className="block font-mono text-[11px] uppercase tracking-[0.06em] text-admin-text-2"
            >
              Operator email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@nexus.internal"
              autoComplete="email"
              spellCheck={false}
              disabled={loading}
              required
              className="h-10 w-full rounded-[8px] border border-admin-border bg-admin-surface-2 px-3 text-[13px] text-admin-text placeholder:text-admin-text-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="admin-password"
                className="block font-mono text-[11px] uppercase tracking-[0.06em] text-admin-text-2"
              >
                Password
              </label>
              <Link
                href="/admin/forgot-password"
                className="font-mono text-[11px] text-admin-text-3 transition-colors hover:text-admin-text"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                spellCheck={false}
                disabled={loading}
                required
                className="h-10 w-full rounded-[8px] border border-admin-border bg-admin-surface-2 pl-3 pr-10 text-[13px] text-admin-text placeholder:text-admin-text-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-admin-text-3 transition-colors hover:text-admin-text disabled:opacity-50"
              >
                {showPassword ? (
                  <NexusIcon icon={IconEyeOff} />
                ) : (
                  <NexusIcon icon={IconEye} />
                )}
              </button>
            </div>
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
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-admin-accent px-4 font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent text-[13px]"
          >
            {loading ? (
              <NexusIcon icon={IconLoader2} className="animate-spin" />
            ) : null}
            {loading ? "Authenticating…" : "Authenticate Operator"}
          </button>
        </form>

        <div className="mt-6 border-t border-admin-border/60 pt-4 text-center">
          <p className="font-mono text-[10.5px] text-admin-text-3">
            Authorised platform personnel only. Access attempts are recorded.
          </p>
        </div>
      </div>
    </div>
  );
}
