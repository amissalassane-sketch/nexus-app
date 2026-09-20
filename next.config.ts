import type { NextConfig } from "next";

// Baseline security headers. Deliberately no Content-Security-Policy here:
// a wrong CSP would break Supabase / Google OAuth, so it needs its own review.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Standalone is for self-hosting/Docker only. Vercel's adapter packages the
  // output itself, and standalone + adapter breaks on Next 16.3.0-16.3.4.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  // Development only: allow the sandboxed preview host to load /_next dev
  // assets (Next 16 blocks cross-origin dev resources by default).
  allowedDevOrigins: ["*.e2b.app", "*.run.app"],
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
