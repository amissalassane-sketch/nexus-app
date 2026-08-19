import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { TaskManager } from "@/components/task-manager";
import { getProfileSummary } from "@/lib/profile";

export default async function TasksPage() {
  const summary = await getProfileSummary();

  if (!summary) {
    redirect("/login");
  }

  return (
    <NexusShell
      title="Tasks"
      subtitle="Track your priorities and execution."
      userName={summary.displayName}
      username={summary.username ?? undefined}
    >
      <TaskManager userId={summary.userId} workspaceId={summary.workspaceId} />
    </NexusShell>
  );
}
