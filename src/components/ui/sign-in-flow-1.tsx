"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { createClientSafe } from "@/lib/supabase/client";
import { humanizeAuthError } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";

// ============================================================
// NEXUS — SIGN-IN FLOW (21st.dev design, navbar removed)
//
// Visual identity of the original component, minus the MiniNavbar:
// fullscreen animated dot-matrix WebGL background, centred form,
// Google button, "or" divider, email field with the circular arrow
// button, six-digit code step, success choreography, legal footer.
//
// NO fake demo: every action runs through the EXISTING NEXUS
// Supabase auth system.
//   * Google  -> supabase.auth.signInWithOAuth -> /auth/callback
//   * Email   -> supabase.auth.signInWithOtp (6-digit code)
//   * Code    -> supabase.auth.verifyOtp (verified by Supabase,
//                never accepted blindly)
//   * Success -> /app, the canonical NEXUS post-auth destination
//     (which redirects to /dashboard), same as every other
//     authentication entry point in the codebase.
//
// Uses the shared NexusAuthBackground for the animated dot-matrix
// canvas environment — the same visual layer that wraps every
// other auth page in the product.
// ============================================================

// Shared background — SSR-safe dynamic import.
const NexusAuthBackground = dynamic(
  () =>
    import("@/components/ui/nexus-auth-background").then(
      (mod) => mod.NexusAuthBackground
    ),
  { ssr: false }
);

const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SignInPageProps {
  className?: string;
  /**
   * Error read server-side from ?error= (set when a failed OAuth exchange
   * bounces the visitor back to /login) — same contract as before.
   */
  initialError?: string;
}

type Step = "email" | "code" | "success";

/**
 * Maps a failed verifyOtp exchange onto an actionable message.
 * Receives the full Supabase error (code + message) so both legacy GoTrue
 * phrasing and the newer structured codes are covered. Never surfaces raw
 * GoTrue text to the user.
 */
function classifyOtpError(error: {
  message?: string | null;
  code?: string | null;
}): { text: string; expired: boolean } {
  const key = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

  // Expired / no-longer-valid code (supabase: "otp_expired").
  if (
    key.includes("otp_expired") ||
    key.includes("expired") ||
    key.includes("expiration")
  ) {
    return { text: "This code has expired. Request a new one.", expired: true };
  }

  // Verification rate limit / too many failed attempts. Supabase either
  // returns 429 ("Too many requests") or invalidates the token after the
  // attempt budget is exhausted.
  if (
    key.includes("otp_verification_rate_limit") ||
    key.includes("too many requests") ||
    key.includes("too many attempts") ||
    key.includes("rate limit")
  ) {
    return {
      text: "Too many attempts. Wait a moment and request a new code.",
      expired: false,
    };
  }

  // Invalid / mismatched code (supabase: "otp_invalid", "token has expired
  // or is invalid").
  return {
    text: "That code is incorrect. Check your email and try again.",
    expired: false,
  };
}

