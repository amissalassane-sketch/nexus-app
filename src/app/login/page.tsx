import { SignInPage } from "@/components/ui/sign-in-flow-1";

// ============================================================
// SIGN-IN — 21st.dev immersive design (navbar removed)
// Fullscreen animated dot-matrix background, centred auth form,
// legal footer. No navigation bar.
//
// The ?error= param (set when a failed OAuth exchange bounces the
// visitor back to /login) is read on the server and passed as a
// prop: the page is dynamic (it consumes the request-time
// `searchParams`), so the form, the OAuth button and any error
// state are present in the initial HTML instead of appearing only
// after client hydration.
// ============================================================

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  return <SignInPage initialError={error} />;
}
