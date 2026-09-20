"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { IconLoader2 } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { AuthLayout } from "@/components/auth/auth-layout";

const RESEND_COOLDOWN_SECONDS = 60;

type Reason =
  | "expired"
  | "already-used"
  | "invalid"
  | "missing"
  | "unknown";

const REASON_COPY: Record<Reason, { title: string; description: string }> = {
  expired: {
    title: "This verification link has expired.",
    description:
      "Request a new verification link to continue creating your NEXUS account.",
  },
  "already-used": {
    title: "This verification link is no longer valid.",
    description:
      "The link may have already been used or expired. Sign in if you've already verified your email.",
  },
  invalid: {
    title: "This verification link is no longer valid.",
    description:
      "The link may have expired, already been used, or is malformed.",
  },
  missing: {
    title: "We couldn't verify your email.",
    description:
      "The verification link is missing or incomplete. Request a new one below.",
  },
  unknown: {
    title: "This verification link is no longer valid.",
    description:
      "The link may have expired or already been used. Request a new one to continue.",
  },
};

/**
 * Branded state for a verification link that could not be used.
 *
 * VISUAL: Uses the shared NEXUS auth visual system — animated dot-matrix
 * background, cinematic transitions, dark translucent form controls.
 */
export function ConfirmErrorPageClient({ initialReason = "" }: { initialReason?: string }) {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Email verification" description="">
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
      <ConfirmErrorInner initialReason={initialReason} />
    </Suspense>
  );
}

function ConfirmErrorInner({ initialReason }: { initialReason: string }) {
  const params = useSearchParams();
  const rawReason = initialReason || (params.get("reason") ?? "unknown");
  const reason: Reason = Object.prototype.hasOwnProperty.call(REASON_COPY, rawReason)
    ? (rawReason as Reason)
    : "unknown";
  const copy = REASON_COPY[reason];

  const { error: configError } = readSupabaseConfig();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const submitting = useRef(false);
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
      if (submitting.current || cooldown > 0 || loading) return;

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
          setError(payload?.error ?? "Could not resend the verification email.");
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
        submitting.current = false;
        setLoading(false);
      }
    },
    [configError, email, cooldown, loading, startCooldown]
  );

  return (
    <AuthLayout
      title="Email verification"
      description={copy.description}
      footer={
        <>
          Already verified?{" "}
          <Link
            href="/login"
            className="underline text-white/50 hover:text-white/70 transition-colors"
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-lg font-semibold text-white text-center"
        >
          {copy.title}
        </motion.h2>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="block w-full rounded-full bg-white text-black font-medium py-3 text-center hover:bg-white/90 transition-colors"
          >
            Return to sign in
          </Link>
          <Link
            href="/signup"
            className="block w-full rounded-full bg-white/[0.05] backdrop-blur-[2px] text-white/70 border border-white/10 font-medium py-3 text-center hover:bg-white/10 transition-colors"
          >
            Create account
          </Link>
        </div>

        <div className="pt-4 border-t border-white/[0.06]">
          <p className="mb-3 text-center text-sm text-white/40">
            Didn&apos;t receive the email?
          </p>
          <form onSubmit={handleResend} noValidate className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label htmlFor="confirm-error-email" className="text-caption font-medium text-white/50">
                Email address
              </label>
              <input
                id="confirm-error-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                disabled={loading}
                required
                className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-[border-color,box-shadow,opacity] duration-200 disabled:opacity-50 placeholder:text-white/25"
              />
            </div>

            {configError ? (
              <p className="text-sm text-red-400/90 text-center" role="alert">
                {configError}
              </p>
            ) : error ? (
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
              disabled={loading || Boolean(configError) || cooldown > 0}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <NexusIcon icon={IconLoader2} className="animate-spin" />
              ) : null}
              {cooldown > 0
                ? `Resend available in ${cooldown}s`
                : loading
                  ? "Sending verification email…"
                  : "Resend verification email"}
            </motion.button>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
}
