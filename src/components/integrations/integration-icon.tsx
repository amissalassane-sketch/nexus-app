import { IconWebhook } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { siGithub, siGooglecalendar, siJira, siLinear, siNotion } from "simple-icons";

// Slack asked to be removed from Simple Icons (trademark request), so its
// official mark is inlined here as a monochrome path, sourced from the last
// Simple Icons release that shipped it (simple-icons@10.4.0).
const SLACK_PATH =
  "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z";

type BrandIcon = { title: string; path: string };

const BRAND_ICONS: Record<string, BrandIcon> = {
  "google-calendar": { title: siGooglecalendar.title, path: siGooglecalendar.path },
  github: { title: siGithub.title, path: siGithub.path },
  slack: { title: "Slack", path: SLACK_PATH },
  notion: { title: siNotion.title, path: siNotion.path },
  linear: { title: siLinear.title, path: siLinear.path },
  jira: { title: siJira.title, path: siJira.path },
};

export function IntegrationIcon({ id, size = 16, className }: { id: string; size?: number; className?: string }) {
  const brand = BRAND_ICONS[id];

  if (brand) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={`${brand.title} logo`} className={className} fill="currentColor">
        <path d={brand.path} />
      </svg>
    );
  }

  // Non-brand integrations (e.g. NEXUS Webhooks) keep a neutral glyph.
  return <NexusIcon icon={IconWebhook} px={size} className={className} />;
}
