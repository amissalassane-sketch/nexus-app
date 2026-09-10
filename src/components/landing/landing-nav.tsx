"use client";

import { useEffect, useRef, useState } from "react";
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
//   context="landing"      → on / , section links stay anchors and a
//                            quiet indicator follows the section in
//                            view
//   context="intelligence" → on /intelligence, the same links point
//                            back to the landing sections and the
//                            Intelligence item is marked as current.
//
// Keyboard: skip link, native tab order, Escape closes the mobile
// menu and returns focus to its trigger.
// ============================================================

type LandingNavContext =
  | "landing"
  | "intelligence"
  | "how-it-works"
  | "pricing"
  | "legal";

const NAV_LINKS = [
  { id: "product", route: "/#product", label: "Product" },
  { id: "how-it-works", route: "/how-it-works", label: "How it works" },
  { id: "intelligence", route: "/intelligence", label: "Intelligence" },
  { id: "integrations", route: "/#integrations", label: "Integrations" },
  { id: "pricing", route: "/pricing", label: "Pricing" },
] as const;

const SECTION_IDS = ["product", "how-it-works", "intelligence", "integrations", "pricing"] as const;

export function LandingNav({
  context = "landing",
}: {
  context?: LandingNavContext;
} = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

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

  // Escape closes the menu and puts focus back on the trigger.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuTriggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Section indicator on the landing page only: a single listener-free
  // IntersectionObserver rather than a scroll handler.
  useEffect(() => {
    if (context !== "landing") return;

    const sections = SECTION_IDS.map((id) =>
      document.getElementById(id)
    ).filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            return;
          }
        }
      },
      // A narrow horizontal band just above the middle of the viewport.
      { rootMargin: "-38% 0px -56% 0px", threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [context]);

  const isCurrent = (link: (typeof NAV_LINKS)[number]) =>
    context !== "landing" && link.id === context;

  const isActive = (link: (typeof NAV_LINKS)[number]) =>
    context === "landing" ? activeSection === link.id : isCurrent(link);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-200 ease-nexus",
        scrolled || open
          ? "border-b border-border-subtle bg-bg-base/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      )}
    >
      {/* DESIGN AUDIT — a keyboard/screen-reader visitor must be able to
          jump past the nav straight into the page. Visible on focus only. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:inline-flex focus:h-9 focus:items-center focus:rounded-input focus:border focus:border-border-strong focus:bg-bg-surface focus:px-3 focus:text-button focus:text-text-primary"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-14 w-full max-w-page items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="NEXUS home"
          className="flex items-center rounded-nav transition-opacity duration-150 ease-nexus hover:opacity-80"
        >
          <NexusWordmark size={28} priority />
        </Link>

        <nav
          aria-label="Landing sections"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_LINKS.map((link) => {
            const current = isCurrent(link);
            const active = isActive(link);
            const className = cn(
              "landing-nav-link relative rounded-pill px-3.5 py-2 text-button transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary",
              current || active
                ? "bg-accent-ghost text-text-primary"
                : "text-text-secondary"
            );

            return (
              <Link
                key={link.id}
                href={link.route}
                aria-current={current ? "page" : active ? "true" : undefined}
                data-active={active || undefined}
                className={className}
              >
                {link.label}
              </Link>
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
            ref={menuTriggerRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-pill text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary sm:h-9 sm:w-9"
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
            className="mx-auto flex w-full max-w-page flex-col px-4 pb-5 pt-2"
          >
            {NAV_LINKS.map((link) => {
              const current = isCurrent(link);
              const active = isActive(link);
              const className = cn(
                "flex h-12 items-center rounded-input px-3 text-body transition-colors duration-150 ease-nexus hover:bg-accent-ghost",
                current || active
                  ? "bg-accent-ghost text-text-primary"
                  : "text-text-primary"
              );

              return (
                <Link
                  key={link.id}
                  href={link.route}
                  onClick={() => setOpen(false)}
                  aria-current={current ? "page" : active ? "true" : undefined}
                  className={className}
                >
                  {link.label}
                </Link>
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
