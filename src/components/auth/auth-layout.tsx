import type { ReactNode } from "react";
import Link from "next/link";
import { NexusLogo } from "@/components/nexus-logo";

// ============================================================
// NEXUS — AUTHENTICATION LAYOUT
// The first surface of the product: black, centred, undecorated.
// The mark, the title, the form. Nothing competes with the inputs.
// ============================================================

export function AuthLayout({
  title,
  description,
  children,
  footer,
  aside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-bg-base px-4 py-12">
      {/* One very quiet light source, top-centre. No gradient wash. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(233,228,255,0.05),transparent_70%)]"
      />

      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            href="/"
            aria-label="NEXUS home"
            className="group mb-6 inline-flex rounded-input outline-none"
          >
            <NexusLogo
              size={36}
              priority
              className="transition-opacity duration-200 ease-nexus group-hover:opacity-80"
            />
          </Link>
          <h1 className="text-[24px] font-semibold leading-[30px] tracking-[-0.03em] text-text-primary">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-[34ch] text-small text-text-secondary">
              {description}
            </p>
          ) : null}
        </div>

        {children}

        {footer ? (
          <div className="mt-6 text-center text-small text-text-secondary">
            {footer}
          </div>
        ) : null}
      </div>

      {aside ? (
        <div className="mt-10 w-full max-w-[380px]">{aside}</div>
      ) : null}

      <p className="eyebrow mt-10 text-text-quaternary">
        Operational intelligence for modern teams
      </p>
    </main>
  );
}
