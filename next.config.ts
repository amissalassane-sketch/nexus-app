import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is for self-hosting/Docker only. Vercel's adapter packages the
  // output itself, and standalone + adapter breaks on Next 16.3.0-16.3.4.
  output: process.env.VERCEL ? undefined : "standalone",
  // Development only: allow the sandboxed preview host to load /_next dev
  // assets (Next 16 blocks cross-origin dev resources by default).
  allowedDevOrigins: ["*.e2b.app", "*.run.app"],
};

export default nextConfig;