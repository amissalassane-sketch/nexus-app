"use client";

import { FormEvent, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { createClientSafe } from "@/lib/supabase/client";
import { validateCredentials } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";

/**
 * Create an account.
 *
 * This page collects ONLY the information required to create the account:
 * a work email and a password. Everything else — name, workspace, goals —
 * belongs to the onboarding workflow that follows, never to signup.
 *
 * Posts to /api/auth/signup, which handles both Supabase outcomes:
 * a session (email confirmation disabled) or a pending confirmation.
 */
export default function SignupPage() {
  const router = useRouter();
  const { error: configError } = readSupabaseConfig();
  const clientResult = useMemo(() => createClientSafe(), []);
  const supabase = clientResult.client;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  const handleSignup = useCallback(
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
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          requiresConfirmation?: boolean;
          redirectTo?: string;
          message?: string;
        } | null;

        if (!response.ok || !payload?.ok) {
          setError(payload?.error ?? "Account creation failed. Please try again.");
          return;
        }

        if (payload.requiresConfirmation) {
          router.replace(`/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
          return;
        }

        router.replace(payload.redirectTo ?? "/onboarding");
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

  const handleGoogleSignup = useCallback(async () => {
    if (configError) {
      setError(configError);
      return;
    }

    if (!supabase) {
      setError(clientResult.error ?? "Supabase is not configured.");
      return;
    }

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
        setError(oauthError.message ?? "Could not start Google sign-up. Please try again.");
        setGoogleLoading(false);
      }
      // On success the browser navigates away to Google, then back to
      // /auth/callback — nothing else to do here.
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Could not reach the server: ${cause.message}`
          : "Could not reach the server."
      );
      setGoogleLoading(false);
    }
  }, [configError, supabase, clientResult.error]);

  const showConfigError = configError ?? clientResult.error;

  return (
    <AuthLayout
      title="Create your workspace"
      description="Start building a clearer way to work."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary"
          >
            Sign in
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
        onClick={handleGoogleSignup}
        loading={googleLoading}
        disabled={Boolean(showConfigError)}
      >
        <GoogleGlyph />
        Continue with Google
      </Button>

      <Divider label="or" />

      <form onSubmit={handleSignup} noValidate className="flex flex-col gap-4">
        <Field label="Work email" htmlFor="signup-email">
          <Input
            id="signup-email"
            size="lg"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            disabled={loading}
            aria-invalid={error ? true : undefined}
            required
          />
        </Field>

        <Field label="Password" htmlFor="signup-password" hint="At least 6 characters.">
          <Input
            id="signup-password"
            size="lg"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
            autoComplete="new-password"
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
          Create account
        </Button>
      </form>
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
