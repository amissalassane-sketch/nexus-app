"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Field } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { error: configError } = readSupabaseConfig();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    if (configError) {
      setError(configError);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    submitting.current = true;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Could not update the password.");
        return;
      }

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
  }

  return (
    <AuthLayout
      title="Choose a new password"
      description="You arrived from a reset link. Set a new password to continue."
      footer={
        <>
          Link expired?{" "}
          <Link
            href="/forgot-password"
            className="text-text-primary underline decoration-border-strong underline-offset-4"
          >
            Request a new one
          </Link>
        </>
      }
    >
      {configError ? (
        <Alert tone="danger" className="mb-4">
          {configError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field
          label="New password"
          htmlFor="reset-password"
          hint="At least 6 characters."
        >
          <PasswordInput
            id="reset-password"
            name="password"
            size="lg"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            disabled={loading}
            required
          />
        </Field>

        <Field label="Confirm password" htmlFor="reset-confirm">
          <PasswordInput
            id="reset-confirm"
            name="confirm-password"
            size="lg"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Repeat the password"
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
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