export const SignInPage = ({ className, initialError = "" }: SignInPageProps) => {
  const router = useRouter();
  const { error: configError } = readSupabaseConfig();
  const clientResult = useMemo(() => createClientSafe(), []);
  const supabase = clientResult.client;

  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [reverseCanvasVisible, setReverseCanvasVisible] = useState(false);
  const [initialCanvasVisible, setInitialCanvasVisible] = useState(true);

  const submitting = useRef(false);
  const googleSubmitting = useRef(false);
  const resendSubmitting = useRef(false);
  const successTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const resendInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timers = successTimers.current;
    const interval = resendInterval.current;
    return () => {
      timers.forEach(clearTimeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  // Existing session (e.g. signed in from another tab) -> straight to the
  // product. The proxy middleware already does this server-side; this covers
  // the client-only window.
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

  // Focus first input when code screen appears
  useEffect(() => {
    if (step === "code") {
      const timer = setTimeout(() => {
        codeInputRefs.current[0]?.focus();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const startResendCooldown = useCallback(() => {
    if (resendInterval.current) clearInterval(resendInterval.current);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    resendInterval.current = setInterval(() => {
      setResendCooldown((value) => {
        if (value <= 1) {
          if (resendInterval.current) clearInterval(resendInterval.current);
          resendInterval.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, []);

  // ------------------------------------------------------------------
  // Step 1 — email: request a real 6-digit OTP from Supabase.
  // ------------------------------------------------------------------
  const requestOtp = useCallback(
    async (targetEmail: string) => {
      if (!supabase) {
        setError(clientResult.error ?? "Supabase is not configured.");
        return false;
      }
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: {
          // New and existing users share the same path: Supabase creates the
          // account when it does not exist, and simply sends the code when it
          // does. The NEXUS OTP screen never needs to branch on this.
          shouldCreateUser: true,
          // If the user clicks the fallback link inside the email instead of
          // typing the code, it must land on the canonical NEXUS exchange
          // endpoint (which verifies the token_hash server-side and routes
          // to /app) — never on Supabase's own confirmation page.
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (otpError) {
        setError(humanizeAuthError(otpError));
        return false;
      }
      return true;
    },
    [supabase, clientResult.error]
  );

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting.current) return;

      if (configError) {
        setError(configError);
        return;
      }

      const targetEmail = email.trim().toLowerCase();
      if (!targetEmail) {
        setError("Please enter your email address.");
        return;
      }
      if (!EMAIL_PATTERN.test(targetEmail)) {
        setError("This email address is not valid.");
        return;
      }

      submitting.current = true;
      setLoading(true);
      setError("");
      setNotice("");

      try {
        const sent = await requestOtp(targetEmail);
        if (!sent) return;

        setSubmittedEmail(targetEmail);
        setStep("code");
        setAnnouncement(
          `Verification code sent to ${targetEmail}. Enter the 6-digit code to continue.`
        );
        startResendCooldown();
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
    [configError, email, requestOtp, startResendCooldown]
  );

  // ------------------------------------------------------------------
  // Step 2 — code: verified by Supabase (verifyOtp), never locally.
  // ------------------------------------------------------------------
  const handleCodeComplete = useCallback(
    async (digits: string[]) => {
      if (verifying || digits.some((digit) => digit === "")) return;

      if (!supabase) {
        setError(clientResult.error ?? "Supabase is not configured.");
        return;
      }

      setVerifying(true);
      setError("");
      setAnnouncement("Verifying your code…");

      try {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: submittedEmail,
          token: digits.join(""),
          type: "email",
        });

        if (verifyError) {
          const { text } = classifyOtpError(verifyError);
          setError(text);
          setCode(["", "", "", "", "", ""]);
          setAnnouncement(text);
          setVerifying(false);
          setTimeout(() => codeInputRefs.current[0]?.focus(), 50);
          return;
        }

        // Supabase accepted the code but did not issue a session — surface an
        // elegant failure instead of redirecting into an unauthenticated loop.
        if (!data.session) {
          setError("We couldn't start your session. Please try again.");
          setAnnouncement("We couldn't start your session. Please try again.");
          setCode(["", "", "", "", "", ""]);
          setVerifying(false);
          setTimeout(() => codeInputRefs.current[0]?.focus(), 50);
          return;
        }

        // Verified by Supabase: run the original success choreography
        // (reverse canvas sweep -> success step), then land where every
        // NEXUS auth entry point lands: /app -> /dashboard.
        if (resendInterval.current) clearInterval(resendInterval.current);
        resendInterval.current = null;
        setResendCooldown(0);
        setAnnouncement("Signed in. Taking you to NEXUS…");
        setReverseCanvasVisible(true);

        const hideInitial = setTimeout(() => {
          setInitialCanvasVisible(false);
        }, 50);

        const showSuccess = setTimeout(() => {
          setStep("success");
        }, 1400);

        const redirect = setTimeout(() => {
          router.replace("/app");
          router.refresh();
        }, 3000);

        successTimers.current.push(hideInitial, showSuccess, redirect);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `Could not reach the server: ${cause.message}`
            : "Could not reach the server."
        );
      } finally {
        setVerifying(false);
      }
    },
    [verifying, supabase, clientResult.error, submittedEmail, router]
  );

  // Distribute (possibly multi-character) input across the six boxes.
  // Accepts typing, mobile-keyboard autofill and SMS autofill that drops the
  // whole code into a single field. Non-digits are stripped; length is capped.
  const handleCodeChange = (index: number, value: string) => {
    if (verifying) return;

    const digits = value.replace(/\D/g, "").slice(0, 6 - index);
    const next = [...code];

    if (digits.length === 0) {
      next[index] = "";
    } else {
      for (let i = 0; i < digits.length; i += 1) {
        next[index + i] = digits[i];
      }
    }

    setCode(next);

    if (digits.length === 0) {
      // Clearing the current box keeps focus where the user already is.
      codeInputRefs.current[index]?.focus();
    } else {
      // After entering/pasting digits, land on the next empty box (or stay
      // on the last filled one when all six are filled).
      const nextEmpty = next.findIndex((digit) => digit === "");
      codeInputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    }

    if (next.every((digit) => digit !== "")) {
      void handleCodeComplete(next);
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  // Paste a full (or partial) code. Handles the "123456" clipboard case and
  // formats like "123 456" that some clients add.
  const handleCodePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (verifying) return;
    const text = e.clipboardData.getData("text");
    const digits = text.replace(/\D/g, "").slice(0, 6);
    if (!digits) return;

    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, i) => digits[i] ?? "");
    setCode(next);

    if (next.every((digit) => digit !== "")) {
      void handleCodeComplete(next);
    } else {
      const nextEmpty = next.findIndex((digit) => digit === "");
      codeInputRefs.current[nextEmpty]?.focus();
    }
  };

  const handleResendCode = useCallback(async () => {
    if (resendSubmitting.current || resendCooldown > 0) return;
    if (!submittedEmail) return;

    resendSubmitting.current = true;
    setResendLoading(true);
    setError("");
    setNotice("");

    try {
      const sent = await requestOtp(submittedEmail);
      if (!sent) return;

      setCode(["", "", "", "", "", ""]);
      setNotice("Code sent again.");
      setAnnouncement(`A new code was sent to ${submittedEmail}.`);
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
  }, [resendCooldown, submittedEmail, requestOtp, startResendCooldown]);

  const handleBackClick = () => {
    // Going back never destroys an authenticated session: a session is only
    // created after verifyOtp succeeds (on the success step, where Back is
    // not shown). Reset the code UI and stop any pending cooldown.
    if (resendInterval.current) clearInterval(resendInterval.current);
    resendInterval.current = null;
    setResendCooldown(0);
    setStep("email");
    setCode(["", "", "", "", "", ""]);
    setError("");
    setNotice("");
    setAnnouncement("");
    // Reset animations if going back
    setReverseCanvasVisible(false);
    setInitialCanvasVisible(true);
  };

  // ------------------------------------------------------------------
  // Google — the exact OAuth flow already used across NEXUS.
  // ------------------------------------------------------------------
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
  const codeComplete = code.every((d) => d !== "");

  return (
    <div
      className={cn(
        "flex w-[100%] flex-col min-h-dvh bg-black relative",
        className
      )}
    >
      <div className="absolute inset-0 z-0">
        {/* Animated dot-matrix environment — same component as every auth page */}
        {initialCanvasVisible && (
          <NexusAuthBackground variant="forward" animationSpeed={3} />
        )}

        {/* Reverse sweep when OTP is verified */}
        {reverseCanvasVisible && (
          <NexusAuthBackground variant="reverse" animationSpeed={4} />
        )}
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-1 flex-col justify-center items-center px-6">
        {/* Screen-reader status announcements — errors use role="alert" below. */}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {step === "email" ? (
              <motion.div
                key="email-step"
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-6 text-center"
              >
                <div className="space-y-1">
                  <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                    Welcome to NEXUS
                  </h1>
                  <p className="text-[1.8rem] text-white/70 font-light">
                    Operational intelligence for modern teams
                  </p>
                </div>

                {showConfigError ? <ErrorLine message={showConfigError} /> : null}

                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading || Boolean(showConfigError)}
                    aria-busy={googleLoading}
                    className="backdrop-blur-[2px] w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-white border border-white/10 rounded-full py-3 px-4 transition-colors"
                  >
                    {googleLoading ? (
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <GoogleGlyph />
                    )}
                    <span>Continue with Google</span>
                  </button>

                  <div className="flex items-center gap-4">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-white/40 text-sm">or</span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>

                  <form onSubmit={handleEmailSubmit} noValidate>
                    <div className="relative">
                      <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        aria-label="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading || Boolean(showConfigError)}
                        className="w-full backdrop-blur-[1px] text-white border border-white/10 rounded-full py-3 px-4 pr-14 focus:outline-none focus:border focus:border-white/30 text-center disabled:opacity-60"
                        required
                      />
                      <button
                        type="submit"
                        disabled={loading || Boolean(showConfigError)}
                        aria-label="Send code"
                        className="absolute right-1.5 top-1.5 text-white w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors group overflow-hidden"
                      >
                        {loading ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <span className="relative w-full h-full block overflow-hidden">
                            <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-full">
                              →
                            </span>
                            <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 -translate-x-full group-hover:translate-x-0">
                              →
                            </span>
                          </span>
                        )}
                      </button>
                    </div>
                  </form>

                  <p className="text-xs text-white/35">
                    New or returning — just enter your email. We&apos;ll send a
                    one-time code, no password to remember.
                  </p>
                </div>

                <ErrorLine message={error} />

                <p className="text-xs text-white/40 pt-10">
                  By continuing, you agree to the{" "}
                  <Link
                    href="/terms"
                    className="underline text-white/40 hover:text-white/60 transition-colors"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="underline text-white/40 hover:text-white/60 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </motion.div>
            ) : step === "code" ? (
              <motion.div
                key="code-step"
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-6 text-center"
              >
                <div className="space-y-1">
                  <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                    We sent you a code
                  </h1>
                  <p className="text-[1.25rem] text-white/50 font-light">
                    Please enter it
                  </p>
                  {submittedEmail ? (
                    <p className="text-[0.9rem] text-white/40 font-light">
                      Code sent to{" "}
                      <span className="text-white/70">{submittedEmail}</span>
                    </p>
                  ) : null}
                </div>

                <div className="w-full">
                  <div
                    className="relative rounded-full py-4 px-5 border border-white/10 bg-transparent"
                    role="group"
                    aria-label="Enter the 6-digit verification code"
                    aria-busy={verifying}
                  >
                    <div
                      className="flex items-center justify-center"
                      onPaste={handleCodePaste}
                    >
                      {code.map((digit, i) => (
                        <div key={i} className="flex items-center">
                          <div className="relative">
                            <input
                              ref={(el) => {
                                codeInputRefs.current[i] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              // maxLength allows a full pasted/autofilled code
                              // to land in one field; onChange redistributes
                              // the digits across the six boxes.
                              maxLength={6}
                              autoComplete={i === 0 ? "one-time-code" : "off"}
                              aria-label={`Digit ${i + 1} of 6`}
                              value={digit}
                              disabled={verifying}
                              onChange={(e) => handleCodeChange(i, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(i, e)}
                              className="w-8 text-center text-xl bg-transparent text-white border-none focus:outline-none focus:ring-0 appearance-none disabled:opacity-60"
                              style={{ caretColor: "transparent" }}
                            />
                            {!digit && (
                              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
                                <span className="text-xl text-white/30">0</span>
                              </div>
                            )}
                          </div>
                          {i < 5 && <span className="text-white/20 text-xl">|</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {showConfigError ? <ErrorLine message={showConfigError} /> : null}
                <ErrorLine message={error} />
                {notice ? (
                  <p className="text-sm text-white/50" role="status">
                    {notice}
                  </p>
                ) : null}

                <div>
                  <motion.p
                    className="text-white/50 hover:text-white/70 disabled:opacity-50 transition-colors cursor-pointer text-sm"
                    whileHover={resendCooldown > 0 ? undefined : { scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                    onClick={handleResendCode}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void handleResendCode();
                      }
                    }}
                    aria-disabled={resendCooldown > 0 || resendLoading}
                  >
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : resendLoading
                        ? "Sending code…"
                        : "Resend code"}
                  </motion.p>
                </div>

                <div className="flex w-full gap-3">
                  <motion.button
                    type="button"
                    onClick={handleBackClick}
                    className="rounded-full bg-white text-black font-medium px-8 py-3 hover:bg-white/90 transition-colors w-[30%]"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                  >
                    Back
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => void handleCodeComplete(code)}
                    className={`flex-1 rounded-full font-medium py-3 border transition-all duration-300 flex items-center justify-center gap-2 ${
                      codeComplete && !verifying
                        ? "bg-white text-black border-transparent hover:bg-white/90 cursor-pointer"
                        : "bg-[#111] text-white/50 border-white/10 cursor-not-allowed"
                    }`}
                    disabled={!codeComplete || verifying}
                  >
                    {verifying ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : null}
                    {verifying ? "Verifying…" : "Continue"}
                  </motion.button>
                </div>

                <div className="pt-16">
                  <p className="text-xs text-white/40">
                    By continuing, you agree to the{" "}
                    <Link
                      href="/terms"
                      className="underline text-white/40 hover:text-white/60 transition-colors"
                    >
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/privacy"
                      className="underline text-white/40 hover:text-white/60 transition-colors"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success-step"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
                className="space-y-6 text-center"
              >
                <div className="space-y-1">
                  <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                    You&apos;re in!
                  </h1>
                  <p className="text-[1.25rem] text-white/50 font-light">
                    Welcome to NEXUS
                  </p>
                </div>

                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="py-10"
                >
                  <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-white to-white/70 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 text-black"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </motion.div>

                <motion.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  onClick={() => {
                    successTimers.current.forEach(clearTimeout);
                    router.replace("/app");
                    router.refresh();
                  }}
                  className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors"
                >
                  Continue to Dashboard
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-400/90" role="alert">
      {message}
    </p>
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
