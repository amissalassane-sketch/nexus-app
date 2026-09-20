import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  allowedDevOrigins: ["*.e2b.app", "*.run.app"],
};

export default nextConfig;