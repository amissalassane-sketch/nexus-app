"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NexusLogo } from "@/components/nexus-logo";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError(
        "Sign in succeeded, but no browser session was created. Please try again."
      );
      setLoading(false);
      return;
    }

    const sessionResponse = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }),
    });

    if (!sessionResponse.ok) {
      const payload = (await sessionResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Session could not be synchronized with the server.");
      setLoading(false);
      return;
    }

    window.location.assign(new URL("/", window.location.origin).toString());
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
              required
            />
          </Field>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button
            type="submit"
            size="lg"
            disabled={loading}
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
