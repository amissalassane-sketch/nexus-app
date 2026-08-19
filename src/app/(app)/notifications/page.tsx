import { NotificationCenter } from "@/components/notification-center";
import { requireUser } from "@/lib/auth";

export default async function Page() {
  const user = await requireUser();

  return <NotificationCenter userId={user.id} />;
}
