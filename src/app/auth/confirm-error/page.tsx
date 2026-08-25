import { ConfirmErrorPageClient } from "@/components/auth/confirm-error";

// ============================================================
// CONFIRMATION ERROR STATE
// The reason (?reason=expired|already-used|invalid|missing) is
// read on the server and passed as a prop: the page is dynamic
// (it consumes the request-time `searchParams`), so the exact
// branded copy for that reason — and the resend form — are present
// in the initial HTML instead of appearing only after client
// hydration.
// ============================================================

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : "";
  return <ConfirmErrorPageClient initialReason={reason} />;
}
