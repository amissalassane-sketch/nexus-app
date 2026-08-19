import { GoalManager } from "@/components/goal-manager";
import { requireUser } from "@/lib/auth";

export default async function Page() {
  const user = await requireUser();

  return <GoalManager userId={user.id} />;
}
