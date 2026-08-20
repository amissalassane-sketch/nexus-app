"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NexusWordmark } from "@/components/nexus-logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS LANDING — NAVBAR
// Fixed, compact (56px), transparent at the top of the page and
// switching to a blurred surface once the visitor scrolls. The
// primary action ("Get started") stays visible on every breakpoint.
//
// One navbar for both public surfaces:
//   context="landing"      → on / , section links stay anchors
//   context="intelligence" → on /intelligence, the same links point
//                            back to the landing sections and the
//                            Intelligence item is marked as current.
// ============================================================

type LandingNavContext = "landing" | "intelligence";

const NAV_LINKS = [
  { id: "product", hash: "product", label: "Product" },
  { id: "how-it-works", hash: "how-it-works", label: "How it works" },
  { id: "intelligence", route: "/intelligence", label: "Intelligence" },
  { id: "pricing", hash: "pricing", label: "Pricing" },
] as const;

export function LandingNav({
  context = "landing",
}: {
  context?: LandingNavContext;
} = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep the page from scrolling behind the open mobile menu.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Anchors stay anchors on the landing page; from /intelligence the same
  // items navigate back to the corresponding section of the landing page.
  const linkHref = (link: (typeof NAV_LINKS)[number]) =>
    "route" in link
      ? link.route
      : context === "intelligence"
        ? `/#${link.hash}`
        : `#${link.hash}`;

  const isCurrent = (link: (typeof NAV_LINKS)[number]) =>
    context === "intelligence" && link.id === "intelligence";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-200 ease-nexus",
        scrolled || open
          ? "border-b border-border-subtle bg-bg-base/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-3 px-5 sm:px-6">
        <Link
          href="/"
          aria-label="NEXUS — home"
          className="flex items-center rounded-nav transition-opacity duration-150 ease-nexus hover:opacity-80"
        >
          <NexusWordmark size={28} priority />
        </Link>

        <nav aria-label="Landing sections" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const current = isCurrent(link);
            const className = cn(
              "rounded-pill px-3.5 py-2 text-button transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary",
              current
                ? "bg-accent-ghost text-text-primary"
                : "text-text-secondary"
            );

            if ("route" in link) {
              return (
                <Link
                  key={link.id}
                  href={link.route}
                  aria-current={current ? "page" : undefined}
                  className={className}
                >
                  {link.label}
                </Link>
              );
            }

            return (
              <a key={link.id} href={linkHref(link)} className={className}>
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm">
            Get started
          </ButtonLink>
        </div>

        {/* Mobile: primary CTA stays visible next to the menu trigger. */}
        <div className="flex items-center gap-2 md:hidden">
          <ButtonLink href="/signup" size="md" className="!h-11">
            Get started
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-pill text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
          >
            {open ? <X size={18} strokeWidth={1.75} /> : <Menu size={18} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="landing-mobile-menu"
          className="border-t border-border-subtle bg-bg-base/95 backdrop-blur-md md:hidden"
        >
          <nav
            aria-label="Landing sections"
            className="mx-auto flex w-full max-w-[1120px] flex-col px-5 pb-5 pt-2"
          >
            {NAV_LINKS.map((link) => {
              const current = isCurrent(link);
              const className = cn(
                "flex h-12 items-center rounded-input px-3 text-body transition-colors duration-150 ease-nexus hover:bg-accent-ghost",
                current ? "bg-accent-ghost text-text-primary" : "text-text-primary"
              );

              if ("route" in link) {
                return (
                  <Link
                    key={link.id}
                    href={link.route}
                    onClick={() => setOpen(false)}
                    aria-current={current ? "page" : undefined}
                    className={className}
                  >
                    {link.label}
                  </Link>
                );
              }

              return (
                <a
                  key={link.id}
                  href={linkHref(link)}
                  onClick={() => setOpen(false)}
                  className={className}
                >
                  {link.label}
                </a>
              );
            })}
            <div className="mt-2 flex items-center gap-2 border-t border-border-subtle pt-4">
              <ButtonLink
                href="/login"
                variant="secondary"
                size="md"
                className="!h-11 flex-1"
              >
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" size="md" className="!h-11 flex-1">
                Get started
              </ButtonLink>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
