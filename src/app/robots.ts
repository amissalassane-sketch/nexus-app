import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nexus.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Product surfaces are behind auth and have no public value.
        disallow: [
          "/dashboard",
          "/tasks",
          "/projects",
          "/goals",
          "/activity",
          "/notifications",
          "/integrations",
          "/settings",
          "/onboarding",
          "/upgrade",
          "/api/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
