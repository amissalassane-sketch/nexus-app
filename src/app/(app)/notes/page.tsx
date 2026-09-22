import { NotesManager } from "@/components/notes/notes-manager";
import { requireUser } from "@/lib/auth";

export const metadata = {
  title: "Notes. NEXUS",
  description: "Operational knowledge attached to your work.",
};

export default async function Page() {
  const user = await requireUser();
  return <NotesManager userId={user.id} />;
}
