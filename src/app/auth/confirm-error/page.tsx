"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Field, Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

const RESEND_COOLDOWN_SECONDS = 60;

type Reason =
  | "expired"
  | "already-used"
  | "invalid"
  | "missing"
  | "unknown";

const REASON_COPY: Record<
  Reason,
  { title: string; description: string }
> = {
  expired: {
    title: "This verification link has expired.",
    description:
      "Request a new verification link to continue creating your NEXUS account.",
  },
  "already-used": {
    title: "This verification link is no longer valid.",
    description:
      "The link may have already been used or expired. Sign in if you've already verified your email.",
  },
  invalid: {
    title: "This verification link is no longer valid.",
    description:
      "The link may have expired, already been used, or is malformed.",
  },
  missing: {
    title: "We couldn't verify your email.",
    description:
      "The verification link is missing or incomplete. Request a new one below.",
  },
  unknown: {
    title: "This verification link is no longer valid.",
    description:
      "The link may have expired or already been used. Request a new one to continue.",
  },
};

export default function ConfirmErrorPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Email verification" description="">
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
      <ConfirmErrorInner />
    </Suspense>
  );
}

function ConfirmErrorInner() {
  const params = useSearchParams();
  const rawReason = params.get("reason") ?? "unknown";
  const reason: Reason = Object.prototype.hasOwnProperty.call(REASON_COPY, rawReason)
    ? (rawReason as Reason)
    : "unknown";
  const copy = REASON_COPY[reason];

  const { error: configError } = readSupabaseConfig();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const submitting = useRef(false);
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
      if (submitting.current || cooldown > 0 || loading) return;

      if (configError) {
        setError(configError);
        return;
      }

      if (!email.trim()) {
        setError("Please enter your email address.");
        return;
      }

      submitting.current = true;
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
          setError(payload?.error ?? "Could not resend the verification email.");
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
        submitting.current = false;
        setLoading(false);
      }
    },
    [configError, email, cooldown, loading, startCooldown]
  );

  return (
    <AuthLayout
      title="Email verification"
      description={copy.description}
      footer={
        <>
          Already verified?{" "}
          <Link
            href="/login"
            className="text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary"
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-h3 text-text-primary">{copy.title}</h2>

        <ButtonLink href="/login" size="lg" className="w-full">
          Return to sign in
        </ButtonLink>
        <ButtonLink href="/signup" size="lg" variant="secondary" className="w-full">
          Create account
        </ButtonLink>
      </div>

      <div className="mt-8 border-t border-border-subtle pt-6">
        <p className="mb-3 text-center text-small text-text-secondary">
          Didn&apos;t receive the email?
        </p>
        <form onSubmit={handleResend} noValidate className="flex flex-col gap-4">
          <Field label="Email address" htmlFor="confirm-error-email">
            <Input
              id="confirm-error-email"
              name="email"
              size="lg"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              disabled={loading}
              required
            />
          </Field>

          {configError ? (
            <Alert tone="danger">{configError}</Alert>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : null}
          {message ? <Alert tone="success">{message}</Alert> : null}

          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={Boolean(configError) || cooldown > 0}
            className="w-full"
          >
            {cooldown > 0
              ? `Resend available in ${cooldown}s`
              : loading
                ? "Sending verification email…"
                : "Resend verification email"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
