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
    ? await buildIntegrationsSnapshot(supabase, workspaceId).catch(() => null)
    : null;

  const connectedCount =
    snapshot?.providers.filter((p) => p.connection.lifecycle === "connected").length ?? 0;
  const anyConfigured = anyProviderConfigured();

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Integrations"
        count={connectedCount > 0 ? `${connectedCount} connected` : undefined}
        description="Manage OAuth accounts and check available adapters. Connecting an account does not verify sync or make it available to Intelligence."
      />

      {!anyConfigured ? (
        <Alert
          tone="info"
          title="No provider is configured on this server yet"
        >
          OAuth routes and encrypted storage are implemented, but no provider client is configured in this deployment. An operator must
          set the provider environment variables (for example{" "}
          <span className="font-mono text-caption">GOOGLE_CLIENT_ID</span> and{" "}
          <span className="font-mono text-caption">GOOGLE_CLIENT_SECRET</span>) to turn
          them on. Each card below names the exact variables it needs.
        </Alert>
      ) : null}

      {workspaceId && !snapshot ? <Alert tone="danger" title="Connection status could not be read">Check the database configuration and integration migrations, then refresh. No connection status has been inferred.</Alert> : null}
      {snapshot && !snapshot.encryptionConfigured ? <Alert tone="warning" title="Secure credential storage is not configured">Set NEXUS_INTEGRATION_ENCRYPTION_KEY on the server before connecting accounts.</Alert> : null}
      {snapshot ? (
        <IntegrationPlatform
          providers={snapshot.providers}
          connectedNotice={snapshot.providers.find((p) => p.id === connectedNotice && p.connection.lifecycle === "connected")?.name ?? null}
          connectError={connectError}
          connectMessage={connectMessage}
        />
      ) : !workspaceId ? (
        <Panel>
          <EmptyState
            title="No active workspace"
            description="Integrations are connected per workspace. Open a workspace to manage its sources."
          />
        </Panel>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="What NEXUS already understands" description="No external connection required">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary">
              <NexusIcon icon={IconPlugConnected} />
            </span>
            <p className="max-w-[62ch] text-small text-text-secondary">
              Intelligence reads workspace tasks, projects, goals and activity, with bounded note and event metadata. File content and external provider data are not yet included in its answers.
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
              <li>Requested permissions are listed before connection. Provider restrictions still apply.</li>
              <li>Tokens are encrypted at rest. Plaintext tokens are not returned by NEXUS routes.</li>
              <li>Only Google Calendar has a data adapter, invoked by Sync now. External write actions are not implemented.</li>
              <li>Disconnect removes the stored connection and credentials. Revoke the OAuth grant separately in provider settings.</li>
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  );
}
