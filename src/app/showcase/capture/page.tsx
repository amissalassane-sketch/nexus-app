import type { Metadata } from "next";
import { ShowcaseShell } from "@/components/showcase/showcase-shell";
import { CaptureShowcaseView } from "@/components/showcase/capture-showcase-view";

export const metadata: Metadata = {
  title: "Capture & NLP Showcase — NEXUS Motion Design Asset",
  description: "Motion-design visual asset for NEXUS Natural Language Universal Capture.",
};

export default function ShowcaseCapturePage() {
  return (
    <ShowcaseShell activeTab="capture">
      <CaptureShowcaseView />
    </ShowcaseShell>
  );
}
