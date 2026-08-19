import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { ProjectManager } from "@/components/project-manager";
import { getProfileSummary } from "@/lib/profile";

export default async function ProjectsPage({
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
      title="Projects"
      subtitle="Prioritize work across initiatives and milestones."
      userName={summary.displayName}
      username={summary.username ?? undefined}
    >
      <ProjectManager
        userId={summary.userId}
        workspaceId={summary.workspaceId}
        initialNew={params?.new === "1"}
      />
    </NexusShell>
  );
}
