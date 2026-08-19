"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { NexusLogo } from "@/components/nexus-logo";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const { error: configError } = readSupabaseConfig();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

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
      const response = await fetch("/api/auth/forgot-password", {
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
        setError(payload?.error ?? "Could not send the reset email.");
        return;
      }

      setMessage(
        payload.message ??
          "If an account exists for this address, a reset link is on its way."
      );
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
            <h1 className="text-h1 text-text-primary">Reset your password</h1>
            <p className="mt-1 text-small text-text-secondary">
              Enter the email on your account. We will send a reset link if it exists.
            </p>
          </div>

          {configError ? (
            <Alert tone="danger" className="mb-4">
              {configError}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <Field label="Email address" htmlFor="forgot-email">
              <Input
                id="forgot-email"
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

            {error ? <Alert tone="danger">{error}</Alert> : null}
            {message ? <Alert tone="success">{message}</Alert> : null}

            <Button
              type="submit"
              size="lg"
              disabled={loading || Boolean(configError)}
              aria-busy={loading}
              className="mt-1 w-full"
            >
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <p className="mt-6 text-center text-small text-text-secondary">
            Remembered it?{" "}
            <Link
              href="/login"
              className="text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
