import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * NEXUS V3 typography.
 * Self-hosted (Inter Variable + Geist Mono Variable) so the app never depends
 * on a third-party font CDN at build or runtime.
 */
const inter = localFont({
  src: "../fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

const geistMono = localFont({
  src: "../fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

/**
 * Canonical origin for absolute URLs in metadata (Open Graph, sitemap...).
 * Override with NEXT_PUBLIC_SITE_URL once the production domain is final.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nexus.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "NEXUS — Personal operating system",
  description:
    "NEXUS is a quiet personal operating system that connects goals, projects, tasks and activity in one workspace — then tells you what to do next.",
  applicationName: "NEXUS",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-bg-base font-sans text-body text-text-primary">
        {children}
      </body>
    </html>
  );
}
