"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IconEye, IconEyeOff, IconLoader2 } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { createClientSafe } from "@/lib/supabase/client";
import { humanizeAuthError } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/auth/auth-layout";

// ============================================================
// NEXUS — SIGN IN (email + password)
// Google is the only social option — no Apple.
//   * Email + password -> POST /api/auth/signin (server-side session)
//   * Google            -> supabase.auth.signInWithOAuth -> /auth/callback
// ============================================================

export function LoginForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const { error: configError } = readSupabaseConfig();
  const clientResult = useMemo(() => createClientSafe(), []);
  const supabase = clientResult.client;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const submitting = useRef(false);
  const googleSubmitting = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled && data.session) router.replace("/app");
      })
      .catch(() => {
        // A session check must never break the form.
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting.current) return;

      if (configError) {
        setError(configError);
        return;
      }
      if (!email.trim() || !password) {
        setError("Please enter your email and password.");
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
          if (payload?.errorCode === "EMAIL_NOT_CONFIRMED") {
            router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}&type=signup`);
            return;
          }
          setError(payload?.error ?? "Could not sign in.");
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
      // On success the browser navigates away to Google, then back to
      // /auth/callback — keep the spinner and the guard for the whole trip.
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
      title="Hey, Welcome Back"
      description="Sign in to continue to your NEXUS workspace."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="underline text-white/50 hover:text-white/70 transition-colors"
          >
            Sign up
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

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="sr-only">
              Email id
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email id"
              autoComplete="email"
              spellCheck={false}
              disabled={loading}
              required
              className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-[border-color,box-shadow,opacity] duration-200 disabled:opacity-50 placeholder:text-white/35"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="sr-only">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                spellCheck={false}
                disabled={loading}
                required
                className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-full py-3 pl-4 pr-11 focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-[border-color,box-shadow,opacity] duration-200 disabled:opacity-50 placeholder:text-white/35"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/70 disabled:pointer-events-none disabled:opacity-40"
              >
                {showPassword ? (
                  <NexusIcon icon={IconEyeOff} />
                ) : (
                  <NexusIcon icon={IconEye} />
                )}
              </button>
            </div>
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-caption text-white/40 hover:text-white/60 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
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
              <NexusIcon icon={IconLoader2} className="animate-spin" />
            ) : null}
            {loading ? "Signing in…" : "Sign In"}
          </motion.button>
        </form>

        <div className="flex items-center gap-4">
          <div className="h-px bg-white/10 flex-1" />
          <span className="text-white/40 text-sm">or</span>
          <div className="h-px bg-white/10 flex-1" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || Boolean(showConfigError)}
          aria-busy={googleLoading}
          className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-white border border-white/10 rounded-full py-3 px-4 transition-colors"
        >
          {googleLoading ? (
            <NexusIcon icon={IconLoader2} px={18} className="animate-spin" />
          ) : (
            <GoogleGlyph />
          )}
          <span>Continue with Google</span>
        </button>
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
