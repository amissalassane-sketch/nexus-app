"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { AuthLayout } from "@/components/auth/auth-layout";

/**
 * Password recovery — request a reset link.
 *
 * VISUAL: Uses the shared NEXUS auth visual system — animated dot-matrix
 * background, cinematic transitions, dark translucent form controls.
 */
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
    <AuthLayout
      title="Reset your password"
      description="Enter the email on your account. If it exists, a reset link is on its way."
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
            <label htmlFor="forgot-email" className="text-caption font-medium text-white/50">
              Email address
            </label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              disabled={loading}
              required
              className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-all duration-200 disabled:opacity-50 placeholder:text-white/25"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-400/90 text-center" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-emerald-400/80 text-center" role="status">
              {message}
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
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : null}
            {loading ? "Sending…" : "Send reset link"}
          </motion.button>
        </form>
      </div>
    </AuthLayout>
  );
}
