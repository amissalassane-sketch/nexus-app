import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPTY_ONBOARDING,
  parseOnboarding,
  type PersistedOnboarding,
} from "@/lib/onboarding/model";

const storageKey = (userId: string) => `nexus:onboarding:${userId}`;

export function readLocalOnboarding(userId: string): PersistedOnboarding {
  if (typeof window === "undefined") return { ...EMPTY_ONBOARDING };
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return { ...EMPTY_ONBOARDING };
    return parseOnboarding(JSON.parse(raw));
  } catch {
    return { ...EMPTY_ONBOARDING };
  }
}

export function writeLocalOnboarding(
  userId: string,
  state: PersistedOnboarding
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // Quota / private mode — ignore; in-memory state still works.
  }
}

export async function readRemoteOnboarding(
  supabase: SupabaseClient,
  userId: string
): Promise<PersistedOnboarding | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_progress")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return parseOnboarding(
    (data as { onboarding_progress?: unknown }).onboarding_progress
  );
}

export async function writeRemoteOnboarding(
  supabase: SupabaseClient,
  userId: string,
  state: PersistedOnboarding
): Promise<void> {
  await supabase
    .from("profiles")
    .update({ onboarding_progress: state })
    .eq("id", userId);
}
