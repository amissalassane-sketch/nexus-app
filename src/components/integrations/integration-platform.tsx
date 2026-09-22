"use client";

// ============================================================
// NEXUS — INTEGRATION PLATFORM UI
// ============================================================
// Real connection cards: state, permissions, last sync, errors,
// connect / sync / disconnect. Every state shown here comes from the
// server (database + environment) — nothing is simulated, and a
// provider that is not configured says exactly what is missing.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconCheck,
  IconClockExclamation,
  IconPlugConnectedX,
  IconRefresh,
  IconShieldCheck,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IntegrationIcon } from "@/components/integrations/integration-icon";
import {
  CONNECTION_STATE_DESCRIPTION,
  CONNECTION_STATE_LABEL,
  type ConnectionLifecycleState,
} from "@/lib/integrations/providers";
import type { ProviderStatusView } from "@/lib/integrations/view";
import { cn } from "@/lib/cn";

const relativeTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown time";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
};

const STATE_TONE: Record<ConnectionLifecycleState, "success" | "warning" | "danger" | "neutral" | "info"> = {
  disconnected: "neutral",
  connecting: "info",
  connected: "success",
  syncing: "info",
  stale: "warning",
  error: "danger",
  reauth_required: "danger",
};

const STATE_ICON: Partial<Record<ConnectionLifecycleState, typeof IconCheck>> = {
  connected: IconCheck,
  stale: IconClockExclamation,
  error: IconAlertTriangle,
  reauth_required: IconPlugConnectedX,
};

