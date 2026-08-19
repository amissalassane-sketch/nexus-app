import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { createClient } from "@/lib/supabase/server";
import { getProfileSummary } from "@/lib/profile";
import { parsePreferences, type Preferences } from "@/lib/preferences";

export default async function SettingsPage() {
  const summary = await getProfileSummary();

  if (!summary) {
    redirect("/login");
  }

  // Guarded read: profiles.preferences may be absent until migration 013.
  const supabase = await createClient();
  let initialPreferences: Preferences | null = null;
  const { data: prefsRow, error: prefsError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", summary.userId)
    .maybeSingle();

  if (!prefsError && prefsRow?.preferences) {
    initialPreferences = parsePreferences(prefsRow.preferences);
  }

  return (
    <NexusShell
      title="Settings"
      subtitle="Customize your account, workspace and preferences."
      userName={summary.displayName}
      username={summary.username ?? undefined}
    >
      <SettingsPanel summary={summary} initialPreferences={initialPreferences} />
    </NexusShell>
  );
}
