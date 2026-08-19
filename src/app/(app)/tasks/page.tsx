import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { TaskManager } from "@/components/task-manager";
import { getProfileSummary } from "@/lib/profile";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const summary = await getProfileSummary();

  if (!summary) {
    redirect("/login");
  }

  const params = await searchParams;

  return (
    <NexusShell
      title="Tasks"
      subtitle="Track your priorities and execution."
      userName={summary.displayName}
      username={summary.username ?? undefined}
    >
      <TaskManager
        userId={summary.userId}
        workspaceId={summary.workspaceId}
        initialNew={params?.new === "1"}
      />
    </NexusShell>
  );
}
