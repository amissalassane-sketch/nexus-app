"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { createClientSafe } from "@/lib/supabase/client";
import { humanizeAuthError, validateCredentials } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/auth/auth-layout";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Sign in (email + password variant).
 *
 * Optimised for EXISTING USERS. Posts to /api/auth/signin.
 *
 * NOTE: This component is not currently used — the /login page renders
 * the OTP-based sign-in flow (sign-in-flow-1.tsx). Kept here for
 * completeness and future use.
 *
 * VISUAL: Uses the shared NEXUS auth visual system — animated dot-matrix
 * background, cinematic transitions, dark translucent form controls.
 */
export function LoginPageClient({ initialError = "" }: { initialError?: string }) {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Welcome back" description="">
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
      <LoginForm initialError={initialError} />
    </Suspense>
  );
}

function LoginForm({ initialError }: { initialError: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: configError } = readSupabaseConfig();
  const clientResult = useMemo(() => createClientSafe(), []);
  const supabase = clientResult.client;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState(initialError || (searchParams.get("error") ?? ""));
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const submitting = useRef(false);
  const resendSubmitting = useRef(false);
  const googleSubmitting = useRef(false);
  const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  const startResendCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    cooldownInterval.current = setInterval(() => {
      setResendCooldown((value) => {
        if (value <= 1) {
          if (cooldownInterval.current) clearInterval(cooldownInterval.current);
          cooldownInterval.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, []);

  const handleLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting.current) return;

      if (configError) {
        setError(configError);
        return;
      }

      const validationError = validateCredentials(email, password);
      if (validationError) {
        setError(validationError);
        return;
      }

      submitting.current = true;
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          errorCode?: string;
          redirectTo?: string;
        } | null;

        if (!response.ok || !payload?.ok) {
          const isUnverified = payload?.errorCode === "EMAIL_NOT_CONFIRMED";
          setError(payload?.error ?? "Sign in failed. Please try again.");
          setNeedsVerification(isUnverified);
          setVerificationMessage("");
          return;
        }

        setNeedsVerification(false);
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
    },
    [configError, email, password, router]
  );

  const handleGoogleLogin = useCallback(async () => {
    if (googleSubmitting.current) return;

    if (configError) {
      setError(configError);
      return;
    }

    if (!supabase) {
      setError(clientResult.error ?? "Supabase is not configured.");
      return;
    }

    googleSubmitting.current = true;
    setGoogleLoading(true);
    setError("");

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?source=oauth`,
          queryParams: { prompt: "select_account" },
        },
      });

      if (oauthError) {
        setError(humanizeAuthError(oauthError));
        googleSubmitting.current = false;
        setGoogleLoading(false);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Could not reach the server: ${cause.message}`
          : "Could not reach the server."
      );
      googleSubmitting.current = false;
      setGoogleLoading(false);
    }
  }, [configError, supabase, clientResult.error]);

  const handleResendVerification = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (resendSubmitting.current || resendCooldown > 0) return;

      if (configError) {
        setError(configError);
        return;
      }

      if (!email.trim()) {
        setError("Please enter your email address.");
        return;
      }

      resendSubmitting.current = true;
      setResendLoading(true);
      setError("");
      setVerificationMessage("");

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

        setVerificationMessage(
          "Verification email sent. Check your inbox and follow the verification link."
        );
        startResendCooldown();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `Could not reach the server: ${cause.message}`
            : "Could not reach the server."
        );
      } finally {
        resendSubmitting.current = false;
        setResendLoading(false);
      }
    },
    [configError, email, resendCooldown, startResendCooldown]
  );

  const showConfigError = configError ?? clientResult.error;

  return (
    <AuthLayout
      title="Welcome back"
      description="Continue where you left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="underline text-white/50 hover:text-white/70 transition-colors"
          >
            Create one
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {showConfigError ? (
          <p className="text-sm text-red-400/90 text-center" role="alert">
            {showConfigError}
          </p>
        ) : null}

        {/* Google — translucent pill */}
        <motion.button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || Boolean(showConfigError)}
          aria-busy={googleLoading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.2 }}
          className="backdrop-blur-[2px] w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-white border border-white/10 rounded-full py-3 px-4 transition-colors"
        >
          {googleLoading ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <GoogleGlyph />
          )}
          <span>Continue with Google</span>
        </motion.button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="h-px bg-white/10 flex-1" />
          <span className="text-white/40 text-sm">or</span>
          <div className="h-px bg-white/10 flex-1" />
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} noValidate className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-caption font-medium text-white/50">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="username"
              disabled={loading}
              required
              className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-all duration-200 disabled:opacity-50 placeholder:text-white/25"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="login-password" className="text-caption font-medium text-white/50">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-caption text-white/30 transition-colors hover:text-white/50"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
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

          <motion.button
            type="submit"
            disabled={loading || Boolean(showConfigError)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.2 }}
            className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : null}
            {loading ? "Signing in…" : "Log in"}
          </motion.button>
        </form>

        {needsVerification ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="pt-4 border-t border-white/[0.06]"
          >
            <p className="mb-3 text-center text-sm text-white/40">
              Didn&apos;t receive the verification email?
            </p>
            <form onSubmit={handleResendVerification} noValidate>
              {verificationMessage ? (
                <p className="mb-3 text-sm text-emerald-400/80 text-center" role="status">
                  {verificationMessage}
                </p>
              ) : null}

              <motion.button
                type="submit"
                disabled={resendLoading || Boolean(showConfigError) || resendCooldown > 0}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.2 }}
                className="w-full rounded-full bg-white/[0.05] backdrop-blur-[2px] text-white/70 border border-white/10 font-medium py-3 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {resendLoading ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : null}
                {resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : resendLoading
                    ? "Sending verification email…"
                    : "Resend verification email"}
              </motion.button>
            </form>
          </motion.div>
        ) : null}
      </div>
    </AuthLayout>
  );
}

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 5.1 29.3 3 24 3 16.3 3 9.6 7.1 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9.5 40.9 16.2 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C40.8 35.9 45 30.6 45 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
