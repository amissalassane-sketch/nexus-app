import Link from "next/link";
import { NexusWordmark } from "@/components/nexus-logo";

// ============================================================
// NEXUS LANDING — FOOTER
// Product anchors + real account routes. No dead links, no
// invented pages. From /intelligence the section anchors point
// back to the landing page instead of resolving to nothing.
// ============================================================

type LandingFooterContext = "landing" | "intelligence" | "how-it-works" | "pricing";

const PRODUCT_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#model", label: "The model" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/pricing", label: "Pricing" },
] as const;

const ACCOUNT_LINKS = [
  { href: "/login", label: "Sign in" },
  { href: "/signup", label: "Get started" },
] as const;

const SYSTEM_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#faq", label: "FAQ" },
  { href: "/pricing", label: "Free plan" },
] as const;

const COLUMNS = [
  { title: "Product", links: PRODUCT_LINKS },
  { title: "Account", links: ACCOUNT_LINKS },
  { title: "System", links: SYSTEM_LINKS },
] as const;

export function LandingFooter({
  context = "landing",
}: {
  context?: LandingFooterContext;
} = {}) {
  // Hash links are relative to the landing page: prefix them when the
  // footer is rendered on a dedicated route.
  const resolve = (href: string) =>
    context === "intelligence" && href.startsWith("#") ? `/${href}` : href;

  return (
    <footer className="border-t border-border-subtle px-5 pb-10 pt-14 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[280px]">
          <Link href="/" aria-label="NEXUS home" className="inline-flex rounded-nav">
            <NexusWordmark size={28} />
          </Link>
          <p className="mt-3 text-small text-text-secondary">
            It reads the work, not the chat.
          </p>
          <p className="nexus-eyebrow mt-4">
            Operational intelligence
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="nexus-eyebrow">
                {column.title}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={resolve(link.href)}
                      className="text-small text-text-secondary transition-colors duration-150 ease-nexus hover:text-text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-14 flex w-full max-w-[1120px] flex-col gap-2 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
        <span className="nexus-eyebrow">© 2026 NEXUS</span>
        <span className="nexus-meta">Built with Next.js · Supabase · Postgres</span>
      </div>
    </footer>
  );
}
