// ============================================================
// NEXUS — AUTH ERROR MAPPING
// Supabase returns terse, sometimes cryptic messages. The UI must always
// show something the user can act on — never a silent failure.
// ============================================================

export type AuthErrorShape = {
  message?: string | null;
  code?: string | null;
  status?: number | null;
};

export function humanizeAuthError(error: AuthErrorShape): string {
  const raw = (error.message ?? "").trim();
  const code = (error.code ?? "").trim();
  const key = `${code} ${raw}`.toLowerCase();

  if (key.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }
  if (
    key.includes("email not confirmed") ||
    key.includes("email_not_confirmed") ||
    key.includes("not confirmed")
  ) {
    return "Your email address hasn't been verified yet. Verify it before signing in.";
  }
  if (key.includes("user already registered") || key.includes("already been registered")) {
    return "An account already exists with this email address. Sign in instead.";
  }
  if (key.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (key.includes("weak password")) {
    return "This password is too weak. Use at least 6 characters.";
  }
  if (key.includes("unable to validate email") || key.includes("invalid email")) {
    return "This email address is not valid.";
  }
  if (key.includes("email rate limit") || key.includes("over_email_send_rate_limit")) {
    return "Too many emails sent for this address. Wait a minute and try again.";
  }
  if (key.includes("rate limit") || key.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (key.includes("signups not allowed") || key.includes("signup_disabled")) {
    return "Sign-ups are disabled on this Supabase project (Authentication → Sign In / Providers).";
  }
  if (
    key.includes("token has expired") ||
    key.includes("otp token has expired") ||
    key.includes("token expired") ||
    key.includes("expired token")
  ) {
    return "This verification link has expired.";
  }
  if (
    key.includes("token has already been used") ||
    key.includes("otp token is invalid") ||
    key.includes("invalid token") ||
    key.includes("token is invalid")
  ) {
    return "This verification link is no longer valid.";
  }
  if (
    key.includes("fetch failed") ||
    key.includes("network") ||
    key.includes("enotfound") ||
    key.includes("failed to fetch")
  ) {
    return "We couldn't reach NEXUS. Check your connection and try again.";
  }

  // Never surface a raw GoTrue message to an end user.
  return "Authentication failed. Please try again.";
}

/** Validation shared by the client forms and the server routes. */
export function validateCredentials(email: unknown, password: unknown): string | null {
  if (typeof email !== "string" || email.trim().length === 0) {
    return "Please enter your email address.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "This email address is not valid.";
  }
  if (typeof password !== "string" || password.length === 0) {
    return "Please enter your password.";
  }
  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  return null;
}

export function validateUsername(username: unknown): string | null {
  if (typeof username !== "string" || username.trim().length === 0) {
    return "Please choose a username.";
  }
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) {
    return "Username must be 3-30 characters: letters, numbers and underscores only.";
  }
  return null;
}
