import { ProjectManager } from "@/components/project-manager";
import { requireUser } from "@/lib/auth";

export default async function Page() {
  const user = await requireUser();

  return <ProjectManager userId={user.id} />;
}
