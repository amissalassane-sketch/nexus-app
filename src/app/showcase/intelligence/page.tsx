import type { Metadata } from "next";
import { ShowcaseShell } from "@/components/showcase/showcase-shell";
import { IntelligenceShowcaseView } from "@/components/showcase/intelligence-showcase-view";

export const metadata: Metadata = {
  title: "AI Intelligence Showcase — NEXUS Motion Design Asset",
  description: "Motion-design visual asset for NEXUS Intelligence, Signals, Next Best Action and Missions.",
};

export default function ShowcaseIntelligencePage() {
  return (
    <ShowcaseShell activeTab="intelligence">
      <IntelligenceShowcaseView />
    </ShowcaseShell>
  );
}
