import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { ProjectManager } from "@/components/project-manager";
import { getProfileSummary } from "@/lib/profile";

export default async function ProjectsPage() {
  const summary = await getProfileSummary();

  if (!summary) {
    redirect("/login");
  }

  return (
    <NexusShell
      title="Projects"
      subtitle="Prioritize work across initiatives and milestones."
      userName={summary.displayName}
      username={summary.username ?? undefined}
    >
      <ProjectManager userId={summary.userId} workspaceId={summary.workspaceId} />
    </NexusShell>
  );
}
