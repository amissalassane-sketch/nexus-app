"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IconLoader2 } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Input } from "@/components/ui/input";

/**
 * Password recovery — request a reset link.
 *
 * VISUAL: Uses the shared NEXUS auth visual system — animated dot-matrix
 * background, cinematic transitions, dark translucent form controls.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const { error: configError } = readSupabaseConfig();

  const [email, setEmail] = useState("");
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

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    const targetEmail = email.trim().toLowerCase();

    submitting.current = true;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Could not send the code.");
        return;
      }

      router.push(`/verify-email?email=${encodeURIComponent(targetEmail)}&type=recovery`);
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
      title="Forget Password?"
      description="Enter your email address"
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="underline text-white/50 hover:text-white/70 transition-colors"
          >
            Sign in
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
            <label htmlFor="forgot-email" className="sr-only">
              Email
            </label>
            <Input
              id="forgot-email"
              name="email"
              type="email"
              shape="pill"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
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
            {loading ? "Sending…" : "Send"}
          </motion.button>
        </form>
      </div>
    </AuthLayout>
  );
}
