import type { Metadata } from "next";
import { getAdminActivity, parseAdminListQuery } from "@/lib/admin/activity-security";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { AdminPanel, AdminSectionTitle } from "@/components/admin/panel";
import { AdminEmptyState, AdminErrorState } from "@/components/admin/states";
import { AdminListToolbar, AdminPagination, AdminSelectFilter } from "@/components/admin/list-controls";
import { formatDateTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity", robots: { index: false, follow: false } };
const PATH = "/admin/activity";
const actions = [{ value: "all", label: "All actions" }, { value: "created", label: "Created" }, { value: "updated", label: "Updated" }, { value: "completed", label: "Completed" }, { value: "deleted", label: "Deleted" }];

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseAdminListQuery(await searchParams, "action");
  const result = await getAdminActivity(query);
  return <div className="mx-auto flex w-full max-w-page flex-col gap-5">
    <header className="flex items-start justify-between gap-3"><div><h1 className="text-[22px] font-semibold text-admin-text">Activity</h1><p className="mt-1 text-[13px] text-admin-text-2">Read-only workspace activity from public.activities. No rows are invented when the read is unavailable.</p></div><AdminRefreshButton /></header>
    <AdminListToolbar pathname={PATH} query={{ ...query, action: query.filter, status: "all", sort: "created_at", direction: "desc" } as never} hasActiveFilters={!!query.search || query.filter !== "all"}><AdminSelectFilter id="activity-action" name="action" label="Action" value={query.filter} options={actions} /></AdminListToolbar>
    {result.state === "unavailable" ? <AdminPanel><AdminErrorState error={result.error} /></AdminPanel> : result.state === "empty" ? <AdminPanel><AdminEmptyState icon="activity" title="No activity matches" description="The read succeeded but no public.activities row matched these filters." /></AdminPanel> : <AdminPanel padded={false}><div className="p-4"><AdminSectionTitle title="Recorded activity" description={`${result.payload.total} rows matched; newest first.`} /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[12.5px]"><caption className="sr-only">Recorded workspace activity</caption><thead><tr className="border-y border-admin-border font-mono text-[10px] uppercase text-admin-text-3"><th scope="col" className="px-4 py-2">Action</th><th scope="col" className="px-4 py-2">Entity</th><th scope="col" className="px-4 py-2">Workspace</th><th scope="col" className="px-4 py-2">Occurred</th></tr></thead><tbody>{result.payload.items.map((item) => <tr key={String(item.id)} className="border-b border-admin-border/60"><td className="px-4 py-2.5 text-admin-text">{String(item.action ?? "Unspecified")}</td><td className="px-4 py-2.5 text-admin-text-2">{String(item.entity_type ?? "—")}</td><td className="px-4 py-2.5 text-admin-text-2">{String(item.workspace_name ?? "Unavailable")}</td><td className="px-4 py-2.5 font-mono text-[11px] text-admin-text-3">{formatDateTime(String(item.occurred_at))}</td></tr>)}</tbody></table></div><div className="p-4"><AdminPagination pathname={PATH} query={{ ...query, action: query.filter, status: "all", sort: "created_at", direction: "desc" } as never} page={result.payload.page} total={result.payload.total} pageSize={result.payload.page_size} unitLabel="activity rows" /></div></AdminPanel>}
  </div>;
}
