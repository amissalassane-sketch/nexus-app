"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { validateCredentials } from "@/lib/auth-errors";
import { NexusLogo } from "@/components/nexus-logo";
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
  const router = useRouter();
  const { error: configError } = readSupabaseConfig();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
    <main className="flex min-h-dvh items-center justify-center bg-bg-base px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="rounded-auth border border-border-default bg-bg-subtle p-8 shadow-auth">
          <div className="mb-7 flex flex-col items-center text-center">
            <NexusLogo size={48} priority className="mb-5" />
            <h1 className="text-h1 text-text-primary">Sign in to NEXUS</h1>
            <p className="mt-1 text-small text-text-secondary">
              Enter your details to access your workspace.
            </p>
          </div>

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
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
                required
              />
            </Field>

            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                size="lg"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                required
              />
            </Field>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <Button
              type="submit"
              size="lg"
              disabled={loading || Boolean(configError)}
              aria-busy={loading}
              className="mt-1 w-full"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border-subtle" />
            <span className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
              Nexus
            </span>
            <span className="h-px flex-1 bg-border-subtle" />
          </div>

          <p className="text-center text-small text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary"
            >
              Create one
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center font-mono text-mono uppercase tracking-[0.1em] text-text-quaternary">
          Personal operating system
        </p>
      </div>
    </main>
  );
}
