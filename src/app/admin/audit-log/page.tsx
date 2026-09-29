import type { Metadata } from "next";
import { getAdminAuditLog, parseAdminListQuery } from "@/lib/admin/activity-security";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { AdminAuditOutcomeBadge } from "@/components/admin/badges";
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
// NEXUS ADMIN — AUDIT LOG (PR 3)
// ============================================================
// The record of who did what, to what, and whether it worked. It is the
// one screen where the reading order is fixed by the questions an
// operator actually asks, in this order:
//
//   WHO     actor_email (+ actor_role when the row carries one)
//   WHAT    action, in the monospace technical layer
//   WHERE   target_type / target_id
//   RESULT  outcome — Success is quiet, Denied is the one that warrants
//           a second look, Failed is a real failure
//   WHEN    createdAt, relative with the absolute UTC time in the title
//
// Rows are not navigable: nothing here is a destination, and a stretched
// link would promise one. The table is a record, so it scrolls at the
// width where columns still exist and becomes a one-column item list
// below md — the same five facts in the same order, never a shrunken
// table.
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit Log",
  robots: { index: false, follow: false },
};

const PATH = "/admin/audit-log";

const OUTCOMES = [
  { value: "all", label: "All outcomes" },
  { value: "success", label: "Success" },
  { value: "denied", label: "Denied" },
  { value: "failed", label: "Failed" },
];

type AuditRow = {
  id: string;
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  outcome: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** The one place a raw RPC row becomes a view model, so the table and the
 *  stacked list can never disagree about what a row says. */
function toRow(item: Record<string, unknown>): AuditRow {
  return {
    id: String(item.id ?? ""),
    action: text(item.action) ?? "Unspecified action",
    actorEmail: text(item.actor_email),
    actorRole: text(item.actor_role),
    outcome: text(item.outcome) ?? "unknown",
    targetType: text(item.target_type),
    targetId: text(item.target_id),
    createdAt: text(item.created_at),
  };
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseAdminListQuery(await searchParams, "outcome");
  const result = await getAdminAuditLog(query);
  const rows = result.state === "unavailable" ? [] : result.payload.items.map(toRow);
  const filtersActive = !!query.search || query.filter !== "all";
  const listQuery = {
    ...query,
    outcome: query.filter,
    status: "all",
    sort: "created_at",
    direction: "desc",
  } as never;

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-h1 text-admin-text">Audit Log</h1>
          <p className="mt-1.5 max-w-[70ch] text-body text-admin-text-2">
            Every privileged action and access decision, newest first, read
            from{" "}
            <span className="mono-meta text-admin-text-2">
              public.admin_audit_log
            </span>
            . The table is append-only: no administrator, including an owner,
            can edit or delete a row through this application.
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
          id="audit-outcome"
          name="outcome"
          label="Outcome"
          value={query.filter}
          options={OUTCOMES}
        />
      </AdminListToolbar>

      {result.state === "unavailable" ? (
        <AdminPanel>
          <AdminErrorState error={result.error} />
        </AdminPanel>
      ) : result.state === "empty" ? (
        <AdminPanel>
          <AdminEmptyState
            icon="history"
            title={filtersActive ? "No audit events match" : "No audit events yet"}
            description={
              filtersActive
                ? "The read succeeded and returned no events for these filters. Clearing them will show the whole trail."
                : "The read succeeded: this database has no rows in public.admin_audit_log. That is the expected state before the first privileged action is attempted."
            }
          />
        </AdminPanel>
      ) : (
        <AdminPanel padded={false}>
          <AdminPanelHeader
            title="Audit events"
            description="Immutable rows, newest first. Sorting is fixed to createdAt desc."
            action={
              <span className="mono-meta text-admin-text-3">
                {rows.length} shown · {result.payload.total} total
              </span>
            }
          />

          <AdminTableShell
            className="hidden md:block"
            caption="Platform audit events: action, actor, outcome, target and creation time"
            minWidthClass="min-w-[880px]"
          >
            <thead>
              <tr>
                <AdminTh>Action</AdminTh>
                <AdminTh>Actor</AdminTh>
                <AdminTh>Outcome</AdminTh>
                <AdminTh>Target</AdminTh>
                <AdminTh>Created</AdminTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <AdminStaticRow key={row.id}>
                  <AdminTd className="text-admin-text">
                    <span className="mono-token text-admin-text">{row.action}</span>
                  </AdminTd>
                  <AdminTd>
                    <span className="block max-w-[240px] truncate text-admin-text-2">
                      {row.actorEmail ?? "Deleted account"}
                    </span>
                    {row.actorRole ? (
                      <span className="mt-0.5 block mono-token text-admin-text-3">
                        platform · {row.actorRole}
                      </span>
                    ) : null}
                  </AdminTd>
                  <AdminTd>
                    <AdminAuditOutcomeBadge outcome={row.outcome} />
                  </AdminTd>
                  <AdminTd>
                    {row.targetType ? (
                      <>
                        <span className="mono-token text-admin-text-2">
                          {row.targetType}
                        </span>
                        {row.targetId ? (
                          <span
                            className="mt-0.5 block max-w-[220px] truncate mono-meta text-admin-text-3"
                            title={row.targetId}
                          >
                            {row.targetId}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-admin-text-3">{NOT_AVAILABLE}</span>
                    )}
                  </AdminTd>
                  <AdminTd>
                    <AdminTimeCell iso={row.createdAt} />
                  </AdminTd>
                </AdminStaticRow>
              ))}
            </tbody>
          </AdminTableShell>

          {/* Below md: the same five facts, stacked. */}
          <AdminCardList>
            {rows.map((row) => (
              <AdminCardItem key={row.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate mono-token text-admin-text">
                    {row.action}
                  </p>
                  <AdminAuditOutcomeBadge outcome={row.outcome} />
                </div>
                <p className="mt-1 truncate text-small text-admin-text-2">
                  {row.actorEmail ?? "Deleted account"}
                  {row.actorRole ? (
                    <span className="ml-1.5 mono-token text-admin-text-3">
                      platform · {row.actorRole}
                    </span>
                  ) : null}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 truncate mono-meta text-admin-text-3">
                    {row.targetType ?? NOT_AVAILABLE}
                    {row.targetId ? ` · ${row.targetId}` : ""}
                  </span>
                  <AdminTimeCell iso={row.createdAt} className="shrink-0" />
                </div>
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
              unitLabel="audit events"
            />
          </div>
        </AdminPanel>
      )}

      {/* ------------------------------------------------- footnotes */}
      <p className="max-w-[92ch] text-caption text-admin-text-3">
        Reading the result column:{" "}
        <span className="mono-token text-admin-text-2">success</span> — the
        action ran; <span className="mono-token text-admin-text-2">denied</span>{" "}
        — the database refused it (this is the useful signal: an operator or a
        credential tried to do something it may not do);{" "}
        <span className="mono-token text-admin-text-2">failed</span> — it was
        permitted but did not complete. A row with no actor email belongs to an
        account that has since been deleted; the id and the event remain.
      </p>
    </div>
  );
}
