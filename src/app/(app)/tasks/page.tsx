import { TaskManager } from "@/components/task-manager";
import { requireUser } from "@/lib/auth";

export default async function Page() {
  const user = await requireUser();

  return <TaskManager userId={user.id} />;
}
