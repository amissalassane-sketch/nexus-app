import { FilesManager } from "@/components/files/files-manager";
import { requireUser } from "@/lib/auth";

export const metadata = {
  title: "Files. NEXUS",
  description: "Documents attached to your work, stored privately per workspace.",
};

export default async function Page() {
  const user = await requireUser();
  return <FilesManager userId={user.id} />;
}
