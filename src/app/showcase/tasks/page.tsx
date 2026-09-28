import type { Metadata } from "next";
import { ShowcaseShell } from "@/components/showcase/showcase-shell";
import { TasksShowcaseView } from "@/components/showcase/tasks-showcase-view";

export const metadata: Metadata = {
  title: "Tasks Kanban Showcase — NEXUS Motion Design Asset",
  description: "Motion-design visual asset for NEXUS Tasks Kanban board.",
};

export default function ShowcaseTasksPage() {
  return (
    <ShowcaseShell activeTab="tasks">
      <TasksShowcaseView />
    </ShowcaseShell>
  );
}
