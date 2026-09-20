import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Development only: allow the sandboxed preview host to load /_next dev
  // assets (Next 16 blocks cross-origin dev resources by default).
  allowedDevOrigins: ["*.e2b.app", "*.run.app"],
};

export default nextConfig;
