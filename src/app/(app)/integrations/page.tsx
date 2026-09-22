import { IconPlugConnected, IconShieldLock } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/workspace";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { IntegrationPlatform } from "@/components/integrations/integration-platform";
import { buildIntegrationsSnapshot } from "@/lib/integrations/view";
import { anyProviderConfigured } from "@/lib/integrations/providers";

export const metadata = {
  title: "Integrations. NEXUS",
  description:
    "Connect the tools your work already lives in so NEXUS can read them.",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();

  const params = await searchParams;
  const connectedNotice =
    typeof params.connected === "string" && params.connected
      ? params.connected
      : null;
  const connectError =
    typeof params.connect_error === "string" && params.connect_error
      ? params.connect_error
      : null;
  const connectMessage =
    typeof params.connect_message === "string" && params.connect_message
      ? params.connect_message
      : null;

  const supabase = await createClient();
  const { membership } = await getActiveMembership(supabase, user.id);
  const workspaceId = membership?.workspaceId ?? null;

  const snapshot = workspaceId
    ? await buildIntegrationsSnapshot(supabase, workspaceId)
    : null;

  const connectedCount =
    snapshot?.providers.filter((p) => p.connection.connectionId !== null).length ?? 0;
  const anyConfigured = anyProviderConfigured();

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Integrations"
        count={connectedCount > 0 ? `${connectedCount} connected` : undefined}
        description="Sources NEXUS can read for context, and the actions they unlock for Intelligence. Every connection states exactly what it can do — nothing is advertised before its server path exists."
      />

      {!anyConfigured ? (
        <Alert
          tone="info"
          title="No provider is configured on this server yet"
        >
          Connections are built and secure (OAuth, minimum permissions, tokens sealed at
          rest), but this deployment has no provider client registered. An operator must
          set the provider environment variables (for example{" "}
          <span className="font-mono text-caption">GOOGLE_CLIENT_ID</span> and{" "}
          <span className="font-mono text-caption">GOOGLE_CLIENT_SECRET</span>) to turn
          them on. Each card below names the exact variables it needs.
        </Alert>
      ) : null}

      {snapshot ? (
        <IntegrationPlatform
          providers={snapshot.providers}
          connectedNotice={connectedNotice}
          connectError={connectError}
          connectMessage={connectMessage}
        />
      ) : (
        <Panel>
          <EmptyState
            title="No active workspace"
            description="Integrations are connected per workspace. Open a workspace to manage its sources."
          />
        </Panel>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="What NEXUS already understands" description="No external connection required">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary">
              <NexusIcon icon={IconPlugConnected} />
            </span>
            <p className="max-w-[62ch] text-small text-text-secondary">
              Projects, tasks, goals, notes, events, files, activity, notifications and
              Intelligence are already connected inside your workspace. External
              integrations extend that context; they never replace the NEXUS core.
            </p>
          </div>
        </Panel>

        <Panel title="How connections behave" description="The rules every provider follows">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary">
              <NexusIcon icon={IconShieldLock} />
            </span>
            <ul className="max-w-[62ch] space-y-1.5 text-small text-text-secondary">
              <li>OAuth only — NEXUS never asks for an API key when OAuth exists.</li>
              <li>Minimum permissions, listed before you connect.</li>
              <li>Tokens are sealed at rest and never sent to your browser.</li>
              <li>Reading is automatic once connected. Writing always asks first.</li>
              <li>External data stays at the provider — NEXUS references it, cites it, and drops it when access ends.</li>
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  );
}
