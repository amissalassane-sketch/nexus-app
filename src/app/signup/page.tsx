"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { validateCredentials, validateUsername } from "@/lib/auth-errors";
import { NexusLogo } from "@/components/nexus-logo";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

/**
 * Create an account.
 * Posts to /api/auth/signup, which handles both Supabase outcomes:
 * a session (email confirmation disabled) or a pending confirmation.
 */
export default function SignupPage() {
  const router = useRouter();
  const { error: configError } = readSupabaseConfig();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    if (configError) {
      setError(configError);
      return;
    }

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    const credentialsError = validateCredentials(email, password);
    if (credentialsError) {
      setError(credentialsError);
      return;
    }

    submitting.current = true;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, username, email, password }),
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
        setMessage(
          payload.message ??
            "Account created. Confirm your email address, then sign in."
        );
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
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-base px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="rounded-auth border border-border-default bg-bg-subtle p-8 shadow-auth">
          <div className="mb-7 flex flex-col items-center text-center">
            <NexusLogo size={48} priority className="mb-5" />
            <h1 className="text-h1 text-text-primary">Create your NEXUS</h1>
            <p className="mt-1 text-small text-text-secondary">
              Start building your personal operating system.
            </p>
          </div>

          {configError ? (
            <Alert tone="danger" className="mb-4">
              {configError}
            </Alert>
          ) : null}

          <form onSubmit={handleSignup} noValidate className="flex flex-col gap-4">
            <Field label="Full name" htmlFor="signup-name">
              <Input
                id="signup-name"
                size="lg"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                disabled={loading}
                required
              />
            </Field>

            <Field label="Username" htmlFor="signup-username">
              <Input
                id="signup-username"
                size="lg"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="yourusername"
                autoComplete="username"
                disabled={loading}
                required
              />
            </Field>

            <Field label="Email" htmlFor="signup-email">
              <Input
                id="signup-email"
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

            <Field label="Password" htmlFor="signup-password" hint="Minimum 6 characters">
              <Input
                id="signup-password"
                size="lg"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
                required
              />
            </Field>

            {error ? <Alert tone="danger">{error}</Alert> : null}
            {message ? <Alert tone="success">{message}</Alert> : null}

            <Button
              type="submit"
              size="lg"
              disabled={loading || Boolean(configError)}
              aria-busy={loading}
              className="mt-1 w-full"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-small text-text-secondary">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary"
            >
              Sign in
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
