"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { IconLoader2 } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { AdminIcon } from "@/components/admin/admin-icons";

// ============================================================
// NEXUS ADMIN — FORGOT PASSWORD
// ============================================================
// Recovery is deliberately the quietest surface in the control plane.
// It exists for one reason: an operator who cannot sign in needs a way
// back that does not involve a second operator handing over a password.
//
// Two properties are non-negotiable here:
//   * The response never reveals whether an address is an admin account.
//     "If an administrator account corresponds to this address…" is the
//     whole answer, and it is the same answer for every input.
//   * The screen wears the same overlay card, field recipe and primary
//     action as the login form above it, so the flow reads as one
//     surface rather than three unrelated pages.
// ============================================================

const FIELD =
  "h-10 w-full rounded-control border border-admin-border bg-admin-surface-2 px-3 text-body text-admin-text placeholder:text-admin-text-3 transition-colors duration-[120ms] hover:border-admin-border-strong focus-visible:border-admin-accent-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-admin-accent disabled:opacity-50";

const PRIMARY =
  "flex h-10 w-full items-center justify-center gap-2 rounded-control bg-accent px-4 text-button font-medium text-accent-fg transition-colors duration-[120ms] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent";

const SECONDARY =
  "flex h-10 w-full items-center justify-center rounded-control border border-admin-border bg-admin-surface-2 text-button text-admin-text-2 no-underline transition-colors duration-[120ms] hover:border-admin-border-strong hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
        setError(payload?.error ?? "Could not process the recovery request.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network failure. The recovery service could not be reached.");
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
            <h1 className="text-h3 text-admin-text">Operator recovery</h1>
            <p className="mt-0.5 mono-token text-admin-text-3">
              Password reset
            </p>
          </div>
        </div>

        <div className="my-5 h-px w-full bg-admin-border" />

        {submitted ? (
          <div className="flex flex-col gap-4">
            <div
              role="status"
              className="rounded-surface border border-admin-border bg-admin-surface-2 px-3 py-2.5 text-small text-admin-text-2"
            >
              If an administrator account corresponds to{" "}
              <span className="mono-meta text-admin-text">{email}</span>, a
              recovery link has been sent. Nothing on this page confirms or
              denies that the address exists.
            </div>
            <Link href="/admin/login" className={SECONDARY}>
              Return to operator sign-in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <p className="text-small text-admin-text-2">
              Enter the address this operator account was created with. The
              recovery link signs you back in to this surface only.
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="recovery-email"
                className="block text-small font-medium text-admin-text-2"
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
                spellCheck={false}
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

            <button type="submit" disabled={loading} className={`mt-2 ${PRIMARY}`}>
              {loading ? (
                <NexusIcon icon={IconLoader2} className="animate-spin" />
              ) : null}
              {loading ? "Sending…" : "Send recovery link"}
            </button>

            <div className="pt-1 text-center">
              <Link
                href="/admin/login"
                className="text-small text-admin-text-3 transition-colors duration-[120ms] hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
              >
                Back to operator sign-in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
