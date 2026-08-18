import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { UserSettingsPanel } from "@/components/user-settings-panel";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
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
    <NexusShell title="Settings" userName={userName} username={username}>
      <UserSettingsPanel userId={user.id} />
    </NexusShell>
  );
}
