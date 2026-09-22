import { CalendarManager } from "@/components/calendar/calendar-manager";
import { requireUser } from "@/lib/auth";

export const metadata = {
  title: "Calendar. NEXUS",
  description: "Your time, connected to your work.",
};

export default async function Page() {
  const user = await requireUser();
  return <CalendarManager userId={user.id} />;
}
