import { requirePlatformAdminContext } from "@/lib/admin/guard";
import { detectAIProvider } from "@/lib/intelligence/ai-provider";
import { getIntelligenceHealth } from "@/lib/admin/data";
import { AdminPanel, AdminSectionTitle, AdminField, AdminFieldList } from "@/components/admin/panel";
import { AdminErrorState } from "@/components/admin/states";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { formatCount, formatMs, formatRelativeOr } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intelligence", robots: { index: false, follow: false } };

export default async function AdminIntelligencePage() {
  // A layout alone is not an authorization boundary for page data.
  if (!(await requirePlatformAdminContext())) return null;
  const config = detectAIProvider();
  const external = config.provider !== "nexus-engine";
  const health = await getIntelligenceHealth();
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-h1 text-admin-text">Intelligence</h1>
      <AdminRefreshButton />
    </header>
    <AdminPanel>
      <AdminSectionTitle title="Provider configuration" description="Environment presence is not a successful provider request. No API key is displayed or returned." />
      <AdminFieldList>
        <AdminField label="Selected provider" value={config.provider} />
        <AdminField label="Model" value={config.model ?? "Deterministic NEXUS Engine"} />
        <AdminField label="External provider state" value={external ? "CONFIGURED · NOT VERIFIED" : "NOT_CONFIGURED"} />
        <AdminField label="Fallback" value="NEXUS Engine implemented" />
        <AdminField label="Live provider check" value="Not performed" />
      </AdminFieldList>
      <p className="mt-3 text-small text-admin-text-2">Run an authorized Intelligence request to exercise the provider. A configured key does not prove validity, quota or model access. INVALID_KEY, QUOTA_EXCEEDED, RATE_LIMITED and current operational health are not yet persisted separately.</p>
    </AdminPanel>
    <AdminPanel>
      <AdminSectionTitle title="Recorded request activity" description="Source: admin_intelligence_health(), aggregated from intelligence_request_log. These member-written records are not an independent provider audit." />
      {health.state === "ok" ? <AdminFieldList>
        <AdminField label="Requests · 24 hours" value={formatCount(health.data.requests_24h)} />
        <AdminField label="Recorded errors · 24 hours" value={formatCount(health.data.errors_24h)} hint="Not a complete provider error count" />
        <AdminField label="Recorded fallbacks · 24 hours" value={formatCount(health.data.fallbacks_24h)} />
        <AdminField label="Average agent latency · 24 hours" value={formatMs(health.data.avg_latency_ms_24h)} />
        <AdminField label="Last recorded request" value={formatRelativeOr(health.data.last_request_at, "No request recorded")} />
      </AdminFieldList> : <AdminErrorState error={health.error} />}
      <p className="mt-3 text-small text-admin-text-2">Token usage and provider cost are not instrumented end to end. No zero-cost or zero-token estimate is shown. External integrations and document content are not currently supplied to the model.</p>
    </AdminPanel>
  </div>;
}
