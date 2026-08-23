"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { validateCredentials, validateUsername } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/auth/auth-layout";
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
  }

  return (
    <AuthLayout
      title="Create your NEXUS account"
      description="Set up a workspace and NEXUS starts reading the work inside it."
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

        <Field
          label="Username"
          htmlFor="signup-username"
          hint="Used to identify you inside a workspace."
        >
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

        <Field label="Email address" htmlFor="signup-email">
          <Input
            id="signup-email"
            size="lg"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            disabled={loading}
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="signup-password"
          hint="At least 6 characters."
        >
          <Input
            id="signup-password"
            size="lg"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
            autoComplete="new-password"
            disabled={loading}
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
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
