"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { AuthLayout } from "@/components/auth/auth-layout";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Post-signup verification gate.
 *
 * Shown after an email+password sign-up that requires confirmation. The user
 * must open the link we sent before they can sign in. They never have to
 * restart sign-up from here: they can resend the email (rate-limited) or go
 * back and use a different address.
 *
 * VISUAL: Uses the shared NEXUS auth visual system — animated dot-matrix
 * background, cinematic transitions, dark translucent form controls.
 */
export function CheckEmailPageClient({
  initialEmail = "",
}: {
  /** Server-read ?email= — guarantees the address is in the initial HTML. */
  initialEmail?: string;
}) {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Check your inbox" description="">
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="skeleton h-11 rounded-full" />
            <div className="skeleton h-11 rounded-full" />
          </div>
          <p className="sr-only" role="status">
            Loading
          </p>
        </AuthLayout>
      }
    >
      <CheckEmailInner initialEmail={initialEmail} />
    </Suspense>
  );
}

function CheckEmailInner({ initialEmail }: { initialEmail: string }) {
  const params = useSearchParams();
  const email = (initialEmail || params.get("email"))?.trim() ?? "";
  const { error: configError } = readSupabaseConfig();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    cooldownInterval.current = setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          if (cooldownInterval.current) clearInterval(cooldownInterval.current);
          cooldownInterval.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, []);

  const handleResend = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (cooldown > 0 || loading) return;

      if (configError) {
        setError(configError);
        return;
      }

      if (!email.trim()) {
        setError("Please enter your email address.");
        return;
      }

      setLoading(true);
      setError("");
      setMessage("");

      try {
        const response = await fetch("/api/auth/resend-confirmation", {
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
          setError(payload?.error ?? "Could not resend the email.");
          return;
        }

        setMessage(
          "Verification email sent. Check your inbox and follow the verification link."
        );
        startCooldown();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `Could not reach the server: ${cause.message}`
            : "Could not reach the server."
        );
      } finally {
        setLoading(false);
      }
    },
    [cooldown, loading, configError, email, startCooldown]
  );

  return (
    <AuthLayout
      title="Check your inbox"
      description="Verify your email address to finish creating your NEXUS account."
      footer={
        <>
          Wrong address?{" "}
          <Link
            href="/signup"
            className="underline text-white/50 hover:text-white/70 transition-colors"
          >
            Create another account
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {configError ? (
          <p className="text-sm text-red-400/90 text-center" role="alert">
            {configError}
          </p>
        ) : null}

        {email ? (
          <p className="text-center text-sm text-white/50">
            We sent a NEXUS verification link to{" "}
            <span className="text-white font-medium">{email}</span>. Open it to
            verify your address and continue.
          </p>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href="/login"
            className="block w-full rounded-full bg-white text-black font-medium py-3 text-center hover:bg-white/90 transition-colors"
          >
            Back to sign in
          </Link>
        </motion.div>

        <form onSubmit={handleResend} className="mt-2">
          <button
            type="submit"
            disabled={cooldown > 0 || loading || Boolean(configError)}
            className="mx-auto block text-center text-sm text-white/40 underline underline-offset-4 decoration-white/20 transition-colors hover:text-white/60 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
          >
            {cooldown > 0
              ? `Resend available in ${cooldown}s`
              : loading
                ? "Sending verification email…"
                : "Didn't receive it? Resend verification email"}
          </button>
        </form>

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
      </div>
    </AuthLayout>
  );
}
