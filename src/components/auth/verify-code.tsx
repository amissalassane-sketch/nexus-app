"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { createClientSafe } from "@/lib/supabase/client";
import { classifyOtpError } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/auth/auth-layout";

// ============================================================
// NEXUS — EMAIL CODE VERIFICATION
// Shared "enter the code we sent you" screen, used by both auth entry
// points that need it:
//   * type="signup"   — after /signup, confirms the account and signs the
//                        user in (supabase.auth.verifyOtp(type: "signup"))
//   * type="recovery" — after /forgot-password, confirms the person owns
//                        the mailbox and opens a recovery session
//                        (supabase.auth.verifyOtp(type: "recovery")), then
//                        continues to /reset-password
//
// The code itself is generated, sent and checked by Supabase — NEXUS never
// stores or compares it. Supabase's GoTrue OTP is 6 digits (fixed, not
// configurable from this app), so this screen uses six boxes.
//
// VISUAL: same dark, pill-input NEXUS auth system as every other screen.
// ============================================================

const RESEND_COOLDOWN_SECONDS = 60;

type CodeType = "signup" | "recovery";

export function VerifyCodeForm({
  email,
  type,
}: {
  email: string;
  type: CodeType;
}) {
  const router = useRouter();
  const { error: configError } = readSupabaseConfig();
  const clientResult = useMemo(() => createClientSafe(), []);
  const supabase = clientResult.client;

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  const resendInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendSubmitting = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => codeInputRefs.current[0]?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = resendInterval.current;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

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

  const handleComplete = useCallback(
    async (digits: string[]) => {
      if (verifying || digits.some((digit) => digit === "")) return;
      if (!email) {
        setError("Missing email address. Go back and try again.");
        return;
      }
      if (!supabase) {
        setError(clientResult.error ?? "Supabase is not configured.");
        return;
      }

      setVerifying(true);
      setError("");

      try {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email,
          token: digits.join(""),
          type,
        });

        if (verifyError) {
          const { text } = classifyOtpError(verifyError);
          setError(text);
          setCode(["", "", "", "", "", ""]);
          setVerifying(false);
          setTimeout(() => codeInputRefs.current[0]?.focus(), 50);
          return;
        }

        if (!data.session) {
          setError("We couldn't start your session. Please try again.");
          setCode(["", "", "", "", "", ""]);
          setVerifying(false);
          setTimeout(() => codeInputRefs.current[0]?.focus(), 50);
          return;
        }

        if (resendInterval.current) clearInterval(resendInterval.current);
        resendInterval.current = null;

        if (type === "recovery") {
          router.replace("/reset-password");
        } else {
          router.replace("/app");
          router.refresh();
        }
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `Could not reach the server: ${cause.message}`
            : "Could not reach the server."
        );
        setVerifying(false);
      }
    },
    [verifying, email, supabase, clientResult.error, type, router]
  );

  const handleChange = (index: number, value: string) => {
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
      codeInputRefs.current[index]?.focus();
    } else {
      const nextEmpty = next.findIndex((digit) => digit === "");
      codeInputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    }

    if (next.every((digit) => digit !== "")) {
      void handleComplete(next);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (verifying) return;
    const text = e.clipboardData.getData("text");
    const digits = text.replace(/\D/g, "").slice(0, 6);
    if (!digits) return;

    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, i) => digits[i] ?? "");
    setCode(next);

    if (next.every((digit) => digit !== "")) {
      void handleComplete(next);
    } else {
      const nextEmpty = next.findIndex((digit) => digit === "");
      codeInputRefs.current[nextEmpty]?.focus();
    }
  };

  const handleResend = useCallback(async () => {
    if (resendSubmitting.current || resendCooldown > 0 || !email) return;

    resendSubmitting.current = true;
    setResendLoading(true);
    setError("");
    setNotice("");

    try {
      const endpoint =
        type === "signup" ? "/api/auth/resend-confirmation" : "/api/auth/forgot-password";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Could not resend the code.");
        return;
      }

      setCode(["", "", "", "", "", ""]);
      setNotice("Code sent again.");
      startResendCooldown();
      setTimeout(() => codeInputRefs.current[0]?.focus(), 50);
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
  }, [resendCooldown, email, type, startResendCooldown]);

  const codeComplete = code.every((d) => d !== "");
  const showConfigError = configError ?? clientResult.error;

  return (
    <AuthLayout
      title="Verify Your Email"
      description={
        email
          ? `Please enter the 6 digit code sent to ${email}`
          : "Please enter the 6 digit code sent to your mail"
      }
      footer={
        <>
          Wrong address?{" "}
          <Link
            href={type === "signup" ? "/signup" : "/forgot-password"}
            className="underline text-white/50 hover:text-white/70 transition-colors"
          >
            Go back
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {showConfigError ? (
          <p className="text-sm text-red-400/90 text-center" role="alert">
            {showConfigError}
          </p>
        ) : null}

        <div
          className="relative rounded-full py-4 px-5 border border-white/10 bg-white/[0.03]"
          role="group"
          aria-label="Enter the 6-digit verification code"
          aria-busy={verifying}
        >
          <div className="flex items-center justify-center" onPaste={handlePaste}>
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
                    maxLength={6}
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    aria-label={`Digit ${i + 1} of 6`}
                    value={digit}
                    disabled={verifying}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="w-8 text-center text-xl bg-transparent text-white border-none focus:outline-none focus:ring-0 appearance-none disabled:opacity-60"
                    style={{ caretColor: "transparent" }}
                  />
                  {!digit && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
                      <span className="text-xl text-white/20">0</span>
                    </div>
                  )}
                </div>
                {i < 5 && <span className="text-white/20 text-xl">|</span>}
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-400/90 text-center" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-sm text-emerald-400/80 text-center" role="status">
            {notice}
          </p>
        ) : null}

        <p className="text-center">
          <motion.span
            className="text-white/50 hover:text-white/70 transition-colors cursor-pointer text-sm underline underline-offset-4 decoration-white/20"
            whileHover={resendCooldown > 0 ? undefined : { scale: 1.02 }}
            transition={{ duration: 0.2 }}
            onClick={handleResend}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void handleResend();
              }
            }}
            aria-disabled={resendCooldown > 0 || resendLoading}
          >
            {resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : resendLoading
                ? "Sending…"
                : "Resend Code"}
          </motion.span>
        </p>

        <motion.button
          type="button"
          onClick={() => void handleComplete(code)}
          disabled={!codeComplete || verifying || Boolean(showConfigError)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.2 }}
          className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {verifying ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : null}
          {verifying ? "Verifying…" : "Verify"}
        </motion.button>
      </div>
    </AuthLayout>
  );
}
