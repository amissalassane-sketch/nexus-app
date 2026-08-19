import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { NotificationCenter } from "@/components/notification-center";
import { getProfileSummary } from "@/lib/profile";

export default async function NotificationsPage() {
  const summary = await getProfileSummary();

  if (!summary) {
    redirect("/login");
  }

  return (
    <NexusShell
      title="Notifications"
      subtitle="Review workspace alerts and updates."
      userName={summary.displayName}
      username={summary.username ?? undefined}
    >
      <NotificationCenter userId={summary.userId} workspaceId={summary.workspaceId} />
    </NexusShell>
  );
}
