"use client";

import { FormEvent, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { createClientSafe } from "@/lib/supabase/client";
import { humanizeAuthError, validateCredentials } from "@/lib/auth-errors";
import { cn } from "@/lib/cn";
import { AuthLayout } from "@/components/auth/auth-layout";

/**
 * Create an account.
 *
 * This page collects ONLY the information required to create the account:
 * a work email and a password. Nothing else. The purpose of signup is to
 * create the account — name, username and everything else are completed
 * later, from inside the product, and are never required to enter it.
 *
 * Posts to /api/auth/signup, which handles both Supabase outcomes:
 * a session (email confirmation disabled) or a pending confirmation.
 *
 * VISUAL: Uses the shared NEXUS auth visual system — animated dot-matrix
 * background, cinematic transitions, dark translucent form controls.
 */
export default function SignupPage() {
  const router = useRouter();
  const { error: configError } = readSupabaseConfig();
  const clientResult = useMemo(() => createClientSafe(), []);
  const supabase = clientResult.client;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const passwordMeetsMinimum = password.length >= 6;
  const googleSubmitting = useRef(false);

  const handleSignup = useCallback(
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
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
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

  const handleGoogleSignup = useCallback(async () => {
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

  const showConfigError = configError ?? clientResult.error;

  return (
    <AuthLayout
      title="Create your account"
      description="Start building your workspace with NEXUS."
      footer={
        <>
          Already have an account?{" "}
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
        {showConfigError ? (
          <p className="text-sm text-red-400/90 text-center" role="alert">
            {showConfigError}
          </p>
        ) : null}

        {/* Google — translucent pill, matching sign-in page */}
        <motion.button
          type="button"
          onClick={handleGoogleSignup}
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

        {/* Form — dark translucent controls */}
        <form onSubmit={handleSignup} noValidate className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label htmlFor="signup-email" className="text-caption font-medium text-white/50">
              Work email
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              disabled={loading}
              aria-invalid={error ? true : undefined}
              required
              className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-all duration-200 disabled:opacity-50 placeholder:text-white/25"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signup-password" className="text-caption font-medium text-white/50">
              Password
            </label>
            <div className="relative">
              <input
                id="signup-password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a password"
                autoComplete="new-password"
                disabled={loading}
                aria-invalid={error ? true : undefined}
                required
                className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-full py-3 px-4 pr-12 focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-all duration-200 disabled:opacity-50 placeholder:text-white/25"
              />
            </div>
            <p
              className={cn(
                "flex items-center gap-1.5 text-caption text-white/30",
                passwordMeetsMinimum ? "text-emerald-400/70" : undefined
              )}
              aria-live="polite"
            >
              <Check size={12} strokeWidth={2.25} aria-hidden="true" />
              At least 6 characters
            </p>
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
            {loading ? "Creating account…" : "Create account"}
          </motion.button>

          <p className="mt-2 text-center text-xs text-white/30">
            By creating an account, you agree to our{" "}
            <a
              href="/terms"
              className="underline text-white/40 hover:text-white/60 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="underline text-white/40 hover:text-white/60 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            .
          </p>
        </form>
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
