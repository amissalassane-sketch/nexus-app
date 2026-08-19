import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { UserSettingsPanel } from "@/components/user-settings-panel";
import { getProfileSummary } from "@/lib/profile";

export default async function SettingsPage() {
  const summary = await getProfileSummary();

  if (!summary) {
    redirect("/login");
  }

  return (
    <NexusShell
      title="Settings"
      subtitle="Customize your workspace and preferences."
      userName={summary.displayName}
      username={summary.username ?? undefined}
    >
      <UserSettingsPanel summary={summary} />
    </NexusShell>
  );
}
