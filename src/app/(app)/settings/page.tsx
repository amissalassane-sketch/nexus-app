import { UserSettingsPanel } from "@/components/user-settings-panel";
import { requireUser } from "@/lib/auth";

export default async function Page() {
  const user = await requireUser();

  return <UserSettingsPanel userId={user.id} />;
}
