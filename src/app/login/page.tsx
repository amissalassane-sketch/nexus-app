"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { createClientSafe } from "@/lib/supabase/client";
import { humanizeAuthError, validateCredentials } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Sign in.
 *
 * Optimised for EXISTING USERS. The credentials are posted to
 * /api/auth/signin, which authenticates against Supabase and writes the SSR
 * cookies server-side. This page therefore has a single failure surface, and
 * every outcome is displayed to the user.
 *
 * Login never creates accounts and never asks onboarding questions. Where the
 * session lands after sign-in is decided server-side from the account state.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: configError } = readSupabaseConfig();
  const clientResult = useMemo(() => createClientSafe(), []);
  const supabase = clientResult.client;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const submitting = useRef(false);
  const resendSubmitting = useRef(false);
  // Guards the OAuth click the same way `submitting` guards the credentials
  // form: a ref flips synchronously, so two rapid clicks cannot fire two
  // provider redirects before the button re-renders as disabled.
  const googleSubmitting = useRef(false);
  const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  const startResendCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    cooldownInterval.current = setInterval(() => {
      setResendCooldown((value) => {
        if (value <= 1) {
          if (cooldownInterval.current) clearInterval(cooldownInterval.current);
          cooldownInterval.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, []);

  const handleLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting.current) return;

      if (configError) {
        setError(configError);
        return;
      }

      const validationError = validateCredentials(email, password);
      if (validationError) {
        setError(validationError);
        return;
      }

      submitting.current = true;
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          errorCode?: string;
          redirectTo?: string;
        } | null;

        if (!response.ok || !payload?.ok) {
          const isUnverified = payload?.errorCode === "EMAIL_NOT_CONFIRMED";
          setError(payload?.error ?? "Sign in failed. Please try again.");
          setNeedsVerification(isUnverified);
          setVerificationMessage("");
          return;
        }

        setNeedsVerification(false);
        router.replace(payload.redirectTo ?? "/app");
        router.refresh();
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
    [configError, email, password, router]
  );

  const handleGoogleLogin = useCallback(async () => {
    if (googleSubmitting.current) return;

    if (configError) {
      setError(configError);
      return;
    }

    if (!supabase) {
      setError(clientResult.error ?? "Supabase is not configured.");
      return;
    }

    googleSubmitting.current = true;
    setGoogleLoading(true);
    setError("");

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?source=oauth`,
          queryParams: { prompt: "select_account" },
        },
      });

      if (oauthError) {
        setError(humanizeAuthError(oauthError));
        googleSubmitting.current = false;
        setGoogleLoading(false);
      }
      // On success the browser navigates away to Google, then back to
      // /auth/callback — keep the spinner and the guard for the whole trip.
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Could not reach the server: ${cause.message}`
          : "Could not reach the server."
      );
      googleSubmitting.current = false;
      setGoogleLoading(false);
    }
  }, [configError, supabase, clientResult.error]);

  const handleResendVerification = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (resendSubmitting.current || resendCooldown > 0) return;

      if (configError) {
        setError(configError);
        return;
      }

      if (!email.trim()) {
        setError("Please enter your email address.");
        return;
      }

      resendSubmitting.current = true;
      setResendLoading(true);
      setError("");
      setVerificationMessage("");

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

        setVerificationMessage(
          "Verification email sent. Check your inbox and follow the verification link."
        );
        startResendCooldown();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `Could not reach the server: ${cause.message}`
            : "Could not reach the server."
        );
      } finally {
        resendSubmitting.current = false;
        setResendLoading(false);
      }
    },
    [configError, email, resendCooldown, startResendCooldown]
  );

  const showConfigError = configError ?? clientResult.error;

  return (
    <AuthLayout
      title="Welcome back"
      description="Continue where you left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary"
          >
            Create one
          </Link>
        </>
      }
    >
      {showConfigError ? (
        <Alert tone="danger" className="mb-4">
          {showConfigError}
        </Alert>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={handleGoogleLogin}
        loading={googleLoading}
        disabled={Boolean(showConfigError)}
      >
        <GoogleGlyph />
        Continue with Google
      </Button>

      <Divider label="or" />

      <form onSubmit={handleLogin} noValidate className="flex flex-col gap-4">
        <Field label="Email" htmlFor="login-email">
          <Input
            id="login-email"
            name="email"
            size="lg"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="username"
            disabled={loading}
            aria-invalid={error ? true : undefined}
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="login-password"
          action={
            <Link
              href="/forgot-password"
              className="text-caption text-text-tertiary transition-colors hover:text-text-secondary"
            >
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            id="login-password"
            name="password"
            size="lg"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            disabled={loading}
            aria-invalid={error ? true : undefined}
            required
          />
        </Field>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Button
          type="submit"
          size="lg"
          loading={loading}
          disabled={Boolean(showConfigError)}
          className="mt-1 w-full"
        >
          Log in
        </Button>
      </form>

      {needsVerification ? (
        <div className="mt-6 border-t border-border-subtle pt-6">
          <p className="mb-3 text-center text-small text-text-secondary">
            Didn&apos;t receive the verification email?
          </p>
          <form onSubmit={handleResendVerification} noValidate className="flex flex-col gap-4">
            {verificationMessage ? (
              <Alert tone="success">{verificationMessage}</Alert>
            ) : null}

            <Button
              type="submit"
              size="lg"
              variant="secondary"
              loading={resendLoading}
              disabled={Boolean(showConfigError) || resendCooldown > 0}
              className="w-full"
            >
              {resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : resendLoading
                  ? "Sending verification email…"
                  : "Resend verification email"}
            </Button>
          </form>
        </div>
      ) : null}
    </AuthLayout>
  );
}

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 5.1 29.3 3 24 3 16.3 3 9.6 7.1 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9.5 40.9 16.2 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C40.8 35.9 45 30.6 45 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
