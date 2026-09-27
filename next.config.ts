import type { NextConfig } from "next";

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://accounts.google.com",
  "frame-src 'self' https://js.stripe.com",
  // Allow Arena's iframe and dev runners
  "frame-ancestors 'self' https://*.e2b.app https://*.run.app",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Keep production clickjacking protection; allow Arena's iframe in development.
  ...(process.env.NODE_ENV === "development" ? [] : [{ key: "X-Frame-Options", value: "SAMEORIGIN" }]),
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Content-Security-Policy", value: cspDirectives },
];

const nextConfig: NextConfig = {
  // Standalone is for self-hosting/Docker only. Vercel's adapter packages the
  // output itself, and standalone + adapter breaks on Next 16.3.0-16.3.4.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  // Development only: allow the sandboxed preview host to load /_next dev
  // assets (Next 16 blocks cross-origin dev resources by default).
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.e2b.app", "*.run.app"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Keep the admin console and API routes out of search engines.
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
