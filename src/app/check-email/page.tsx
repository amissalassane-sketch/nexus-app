"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Post-signup verification gate.
 *
 * Shown after an email+password sign-up that requires confirmation. The user
 * must open the link we sent before they can sign in. They never have to
 * restart sign-up from here: they can resend the email (rate-limited) or go
 * back and use a different address.
 */
export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Check your inbox" description="">
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="skeleton h-11 rounded-input" />
            <div className="skeleton h-11 rounded-input" />
          </div>
          <p className="sr-only" role="status">
            Loading
          </p>
        </AuthLayout>
      }
    >
      <CheckEmailInner />
    </Suspense>
  );
}

function CheckEmailInner() {
  const params = useSearchParams();
  const email = params.get("email")?.trim() ?? "";
  const { error: configError } = readSupabaseConfig();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    cooldownInterval.current = setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          if (cooldownInterval.current) clearInterval(cooldownInterval.current);
          cooldownInterval.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, []);

  const handleResend = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (cooldown > 0 || loading) return;

      if (configError) {
        setError(configError);
        return;
      }

      if (!email.trim()) {
        setError("Please enter your email address.");
        return;
      }

      setLoading(true);
      setError("");
      setMessage("");

      try {
        const response = await fetch("/api/auth/resend-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          message?: string;
        } | null;

        if (!response.ok || !payload?.ok) {
          setError(payload?.error ?? "Could not resend the email.");
          return;
        }

        setMessage(
          "Verification email sent. Check your inbox and follow the verification link."
        );
        startCooldown();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `Could not reach the server: ${cause.message}`
            : "Could not reach the server."
        );
      } finally {
        setLoading(false);
      }
    },
    [cooldown, loading, configError, email, startCooldown]
  );

  return (
    <AuthLayout
      title="Check your inbox"
      description="Verify your email address to finish creating your NEXUS account."
      footer={
        <>
          Wrong address?{" "}
          <Link
            href="/signup"
            className="text-text-primary underline decoration-border-strong underline-offset-4"
          >
            Create another account
          </Link>
        </>
      }
    >
      {configError ? (
        <Alert tone="danger" className="mb-4">
          {configError}
        </Alert>
      ) : null}

      {email ? (
        <p className="mb-6 text-center text-small text-text-secondary">
          We sent a NEXUS verification link to{" "}
          <span className="text-text-primary">{email}</span>. Open it to verify
          your address and continue.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <ButtonLink href="/login" size="lg" className="w-full">
          Back to sign in
        </ButtonLink>
      </div>

      <form onSubmit={handleResend} className="mt-6">
        <button
          type="submit"
          disabled={cooldown > 0 || loading || Boolean(configError)}
          className="mx-auto block text-center text-small text-text-tertiary underline decoration-border-strong underline-offset-4 transition-colors hover:text-text-secondary disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
        >
          {cooldown > 0
            ? `Resend available in ${cooldown}s`
            : loading
              ? "Sending verification email…"
              : "Didn't receive it? Resend verification email"}
        </button>
      </form>

      {error ? (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      {message ? (
        <div className="mt-4">
          <Alert tone="success">{message}</Alert>
        </div>
      ) : null}
    </AuthLayout>
  );
}
