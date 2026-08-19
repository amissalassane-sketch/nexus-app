// ============================================================
// NEXUS — SUPABASE CONFIGURATION
// ============================================================
// Reads and validates the public Supabase configuration.
//
// Both key names are accepted, because Supabase renamed them:
//   * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (new "publishable key")
//   * NEXT_PUBLIC_SUPABASE_ANON_KEY         (legacy "anon public" key)
//
// Using the wrong variable name used to make `createClient()` throw
// "Your project's URL and API key are required", which surfaced as a blank
// screen / a form that appeared to do nothing. Now the app reports exactly
// what is missing.
//
// Only public keys belong here. The service_role key must NEVER be exposed
// to the browser and is not read anywhere in this codebase.
// ============================================================

export type SupabaseConfig = {
  url: string;
  key: string;
};

export type SupabaseConfigResult =
  | { config: SupabaseConfig; error: null }
  | { config: null; error: string };

// Static member access is required so Next.js can inline these at build time.
const RAW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const RAW_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const RAW_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function readSupabaseConfig(): SupabaseConfigResult {
  const url = RAW_URL?.trim();
  const key = (RAW_PUBLISHABLE_KEY ?? RAW_ANON_KEY)?.trim();

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }

  if (missing.length > 0) {
    return {
      config: null,
      error: `Supabase is not configured: ${missing.join(
        " and "
      )} missing. Add it to .env.local (see .env.example) and restart the dev server.`,
    };
  }

  if (!/^https?:\/\//i.test(url!)) {
    return {
      config: null,
      error:
        "Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL must start with https:// (copy the Project URL from Supabase → Project Settings → API).",
    };
  }

  return { config: { url: url!, key: key! }, error: null };
}

export function getSupabaseConfig(): SupabaseConfig {
  const { config, error } = readSupabaseConfig();
  if (!config) throw new Error(error);
  return config;
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseConfig().config !== null;
}
