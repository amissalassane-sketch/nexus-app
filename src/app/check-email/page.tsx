import Link from "next/link";
import { NexusLogo } from "@/components/nexus-logo";
import { ButtonLink } from "@/components/ui/button";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = params.email?.trim();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-base px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="rounded-auth border border-border-default bg-bg-subtle p-8 shadow-auth">
          <div className="mb-7 flex flex-col items-center text-center">
            <NexusLogo size={48} priority className="mb-5" />
            <h1 className="text-h1 text-text-primary">Check your inbox</h1>
            <p className="mt-2 text-small text-text-secondary">
              {email ? (
                <>
                  We sent a confirmation link to{" "}
                  <span className="text-text-primary">{email}</span>. Open it to
                  activate your account, then sign in.
                </>
              ) : (
                <>
                  We sent a confirmation link to your email. Open it to activate
                  your account, then sign in.
                </>
              )}
            </p>
          </div>

          <ButtonLink href="/login" size="lg" className="w-full">
            Back to sign in
          </ButtonLink>

          <p className="mt-6 text-center text-small text-text-tertiary">
            Wrong address?{" "}
            <Link
              href="/signup"
              className="text-text-primary underline decoration-border-strong underline-offset-4"
            >
              Create another account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
