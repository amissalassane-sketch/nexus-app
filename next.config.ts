import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development only: allow the sandboxed preview host to load /_next dev
  // assets (Next 16 blocks cross-origin dev resources by default).
  allowedDevOrigins: ["*.e2b.app"],
};

export default nextConfig;
