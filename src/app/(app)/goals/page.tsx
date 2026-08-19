import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { GoalManager } from "@/components/goal-manager";
import { getProfileSummary } from "@/lib/profile";

export default async function GoalsPage({
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
      title="Goals"
      subtitle="Keep your long-term progress visible and measurable."
      userName={summary.displayName}
      username={summary.username ?? undefined}
    >
      <GoalManager
        userId={summary.userId}
        workspaceId={summary.workspaceId}
        initialNew={params?.new === "1"}
      />
    </NexusShell>
  );
}
