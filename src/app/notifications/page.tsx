import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { NotificationCenter } from "@/components/notification-center";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
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
    <NexusShell title="Notifications" subtitle="Review workspace alerts and updates." userName={userName} username={username}>
      <NotificationCenter userId={user.id} />
    </NexusShell>
  );
}
