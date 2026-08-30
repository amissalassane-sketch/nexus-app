import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
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

const DESCRIPTION =
  "NEXUS analyses the work already happening in your workspace and surfaces what is drifting, what is blocked, what is at risk, and what deserves your attention next.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NEXUS. Operational Intelligence for Modern Teams",
    template: "%s. NEXUS",
  },
  description: DESCRIPTION,
  applicationName: "NEXUS",
  keywords: [
    "operational intelligence",
    "workspace intelligence",
    "project risk",
    "team coordination",
    "work signals",
  ],
  authors: [{ name: "NEXUS" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "NEXUS",
    url: SITE_URL,
    title: "NEXUS. Operational Intelligence for Modern Teams",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXUS. Operational Intelligence for Modern Teams",
    description: DESCRIPTION,
  },
  formatDetection: { telephone: false },
  // iOS add-to-home-screen preparation (no service worker yet — the app
  // remains a classic web app; this only makes the installed shell feel
  // native when an offline layer is added later).
  appleWebApp: {
    capable: true,
    title: "NEXUS",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  // Required for `env(safe-area-inset-*)` to resolve on iOS: without
  // `viewport-fit=cover` the browser letterboxes the layout and the safe
  // area insets are always 0. The shell uses the insets to keep the mobile
  // header, drawer, bottom navigation and sheets clear of the notch and
  // home indicator.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
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
