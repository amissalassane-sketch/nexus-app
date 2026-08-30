import type { MetadataRoute } from "next";

// ============================================================
// NEXUS — WEB APP MANIFEST (INSTALLABILITY PREPARATION)
// Phase Mobile UX: no service worker is shipped yet (the app stays a
// classic web app), but the manifest + icons + theme make NEXUS
// installable-ready the moment an offline layer is introduced. This
// file is inert today — it only decorates the document head.
// ============================================================

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nexus.app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEXUS. Operational Intelligence",
    short_name: "NEXUS",
    description:
      "NEXUS analyses the work already happening in your workspace and surfaces what is drifting, what is blocked, what is at risk, and what deserves your attention next.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["productivity", "business", "project management"],
    icons: [
      {
        src: "/icons/icon-180.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Create a task",
        short_name: "New task",
        url: "/tasks?create=1",
        icons: [{ src: "/icons/icon-180.png", sizes: "180x180" }],
      },
      {
        name: "Create a project",
        short_name: "New project",
        url: "/projects?create=1",
        icons: [{ src: "/icons/icon-180.png", sizes: "180x180" }],
      },
      {
        name: "Intelligence",
        short_name: "Intelligence",
        url: "/app/intelligence",
        icons: [{ src: "/icons/icon-180.png", sizes: "180x180" }],
      },
    ],
    // Keep the canonical origin for metadata readers that need absolute URLs.
    id: SITE_URL,
  };
}
