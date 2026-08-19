import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig, readSupabaseConfig } from "@/lib/supabase/config";

/**
 * Browser Supabase client.
 * Throws a descriptive error when the public environment variables are
 * missing — use `createClientSafe()` in UI code that must stay renderable.
 */
export function createClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key);
}

export type SafeClientResult =
  | { client: SupabaseClient; error: null }
  | { client: null; error: string };

/**
 * Same client, but never throws during render: pages can display a real
 * configuration error instead of crashing with a blank screen.
 */
export function createClientSafe(): SafeClientResult {
  const { config, error } = readSupabaseConfig();
  if (!config) return { client: null, error };

  try {
    return { client: createBrowserClient(config.url, config.key), error: null };
  } catch (cause) {
    return {
      client: null,
      error:
        cause instanceof Error
          ? `Supabase client could not be created: ${cause.message}`
          : "Supabase client could not be created.",
    };
  }
}
