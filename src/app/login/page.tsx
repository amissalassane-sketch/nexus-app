"use client";

import { FormEvent, Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { validateCredentials } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

/**
 * Sign in.
 * The credentials are posted to /api/auth/signin, which authenticates against
 * Supabase and writes the SSR cookies server-side. This page therefore has a
 * single failure surface, and every outcome is displayed to the user.
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const submitting = useRef(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
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
        redirectTo?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Sign in failed. Please try again.");
        return;
      }

      router.replace(payload.redirectTo ?? "/dashboard");
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
  }

  return (
    <AuthLayout
      title="Sign in to NEXUS"
      description="Enter your details to open your workspace."
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
      {configError ? (
        <Alert tone="danger" className="mb-4">
          {configError}
        </Alert>
      ) : null}

      <form onSubmit={handleLogin} noValidate className="flex flex-col gap-4">
        <Field label="Email address" htmlFor="login-email">
          <Input
            id="login-email"
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
          <Input
            id="login-password"
            size="lg"
            type="password"
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
          disabled={Boolean(configError)}
          className="mt-1 w-full"
        >
          Continue with email
        </Button>
      </form>
    </AuthLayout>
  );
}