export function IntegrationPlatform({
  providers,
  connectedNotice,
  connectError,
  connectMessage,
}: {
  providers: ProviderStatusView[];
  connectedNotice: string | null;
  connectError: string | null;
  connectMessage: string | null;
}) {
  const [pendingDisconnect, setPendingDisconnect] = useState<ProviderStatusView | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const sync = async (provider: ProviderStatusView) => {
    setBusyProvider(provider.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/integrations/${provider.id}/sync`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setActionError(
          payload?.error ?? `${provider.name} sync failed. Try again in a moment.`
        );
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setActionError(`${provider.name} sync failed — the server did not answer. Try again.`);
    } finally {
      setBusyProvider(null);
    }
  };

  const disconnect = async (provider: ProviderStatusView) => {
    setBusyProvider(provider.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/integrations/${provider.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setActionError(
          payload?.error ?? `${provider.name} could not be disconnected.`
        );
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setActionError(`${provider.name} could not be disconnected — the server did not answer.`);
    } finally {
      setBusyProvider(null);
      setPendingDisconnect(null);
    }
  };

  if (providers.length === 0) {
    return (
      <EmptyState
        title="No integration providers"
        description="No provider is registered in this build. This should never happen — it means the provider registry is empty."
      />
    );
  }

  return (
    <div className="space-y-4">
      {connectedNotice ? (
        <div className="flex items-start gap-3 rounded-input border border-lavender-border bg-accent-ghost px-3.5 py-3 text-small text-text-secondary">
          <NexusIcon icon={IconCheck} className="mt-0.5 shrink-0 text-lavender-text" />
          <p>
            <span className="font-medium text-text-primary">{connectedNotice} is connected.</span>{" "}
            Its data stays at the provider — NEXUS reads it through the adapter and always shows
            where information comes from.
          </p>
        </div>
      ) : null}

      {connectError || actionError ? (
        <div className="flex items-start gap-3 rounded-input border border-danger-border bg-danger-bg px-3.5 py-3 text-small text-text-secondary" role="alert">
          <NexusIcon icon={IconAlertTriangle} className="mt-0.5 shrink-0 text-danger-text" />
          <div className="min-w-0">
            <p className="font-medium text-text-primary">The connection could not be completed</p>
            <p className="mt-0.5 break-words">{connectMessage ?? actionError}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            busy={busyProvider === provider.id}
            onSync={() => sync(provider)}
            onDisconnect={() => setPendingDisconnect(provider)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={pendingDisconnect !== null}
        title={pendingDisconnect ? `Disconnect ${pendingDisconnect.name}` : ""}
        description={
          pendingDisconnect
            ? `NEXUS will stop reading ${pendingDisconnect.name} for this workspace. Nothing is deleted at ${pendingDisconnect.name} — you can revoke access there anytime, and reconnect here in one click.`
            : ""
        }
        confirmLabel={pendingDisconnect ? `Disconnect ${pendingDisconnect.name}` : "Disconnect"}
        onConfirm={() => {
          if (pendingDisconnect) void disconnect(pendingDisconnect);
        }}
        onClose={() => setPendingDisconnect(null)}
      />
    </div>
  );
}

function ProviderCard({
  provider,
  busy,
  onSync,
  onDisconnect,
}: {
  provider: ProviderStatusView;
  busy: boolean;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const { connection } = provider;
  const state = connection.lifecycle;
  const StateIcon = STATE_ICON[state];
  const implemented = provider.capabilities.filter((c) => c.adapter === "implemented");
  const planned = provider.capabilities.filter((c) => c.adapter === "planned");

  const connectHref = provider.oauthConfigured
    ? `/api/integrations/${provider.id}/connect`
    : null;

  return (
    <article
      className={cn(
        "flex flex-col rounded-card border bg-bg-subtle/70 p-4 transition-colors",
        connection.connectionId ? "border-border-default" : "border-border-subtle"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
          <IntegrationIcon id={provider.id} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-h3 text-text-primary">{provider.name}</h2>
              <p className="mt-0.5 text-caption text-text-tertiary">
                {provider.categoryLabel}
                {provider.phase === 2 ? " · coming later" : ""}
              </p>
            </div>
            <Badge tone={STATE_TONE[state]}>
              {StateIcon ? <NexusIcon icon={StateIcon} className="h-3 w-3" /> : null}
              {CONNECTION_STATE_LABEL[state]}
            </Badge>
          </div>
          <p className="mt-2.5 text-small text-text-secondary">{provider.description}</p>
        </div>
      </div>

      {/* State explanation + account + last sync — always concrete */}
      <div className="mt-3 space-y-1.5 rounded-input border border-border-subtle bg-bg-surface px-3 py-2.5">
        <p className="text-caption text-text-secondary">{CONNECTION_STATE_DESCRIPTION[state]}</p>
        {connection.accountLabel ? (
          <p className="font-mono text-caption text-text-tertiary">Account · {connection.accountLabel}</p>
        ) : null}
        {connection.lastSyncAt ? (
          <p className="font-mono text-caption text-text-tertiary">
            Last sync · {relativeTime(connection.lastSyncAt)}
          </p>
        ) : connection.connectionId ? (
          <p className="font-mono text-caption text-text-tertiary">Never synced</p>
        ) : null}
        {connection.lastError ? (
          <p className="text-caption text-danger-text" role="alert">
            {connection.lastError}
          </p>
        ) : null}
        {!provider.oauthConfigured ? (
          <p className="text-caption text-text-tertiary">
            Not configured on this server — requires{" "}
            <span className="font-mono">{provider.missingEnvVars.join(" and ")}</span>.
          </p>
        ) : null}
      </div>

      {/* Permissions, shown before connecting */}
      {provider.scopes.length > 0 ? (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-caption text-text-tertiary transition-colors hover:text-text-secondary">
            <NexusIcon icon={IconShieldCheck} className="h-3.5 w-3.5" />
            Permissions NEXUS will request
          </summary>
          <ul className="mt-2 space-y-1.5 pl-1">
            {provider.scopes.map((scope) => (
              <li key={scope} className="text-caption leading-relaxed text-text-tertiary">
                <span className="font-mono text-[11px] text-text-secondary">{scope}</span>
                {provider.scopeNotes[scope] ? (
                  <span className="block">{provider.scopeNotes[scope]}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Capability model — implemented vs planned, never blended */}
      {implemented.length > 0 || planned.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {implemented.map((capability) => (
            <span
              key={capability.id}
              className="rounded-pill border border-lavender-border bg-accent-ghost px-2 py-0.5 text-caption text-lavender-text"
            >
              {capability.label}
            </span>
          ))}
          {planned.map((capability) => (
            <span
              key={capability.id}
              className="rounded-pill border border-border-subtle px-2 py-0.5 text-caption text-text-quaternary"
              title={`${capability.label} — server adapter not implemented yet`}
            >
              {capability.label} · planned
            </span>
          ))}
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <span className="text-caption text-text-quaternary">
          {connection.connectionId
            ? "Reading stays at the provider. Writing always asks first."
            : provider.oauthConfigured
              ? "You choose what to connect. Nothing is read before that."
              : "Server connection required"}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {connection.connectionId ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={onSync}
                disabled={busy || state === "syncing"}
                title={`Read the latest ${provider.name} data`}
              >
                <NexusIcon icon={IconRefresh} className={busy ? "animate-spin" : undefined} />
                Sync now
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDisconnect}
                disabled={busy}
                title={`Stop reading ${provider.name} from this workspace`}
              >
                Disconnect
              </Button>
            </>
          ) : connectHref ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                window.location.href = connectHref;
              }}
              disabled={busy}
              title={`Connect ${provider.name}`}
            >
              Connect {provider.name}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled title="This provider is not configured on this server">
              Connect {provider.name}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
