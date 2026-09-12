import { SignInPage } from "@/components/ui/sign-in-flow-1";

// ============================================================
// SIGNUP — same unified auth surface as /login.
//
// NEXUS no longer has two authentication mechanisms (an OTP-based
// /login and a password-based /signup). There is one entry point:
// enter an email, get a 6-digit code. `signInWithOtp({ shouldCreateUser:
// true })` creates the account when it doesn't exist yet and simply
// signs the person in when it does — so /login and /signup render the
// exact same component and differ only in which marketing link brought
// the visitor here ("Sign in" vs "Get started").
//
// The legacy email+password flow (`/api/auth/signup`, `/check-email`,
// `/forgot-password`, `/reset-password`) still exists server-side for
// backward compatibility with accounts created before this rework, but
// is no longer reachable from this page.
// ============================================================

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  return <SignInPage initialError={error} />;
}
