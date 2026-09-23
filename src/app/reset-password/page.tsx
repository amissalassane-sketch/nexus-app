"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IconLoader2 } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PasswordInput } from "@/components/ui/password-input";

/**
 * Password reset — set a new password after following a reset link.
 *
 * VISUAL: Uses the shared NEXUS auth visual system — animated dot-matrix
 * background, cinematic transitions, dark translucent form controls.
 */
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
      title="Create New password"
      description="Your new password must be different from previously used password"
      footer={
        <>
          Link expired?{" "}
          <Link
            href="/forgot-password"
            className="underline text-white/50 hover:text-white/70 transition-colors"
          >
            Request a new one
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {configError ? (
          <p className="text-sm text-red-400/90 text-center" role="alert">
            {configError}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label htmlFor="reset-password" className="sr-only">
              New password
            </label>
            <PasswordInput
              id="reset-password"
              name="password"
              shape="pill"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              spellCheck={false}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reset-confirm" className="sr-only">
              Confirm password
            </label>
            <PasswordInput
              id="reset-confirm"
              name="confirm-password"
              shape="pill"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              spellCheck={false}
              disabled={loading}
              required
            />
          </div>

          {error ? (
            <p className="text-sm text-red-400/90 text-center" role="alert">
              {error}
            </p>
          ) : null}

          <motion.button
            type="submit"
            disabled={loading || Boolean(configError)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.2 }}
            className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <NexusIcon icon={IconLoader2} className="animate-spin" />
            ) : null}
            {loading ? "Saving…" : "Save"}
          </motion.button>
        </form>
      </div>
    </AuthLayout>
  );
}
