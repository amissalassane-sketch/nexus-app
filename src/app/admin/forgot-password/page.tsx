"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { IconLoader2 } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { AdminIcon } from "@/components/admin/admin-icons";

// ============================================================
// NEXUS ADMIN — FORGOT PASSWORD
// ============================================================

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your administrator email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !payload?.ok) {
        setError(payload?.error ?? "Could not process recovery request.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network failure. Could not reach recovery service.");
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
              Recovery
            </h1>
            <p className="font-mono text-[10px] uppercase leading-none tracking-[0.1em] text-admin-text-3">
              Operator password reset
            </p>
          </div>
        </div>

        <div className="my-5 h-px w-full bg-admin-border" />

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-[8px] border border-admin-border bg-admin-surface-2 p-3 text-[12.5px] leading-relaxed text-admin-text-2">
              If an administrator account corresponds to <strong className="text-admin-text">{email}</strong>, a recovery dispatch has been transmitted.
            </div>
            <Link
              href="/admin/login"
              className="flex h-9 w-full items-center justify-center rounded-[8px] border border-admin-border bg-admin-surface text-[12.5px] font-medium text-admin-text hover:bg-admin-surface-2 transition-colors"
            >
              Return to Admin Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <p className="text-[12.5px] text-admin-text-2">
              Enter your registered operator address to receive a secure password recovery transmission.
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="recovery-email"
                className="block font-mono text-[11px] uppercase tracking-[0.06em] text-admin-text-2"
              >
                Operator email
              </label>
              <input
                id="recovery-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@nexus.internal"
                autoComplete="email"
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
              {loading ? "Transmitting…" : "Transmit Recovery Link"}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/admin/login"
                className="font-mono text-[11px] text-admin-text-3 hover:text-admin-text transition-colors"
              >
                ← Return to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
