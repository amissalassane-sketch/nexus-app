"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
type MemoryExport = { scope: string; workspaceId: string; exportedAt: string; memory: unknown; excluded: string[] };
export function PrivacySettings() {
  const [data, setData] = useState<MemoryExport | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings/privacy", { cache: "no-store", signal: controller.signal }).then(async r => { if (!r.ok) throw new Error(); setData(await r.json()); }).catch(e => { if (e.name !== "AbortError") setError("We could not load your memory. Reload this page to retry. Nothing has been deleted."); }).finally(() => setBusy(false));
    return () => controller.abort();
  }, []);
  function download() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "nexus-memory-partial-export.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function clear() {
    if (!data || !confirmed) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/settings/privacy", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE_MY_MEMORY", workspaceId: data.workspaceId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Deletion was not confirmed. Reload and retry.");
      setData(null); setConfirmed(false); setMessage("Your stored memory in this workspace was deleted. New or in-flight AI requests may create it again. Reload to inspect new memory.");
    } catch (e) { setError(e instanceof Error ? e.message : "Deletion was not confirmed."); } finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <section className="rounded-card border border-border-default bg-bg-surface p-5 space-y-4" aria-labelledby="memory-heading">
      <h2 id="memory-heading" className="text-lg font-medium">Your AI memory</h2>
      <p className="text-text-secondary">Only your memory in the active workspace is shown. It can include recent questions, entity references and explicit preferences. It is not a full account export.</p>
      <p className="text-text-secondary">Close other AI tabs and wait for running requests before deleting. This does not erase activity logs, documents, provider copies or backups, and does not disable future memory.</p>
      {busy && <p role="status">Loading…</p>}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {message && <p role="status" className="text-success">{message}</p>}
      {data && <>
        <details className="rounded-input border border-border-default p-3"><summary className="min-h-8 cursor-pointer">Inspect memory before exporting or deleting</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(data.memory, null, 2)}</pre></details>
        <Button variant="secondary" onClick={download} disabled={busy}>Download memory only (JSON)</Button>
        <label className="flex items-start gap-3 text-small"><input type="checkbox" className="mt-1 h-5 w-5" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed the scope and want to delete my stored memory in this workspace.</label>
        <Button variant="danger" disabled={!confirmed || busy || !data.memory} onClick={clear}>Delete my memory</Button>
      </>}
    </section>
    <section className="rounded-card border border-border-default bg-bg-surface p-5 space-y-3"><h2 className="text-lg font-medium">Other data controls</h2>
      <ul className="list-disc space-y-3 pl-5 text-text-secondary"><li><Link className="underline" href="/files">Manage uploaded documents</Link>. Files are stored; automated AI extraction and document analysis are not available.</li><li><Link className="underline" href="/integrations">Manage connected apps</Link>. Disconnecting locally does not prove provider-side token revocation. Revoke NEXUS in the provider account too.</li><li><Link className="underline" href="/settings/regional">Regional preferences</Link> affect formatting previews, not the workspace legal country.</li><li><Link className="underline" href="/settings">Profile settings</Link> allow profile corrections.</li></ul>
      <p className="text-text-secondary">Full account export, permanent account deletion, and data-subject requests (access, objection, restriction) are handled via support on request. Contact us through the support channel listed in our privacy policy — we respond within 30 days.</p>
      <p className="text-text-secondary">No network analytics or marketing tracker was identified in this code audit. Appearance is a local preference; authentication cookies are necessary. <Link className="underline" href="/cookies">Cookie details</Link>.</p>
    </section>
  </div>;
}
