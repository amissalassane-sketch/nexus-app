import type { Metadata } from "next";
import Link from "next/link";
import { getAdminActivity, parseAdminListQuery } from "@/lib/admin/activity-security";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { AdminTimeCell } from "@/components/admin/directory";
import {
  AdminListSummary,
  AdminListToolbar,
  AdminPagination,
  AdminSelectFilter,
} from "@/components/admin/list-controls";
import { AdminPanel, AdminPanelHeader } from "@/components/admin/panel";
import { AdminEmptyState, AdminErrorState } from "@/components/admin/states";
import {
  AdminCardItem,
  AdminCardList,
  AdminStaticRow,
  AdminTableShell,
  AdminTd,
  AdminTh,
} from "@/components/admin/table";
import { NOT_AVAILABLE } from "@/lib/admin/format";

// ============================================================
// NEXUS ADMIN — ACTIVITY (PR 3)
// ============================================================
// What happened inside the product, across every workspace, read from
// public.activities. This is the operator's answer to "did anything move
// today, and where".
//
//   WHAT      action, in the monospace technical layer
//   WHAT-ON   entity_type / entity_id
//   WHERE     the workspace, linked to its inspector when the row still
//             carries a workspace id
//   WHEN      occurredAt, relative with absolute UTC in the title
//
// It is a record, not a directory: rows are not themselves navigable, so
// only the workspace name is a link. No row is invented when the read is
// unavailable — an unreadable stream is never an empty one.
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activity",
  robots: { index: false, follow: false },
};

const PATH = "/admin/activity";

const ACTIONS = [
  { value: "all", label: "All actions" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "completed", label: "Completed" },
  { value: "deleted", label: "Deleted" },
];

type ActivityRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  occurredAt: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** One derivation for both representations. */
function toRow(item: Record<string, unknown>): ActivityRow {
  return {
    id: String(item.id ?? ""),
    action: text(item.action) ?? "Unspecified",
    entityType: text(item.entity_type),
    entityId: text(item.entity_id),
    workspaceId: text(item.workspace_id),
    workspaceName: text(item.workspace_name),
    occurredAt: text(item.occurred_at),
  };
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseAdminListQuery(await searchParams, "action");
  const result = await getAdminActivity(query);
  const rows = result.state === "unavailable" ? [] : result.payload.items.map(toRow);
  const filtersActive = !!query.search || query.filter !== "all";
  const listQuery = {
    ...query,
    action: query.filter,
    status: "all",
    sort: "created_at",
    direction: "desc",
  } as never;

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-h1 text-admin-text">Activity</h1>
          <p className="mt-1.5 max-w-[70ch] text-body text-admin-text-2">
            Workspace events recorded by database triggers, across every
            tenant, newest first. This is a read of{" "}
            <span className="mono-meta text-admin-text-2">public.activities</span>
            ; it is not derived from sign-in or session data.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {result.state === "unavailable" ? (
            <span className="mono-meta text-admin-danger">Read failed</span>
          ) : (
            <AdminListSummary generatedAt={result.payload.generated_at} />
          )}
          <AdminRefreshButton />
        </div>
      </header>

      <AdminListToolbar pathname={PATH} query={listQuery} hasActiveFilters={filtersActive}>
        <AdminSelectFilter
          id="activity-action"
          name="action"
          label="Action"
          value={query.filter}
          options={ACTIONS}
        />
      </AdminListToolbar>

      {result.state === "unavailable" ? (
        <AdminPanel>
          <AdminErrorState error={result.error} />
          <div className="mt-3 flex justify-end">
            <AdminRefreshButton />
          </div>
        </AdminPanel>
      ) : result.state === "empty" ? (
        <AdminPanel>
          <AdminEmptyState
            icon="activity"
            title={filtersActive ? "No activity matches" : "No activity recorded"}
            description={
              filtersActive
                ? "The read succeeded and no public.activities row matched these filters. Widening them will show the rest of the stream."
                : "The read succeeded: nothing has been written to public.activities yet. A quiet platform looks exactly like this."
            }
          />
        </AdminPanel>
      ) : (
        <AdminPanel padded={false}>
          <AdminPanelHeader
            title="Recorded activity"
            description="Newest first. Entity and workspace are names as they were written at the time of the event."
            action={
              <span className="mono-meta text-admin-text-3">
                {rows.length} shown · {result.payload.total} total
              </span>
            }
          />

          <AdminTableShell
            className="hidden md:block"
            caption="Recorded workspace activity: action, entity, workspace and time"
            minWidthClass="min-w-[760px]"
          >
            <thead>
              <tr>
                <AdminTh>Action</AdminTh>
                <AdminTh>Entity</AdminTh>
                <AdminTh>Workspace</AdminTh>
                <AdminTh>Occurred</AdminTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <AdminStaticRow key={row.id}>
                  <AdminTd>
                    <span className="mono-token text-admin-text">{row.action}</span>
                  </AdminTd>
                  <AdminTd>
                    {row.entityType ? (
                      <>
                        <span className="mono-token text-admin-text-2">
                          {row.entityType}
                        </span>
                        {row.entityId ? (
                          <span
                            className="mt-0.5 block max-w-[200px] truncate mono-meta text-admin-text-3"
                            title={row.entityId}
                          >
                            {row.entityId}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-admin-text-3">{NOT_AVAILABLE}</span>
                    )}
                  </AdminTd>
                  <AdminTd>
                    <WorkspaceCell
                      workspaceId={row.workspaceId}
                      workspaceName={row.workspaceName}
                    />
                  </AdminTd>
                  <AdminTd>
                    <AdminTimeCell iso={row.occurredAt} />
                  </AdminTd>
                </AdminStaticRow>
              ))}
            </tbody>
          </AdminTableShell>

          {/* Below md: one column, same facts, same order. */}
          <AdminCardList>
            {rows.map((row) => (
              <AdminCardItem key={row.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate mono-token text-admin-text">
                    {row.action}
                  </p>
                  <AdminTimeCell iso={row.occurredAt} className="shrink-0" />
                </div>
                <p className="mt-1 truncate mono-meta text-admin-text-3">
                  {row.entityType ?? NOT_AVAILABLE}
                  {row.entityId ? ` · ${row.entityId}` : ""}
                </p>
                <p className="mt-1 min-w-0 truncate text-small text-admin-text-2">
                  <WorkspaceCell
                    workspaceId={row.workspaceId}
                    workspaceName={row.workspaceName}
                  />
                </p>
              </AdminCardItem>
            ))}
          </AdminCardList>

          <div className="border-t border-admin-border p-4">
            <AdminPagination
              pathname={PATH}
              query={listQuery}
              page={result.payload.page}
              total={result.payload.total}
              pageSize={result.payload.page_size}
              unitLabel="activity rows"
            />
          </div>
        </AdminPanel>
      )}

      {/* ------------------------------------------------- footnotes */}
      <p className="max-w-[92ch] text-caption text-admin-text-3">
        Events are written by database triggers on the product tables, so a
        row here means the write actually happened — not that a request was
        received. A missing workspace name means the workspace has since been
        deleted while its events remain, which is why the id is kept. Entity
        names are deliberately not resolved at read time: the table stores
        what it stored, and reading it does not reshape history.
      </p>
    </div>
  );
}

/** The workspace a row belongs to: a link when the id is still present,
 *  the raw truth when it is not. Shared by the table and the stacked list. */
function WorkspaceCell({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string | null;
  workspaceName: string | null;
}) {
  if (!workspaceId) {
    return (
      <span className="text-admin-text-3">
        {workspaceName ?? NOT_AVAILABLE}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/workspaces/${workspaceId}`}
      className="inline-flex max-w-full min-w-0 items-center truncate text-admin-text-2 no-underline transition-colors duration-[120ms] hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
      title={workspaceName ? `${workspaceName} — open inspector` : "Open workspace inspector"}
    >
      {workspaceName ?? workspaceId}
    </Link>
  );
}
