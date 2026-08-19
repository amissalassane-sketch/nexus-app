"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NexusLogo } from "@/components/nexus-logo";

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
      setError("Sign in succeeded, but no browser session was created. Please try again.");
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
      const payload = (await sessionResponse.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Session could not be synchronized with the server.");
      setLoading(false);
      return;
    }

    window.location.assign(new URL("/", window.location.origin).toString());
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-5 py-10 text-text-primary">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex justify-center text-text-primary">
            <NexusLogo size={40} />
          </div>

          <h1 className="text-h1 font-semibold">
            Welcome to NEXUS
          </h1>

          <p className="mt-2 text-small text-text-secondary">
            Your personal operating system.
          </p>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-surface p-6 shadow-md">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-label text-text-secondary">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="w-full min-h-11 rounded-md border border-border-default bg-bg-subtle px-3 text-body text-text-primary outline-none transition-all duration-[160ms] ease-out placeholder:text-text-quaternary focus:border-border-focus"
              />
            </div>

            <div>
              <label className="mb-2 block text-label text-text-secondary">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                className="w-full min-h-11 rounded-md border border-border-default bg-bg-subtle px-3 text-body text-text-primary outline-none transition-all duration-[160ms] ease-out placeholder:text-text-quaternary focus:border-border-focus"
              />
            </div>

            {error && (
              <div className="animate-fade-in rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-small text-danger-fg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-11 rounded-md bg-accent-primary px-4 py-3 text-button font-medium text-accent-primary-fg transition-all duration-[120ms] ease-out hover:bg-accent-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-transparent disabled:text-text-tertiary"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border-default" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-quaternary">NEXUS</span>
            <div className="h-px flex-1 bg-border-default" />
          </div>

          <p className="text-center text-small text-text-secondary">
            Don&apos;t have an account?{" "}
            <a
              href="/signup"
              className="text-text-primary underline decoration-border-strong underline-offset-4 transition-colors duration-[120ms] hover:decoration-text-primary"
            >
              Create one
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
