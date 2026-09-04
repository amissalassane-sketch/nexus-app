import Link from "next/link";
import { NexusWordmark } from "@/components/nexus-logo";
import { ButtonLink } from "@/components/ui/button";
import { RouteReadout } from "@/components/not-found/route-readout";
import { SignalTrace } from "@/components/not-found/signal-trace";

// ============================================================
// NEXUS — 404, "ROUTE INTELLIGENCE"
// The product reads work and surfaces signals; a missing page is
// simply a route with no signal on it. So the 404 is rendered as
// one of NEXUS's own analyses: the mark, the readout of the exact
// route that was requested, and a clear way back to live work.
// Noindex stays: a 404 must never enter the index.
// ============================================================

export const metadata = {
  // The root layout template appends ". NEXUS" — no need to repeat it.
  title: "Page not found",
  robots: { index: false, follow: false },
};

/** Known-good destinations — quiet shortcuts for signed-in users. */
const ESCAPE_ROUTES = [
  { href: "/dashboard", label: "Overview" },
  { href: "/tasks", label: "Tasks" },
  { href: "/goals", label: "Goals" },
  { href: "/app/intelligence", label: "Intelligence" },
];

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-bg-base text-text-primary">
      {/* System bar — the shell, not a nav. */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4 sm:px-6">
        <Link
          href="/"
          aria-label="NEXUS home"
          className="group inline-flex rounded-input outline-none"
        >
          <NexusWordmark
            size={28}
            className="transition-opacity duration-200 ease-nexus group-hover:opacity-80"
          />
        </Link>
        <p className="font-mono text-mono uppercase tracking-[0.06em] text-text-quaternary">
          ERR 404 · Route not found
        </p>
      </header>

      {/* Stage */}
      <div className="flex flex-1 items-center justify-center px-4 py-14 sm:px-6">
        <div className="page-enter w-full max-w-[460px] text-center">
          <p className="eyebrow flex items-center justify-center gap-2 text-text-quaternary">
            <span
              aria-hidden="true"
              className="h-1 w-1 rounded-full bg-danger animate-verification"
            />
            Signal analysis · complete
          </p>

          {/* The reading: 404, then the trace it produced.
              `numeric` — numbers are always mono in NEXUS, and the
              instrument aesthetic fits a route readout. */}
          <div className="mt-6 flex flex-col items-center">
            <p className="numeric text-[clamp(88px,22vw,132px)] font-semibold leading-[0.9] text-text-primary">
              404
            </p>
            <SignalTrace className="mt-1 w-[min(380px,100%)]" />
          </div>

          <h1 className="mt-8 text-[24px] font-semibold leading-[30px] tracking-[-0.03em] text-text-primary">
            No signal on this route
          </h1>
          <p className="mx-auto mt-2 max-w-[42ch] text-small text-text-secondary">
            NEXUS read the address you followed and found nothing behind it.
            The link may be out of date, or the item was removed from the
            workspace.
          </p>

          {/* What NEXUS saw — the requested route, read back. */}
          <div className="mx-auto mt-7 max-w-[420px]">
            <RouteReadout />
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <ButtonLink href="/dashboard">Return to Overview</ButtonLink>
            <ButtonLink href="/" variant="secondary">
              Back to nexus.app
            </ButtonLink>
          </div>

          {/* Known-good routes, for the signed-in visitor in a hurry. */}
          <nav aria-label="Known routes" className="mt-9">
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 font-mono text-mono uppercase tracking-[0.06em]">
              <span className="text-text-quaternary">Try</span>
              {ESCAPE_ROUTES.map((route, index) => (
                <span key={route.href} className="flex items-center gap-2">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-text-muted">
                      ·
                    </span>
                  ) : null}
                  <Link
                    href={route.href}
                    className="text-text-tertiary underline-offset-4 transition-colors duration-150 ease-nexus hover:text-text-primary hover:underline"
                  >
                    {route.label}
                  </Link>
                </span>
              ))}
            </p>
          </nav>
        </div>
      </div>

      {/* Quiet sign-off. */}
      <footer className="shrink-0 border-t border-border-subtle px-4 py-4 sm:px-6">
        <p className="text-center text-caption text-text-quaternary">
          NEXUS reads the work — even when there is none here.
        </p>
      </footer>
    </main>
  );
}
