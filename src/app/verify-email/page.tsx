import { VerifyCodeForm } from "@/components/auth/verify-code";

// ============================================================
// VERIFY EMAIL — shared code-entry gate.
// Reached from two places:
//   * /signup           → ?type=signup   (confirm the new account)
//   * /forgot-password  → ?type=recovery (confirm identity before reset)
//
// ?email= is read on the server so it's present in the initial HTML
// instead of only appearing after client hydration.
// ============================================================

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const type = params.type === "recovery" ? "recovery" : "signup";
  return <VerifyCodeForm email={email} type={type} />;
}
