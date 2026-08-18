import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { TaskManager } from "@/components/task-manager";
import { createClient } from "@/lib/supabase/server";

export default async function TasksPage() {
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
    <NexusShell title="Tasks" subtitle="Track your priorities and execution." userName={userName} username={username}>
      <TaskManager userId={user.id} />
    </NexusShell>
  );
}
