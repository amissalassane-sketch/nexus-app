import { NextResponse } from "next/server";
import { readSupabaseConfig } from "@/lib/supabase/config";

/**
 * Lightweight liveness/configuration probe for Vercel / uptime checks.
 * It never returns a Supabase key. The host and configured site origin are
 * already public values, but make it possible to detect a deployment pointed
 * at localhost, a preview project or the wrong Supabase project.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { config, error } = readSupabaseConfig();
  let supabaseHost: string | null = null;

  if (config) {
    try {
      supabaseHost = new URL(config.url).host;
    } catch {
      // `readSupabaseConfig` already validates the protocol; keep the probe
      // safe if a malformed value reaches a static build.
    }
  }

  let siteOrigin: string | null = null;
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    try {
      siteOrigin = new URL(configuredSiteUrl).origin;
    } catch {
      // Do not expose the malformed value; configuration remains false.
    }
  }

  return NextResponse.json(
    {
      ok: true,
      service: "nexus",
      time: new Date().toISOString(),
      deployment: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        environment: process.env.VERCEL_ENV ?? null,
      },
      configuration: {
        supabaseConfigured: Boolean(config),
        supabaseHost,
        siteOrigin,
        error: error ? "missing_or_invalid_public_configuration" : null,
      },
    },
    { headers: { "cache-control": "no-store" } }
  );
}
