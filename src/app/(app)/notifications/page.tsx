import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { NotificationCenter } from "@/components/notification-center";
import { createClient } from "@/lib/supabase/server";
import { getProfileSummary } from "@/lib/profile";
import { parsePreferences } from "@/lib/preferences";

export default async function NotificationsPage() {
  const summary = await getProfileSummary();

  if (!summary) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: prefsRow } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", summary.userId)
    .maybeSingle();

  return (
    <NexusShell
      title="Notifications"
      subtitle="Review workspace alerts and updates."
      userName={summary.displayName}
      username={summary.username ?? undefined}
    >
      <NotificationCenter
        userId={summary.userId}
        workspaceId={summary.workspaceId}
        preferences={prefsRow?.preferences ? parsePreferences(prefsRow.preferences) : undefined}
      />
    </NexusShell>
  );
}
