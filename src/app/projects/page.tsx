import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { ProjectManager } from "@/components/project-manager";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const userName = profile?.display_name || profile?.username || user.email || "User";
  const username = profile?.username || undefined;

  return (
    <NexusShell title="Projects" subtitle="Prioritize work across initiatives and milestones." userName={userName} username={username}>
      <ProjectManager userId={user.id} />
    </NexusShell>
  );
}
