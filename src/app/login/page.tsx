"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientSafe } from "@/lib/supabase/client";
import { NexusLogo } from "@/components/nexus-logo";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  // Never throws during render: a missing/incorrect .env.local shows a real
  // message instead of a blank page with a form that "does nothing".
  const { client: supabase, error: configError } = useMemo(
    () => createClientSafe(),
    []
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Guard against double submission (double click / Enter spam).
    if (submitting.current) return;

    if (!supabase) {
      setError(configError ?? "Supabase is not configured.");
      return;
    }

    submitting.current = true;
    setLoading(true);
    setError("");

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === "Email not confirmed"
            ? "This email address has not been confirmed yet. Check your inbox, or disable email confirmation in Supabase → Authentication → Providers."
            : signInError.message
        );
        return;
      }

      if (!data.session) {
        setError(
          "Sign in succeeded but Supabase returned no session. If email confirmation is enabled, confirm your address first."
        );
        return;
      }

      // Hand the tokens to the server so SSR cookies exist before we navigate.
      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      });

      // A redirect here would mean the request never reached the route
      // handler (proxy misconfiguration) — treat it as a failure instead of
      // navigating to a page that will bounce back to /login.
      if (sessionResponse.redirected || !sessionResponse.ok) {
        const payload = (await sessionResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          payload?.error ??
            "Session could not be synchronized with the server. Please try again."
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      // Network failure, wrong project URL, CORS, offline...
      setError(
        cause instanceof Error
          ? `Could not reach Supabase: ${cause.message}`
          : "Could not reach Supabase."
      );
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4 py-10">
      <div className="w-full max-w-[400px] rounded-auth border border-border-default bg-bg-subtle p-8 shadow-auth">
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

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
    </main>
  );
}
