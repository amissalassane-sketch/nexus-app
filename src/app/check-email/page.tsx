import { CheckEmailPageClient } from "@/components/auth/check-email";

// ============================================================
// POST-SIGNUP VERIFICATION GATE
// The email being verified (?email=) is read on the server and passed
// as a prop: the page is dynamic (it consumes the request-time
// `searchParams`), so the message — and the address it refers to —
// is present in the initial HTML instead of appearing only after
// client hydration.
// ============================================================

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  return <CheckEmailPageClient initialEmail={email} />;
}
