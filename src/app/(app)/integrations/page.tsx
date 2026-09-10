import { PlugZap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { IntegrationHub } from "@/components/integrations/integration-hub";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";

export const metadata = {
  title: "Integrations. NEXUS",
  description: "Connect the tools your work already lives in so NEXUS can read them.",
};

export default async function IntegrationsPage() {
  await requireUser();
  const connectedCount = INTEGRATION_CATALOG.filter((integration) => integration.available).length;

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Integrations"
        count={`${connectedCount} connected`}
        description="The external systems NEXUS is preparing to connect to your workspace. Context first, actions only when they are safe and real."
      />

      <Alert tone="info" title="External connections are not configured in this deployment">
        NEXUS already understands the work created inside this workspace. External providers will appear here when their server-side connection, permissions and sync path are ready. Nothing is simulated.
      </Alert>

      <IntegrationHub />

      <Panel title="What NEXUS already understands" description="No external connection required">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary"><PlugZap size={16} aria-hidden="true" /></span>
          <p className="max-w-[62ch] text-small text-text-secondary">Projects, tasks, goals, activity, notifications and Intelligence are already connected inside your workspace. External integrations will extend that context; they will not replace the NEXUS core.</p>
        </div>
      </Panel>
    </div>
  );
}
