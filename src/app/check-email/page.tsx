import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ButtonLink } from "@/components/ui/button";

export const metadata = {
  title: "Check your inbox — NEXUS",
  robots: { index: false, follow: false },
};

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = params.email?.trim();

  return (
    <AuthLayout
      title="Check your inbox"
      description={
        email
          ? undefined
          : "We sent a confirmation link to your email. Open it to activate your account, then sign in."
      }
      footer={
        <>
          Wrong address?{" "}
          <Link
            href="/signup"
            className="text-text-primary underline decoration-border-strong underline-offset-4"
          >
            Create another account
          </Link>
        </>
      }
    >
      {email ? (
        <p className="mb-6 text-center text-small text-text-secondary">
          We sent a confirmation link to{" "}
          <span className="text-text-primary">{email}</span>. Open it in any
          browser to activate your account, then sign in.
        </p>
      ) : null}

      <ButtonLink href="/login" size="lg" className="w-full">
        Back to sign in
      </ButtonLink>
    </AuthLayout>
  );
}
