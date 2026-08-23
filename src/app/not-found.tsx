import Link from "next/link";
import { NexusLogo } from "@/components/nexus-logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata = {
  title: "Page not found — NEXUS",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg-base px-4 py-12 text-center">
      <NexusLogo size={32} className="mb-6 opacity-60" />
      <p className="eyebrow text-text-quaternary">Error 404</p>
      <h1 className="mt-3 text-[24px] font-semibold leading-[30px] tracking-[-0.03em] text-text-primary">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-2 max-w-[42ch] text-small text-text-secondary">
        The link may be out of date, or the item was removed from the workspace.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <ButtonLink href="/dashboard">Go to Overview</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Back to nexus.app
        </ButtonLink>
      </div>
      <p className="mt-10 text-caption text-text-quaternary">
        Lost?{" "}
        <Link href="/app/intelligence" className="text-text-tertiary hover:text-text-secondary">
          See what NEXUS detected
        </Link>
      </p>
    </main>
  );
}
