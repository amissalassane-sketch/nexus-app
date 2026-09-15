import type { Metadata } from "next";
import Link from "next/link";
import { AdminCopyButton } from "@/components/admin/copy-button";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import {
  AdminAccountBadge,
  AdminMembershipRoleBadge,
  AdminMembershipStatusBadge,
  AdminPlanBadge,
  AdminPriorityBadge,
  AdminTaskStatusBadge,
} from "@/components/admin/badges";
import { AdminIdValue, AdminSubject, AdminTimeCell } from "@/components/admin/directory";
import {
  AdminDetailHeader,
  AdminNotFoundState,
  AdminUnavailableAction,
} from "@/components/admin/detail";
import {
  AdminDivider,
  AdminEyebrow,
  AdminField,
  AdminFieldList,
  AdminPanel,
  AdminSectionTitle,
} from "@/components/admin/panel";
import { AdminEmptyState, AdminErrorState } from "@/components/admin/states";
import { getAdminWorkspaceDetail } from "@/lib/admin/directory";
import { formatCount, formatDateTime, NOT_AVAILABLE } from "@/lib/admin/format";
import { parseDirectoryId, shortId } from "@/lib/admin/query";
import { AdminIcon } from "@/components/admin/admin-icons";

// ============================================================
// NEXUS ADMIN — WORKSPACE INSPECTOR (PR 2)
// ============================================================
// The tenant as the database knows it: ownership and health, members with
// their workspace roles, plan rows, and the real content behind the
// counters (projects, tasks by status, recorded activity). One RPC —
// admin_workspace_detail() — not one query per panel.
//
// Task counts are included because the relation is direct and reliable
// (tasks.workspace_id is a NOT NULL foreign key, enforced by 012). What
// is not included: any figure that would need history this schema does not
// keep (retention, growth, usage trend), and any billing number — no
// payment provider writes to this database.
// ============================================================

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): Promise<Metadata> {
  const id = parseDirectoryId((await params).workspaceId);
  return {
    title: id ? `Workspace ${shortId(id)}` : "Workspace",
    robots: { index: false, follow: false },
  };
}

/** Order the activity stream is rendered in, and the six task buckets the
 *  CHECK constraint on public.tasks defines. Keys outside this vocabulary
 *  can exist only if the constraint changed; they are rendered appended,
 *  never dropped. */
const TASK_STATUS_ORDER = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const;

export default async function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const raw = (await params).workspaceId;
  const workspaceId = parseDirectoryId(raw);

  if (workspaceId === null) {
    return (
      <AdminNotFoundState
        title="Workspace not found"
        backHref="/admin/workspaces"
        backLabel="Back to Workspaces"
        detail={
          <>
            <span className="font-mono text-[12px] text-admin-text-2">
              {raw.slice(0, 64)}
            </span>{" "}
            is not a valid workspace id, so no lookup was attempted.
          </>
        }
      />
    );
  }

  const result = await getAdminWorkspaceDetail(workspaceId);

  if (result.state === "unavailable") {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
        <AdminErrorState error={result.error} />
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/admin/workspaces"
            className="text-[12.5px] text-admin-text-2 no-underline hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
          >
            ← Back to Workspaces
          </Link>
          <AdminRefreshButton />
        </div>
      </div>
    );
  }

  if (result.state === "not_found") {
    return (
      <AdminNotFoundState
        title="Workspace not found"
        backHref="/admin/workspaces"
        backLabel="Back to Workspaces"
        detail={
          <>
            This id does not exist in{" "}
            <span className="font-mono text-[12px] text-admin-text-2">
              public.workspaces
            </span>
            . The database answered normally — “no such workspace” is a
            measured fact here, not a read failure.
            <span className="mt-2 block truncate font-mono text-[11.5px] text-admin-text-3">
              {workspaceId}
            </span>
          </>
        }
      />
    );
  }

  const detail = result.detail;
  const { overview, owner, health, usage } = detail;
  const activeSubscription = detail.subscription.find((row) => row.status === "active");
  const statusKeys = Object.keys(detail.tasks_by_status).sort(
    (a, b) => {
      const ia = (TASK_STATUS_ORDER as readonly string[]).indexOf(a);
      const ib = (TASK_STATUS_ORDER as readonly string[]).indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
  );

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5">
      <AdminDetailHeader
        eyebrow="Business · Workspace"
        backHref="/admin/workspaces"
        backLabel="Back to Workspaces"
        updatedNote={`Read ${formatDateTime(detail.generated_at)}`}
        title={
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-admin-border bg-admin-surface-2 text-admin-text-2"
            >
              <AdminIcon name="building" size="state" />
            </span>
            <span className="min-w-0 truncate">{overview.name}</span>
          </span>
        }
        badges={
          <>
            <AdminPlanBadge plan={activeSubscription?.plan ?? "FREE"} />
            {!activeSubscription ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-admin-text-3">
                default plan
              </span>
            ) : null}
            {health.has_active_owner ? null : (
              <span className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-admin-danger">
                <AdminIcon name="warning" size="action" />
                no active owner
              </span>
            )}
          </>
        }
        identity={
          <>
            <AdminIdValue value={`/${overview.slug}`} label="Slug" />
            <AdminIdValue value={overview.workspace_id} label="Workspace id" />
          </>
        }
        actions={<AdminRefreshButton />}
      />

      {/* health flag — only when it is actually measured and true */}
      {health.has_active_owner ? null : (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[10px] border border-admin-danger-border bg-admin-danger-bg px-4 py-3"
        >
          <AdminIcon name="warning" size="state" className="mt-0.5 shrink-0 text-admin-danger" />
          <p className="min-w-0 text-[12.5px] leading-[18px] text-admin-text-2">
            <span className="font-medium text-admin-text">Nobody can open this workspace.</span>{" "}
            No active membership holds the workspace&apos;s owner role — the
            same condition the Overview lists under “Needs attention”. This
            is usually a failed bootstrap (see migrations 016/018); the data
            itself is intact. Repair requires an operator action, which the
            write surface (PR 3) will expose with audit.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* -------------------------------------------- overview */}
          <AdminPanel>
            <AdminSectionTitle
              title="Overview"
              description="Rows from public.workspaces, verbatim."
            />
            <div className="mt-3 grid gap-x-8 md:grid-cols-2">
              <AdminFieldList>
                <AdminField label="Name" mono={false} value={overview.name} />
                <AdminField label="Slug" value={overview.slug} />
                <AdminField label="Workspace id" value={shortId(overview.workspace_id, 12)} />
                <AdminField
                  label="Owner"
                  mono={false}
                  value={
                    owner ? (
                      <Link
                        href={`/admin/users/${owner.user_id}`}
                        className="text-admin-text no-underline underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
                      >
                        {owner.display_name ?? owner.email ?? shortId(owner.user_id)}
                      </Link>
                    ) : (
                      <span className="text-admin-text-3">{NOT_AVAILABLE}</span>
                    )
                  }
                />
              </AdminFieldList>
              <AdminFieldList>
                <AdminField
                  label="Created"
                  value={formatDateTime(overview.created_at)}
                />
                <AdminField label="Last updated" value={formatDateTime(overview.updated_at)} />
                <AdminField
                  label="Last activity"
                  value={<AdminTimeCell iso={overview.last_activity_at} relative={false} />}
                />
                <AdminField
                  label="Members (active)"
                  value={formatCount(health.member_count_active)}
                />
              </AdminFieldList>
            </div>
            {overview.description ? (
              <>
                <AdminDivider className="mt-3" />
                <div className="mt-3">
                  <AdminEyebrow>Description</AdminEyebrow>
                  <span className="mt-1 block max-w-[70ch] whitespace-pre-line text-[12.5px] leading-[18px] text-admin-text-2">
                    {overview.description.slice(0, 500)}
                    {overview.description.length > 500 ? "…" : ""}
                  </span>
                </div>
              </>
            ) : null}
          </AdminPanel>

          {/* --------------------------------------------- members */}
          <AdminPanel>
            <AdminSectionTitle
              title="Members"
              description={`From workspace_members; role is the tenant's authority, not a platform role. ${
                detail.members.length >= 200 ? "First 200 shown." : ""
              }`}
              action={
                <span className="font-mono text-[11px] text-admin-text-3">
                  {formatCount(detail.members.length)} shown
                </span>
              }
            />
            {detail.members.length === 0 ? (
              <AdminEmptyState
                compact
                icon="users"
                title="No membership rows"
                description="The read succeeded: this workspace has zero rows in workspace_members. Not even the owner is attached."
              />
            ) : (
              <ul className="mt-2 flex flex-col">
                {detail.members.map((member) => (
                  <li
                    key={member.user_id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-admin-border/60 py-2.5 last:border-b-0"
                  >
                    <Link
                      href={`/admin/users/${member.user_id}`}
                      className="min-w-0 no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
                      title={`Open the inspector for ${member.email ?? member.user_id}`}
                    >
                      <AdminSubject
                        displayName={member.display_name}
                        username={member.username}
                        email={member.email}
                        id={member.user_id}
                      />
                    </Link>
                    <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {member.is_creator ? (
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.08em] text-admin-text-3"
                          title="workspaces.owner_id points at this account"
                        >
                          creator
                        </span>
                      ) : null}
                      <AdminMembershipRoleBadge role={member.role} />
                      <AdminMembershipStatusBadge status={member.membership_status} />
                      <AdminAccountBadge status={member.account_status} />
                      <AdminTimeCell iso={member.joined_at} className="text-[11px]" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          {/* -------------------------------------------- projects */}
          <AdminPanel>
            <AdminSectionTitle
              title="Projects"
              description="Most recently updated, with real task counts per project."
              action={
                <span className="font-mono text-[11px] text-admin-text-3">
                  {formatCount(usage.projects)} total
                </span>
              }
            />
            {detail.recent_projects.length === 0 ? (
              <AdminEmptyState
                compact
                icon="database"
                title="No projects"
                description="This workspace has no rows in public.projects."
              />
            ) : (
              <ul className="mt-2 flex flex-col">
                {detail.recent_projects.map((project) => (
                  <li
                    key={project.project_id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-admin-border/60 py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium leading-[18px] text-admin-text">
                        {project.name}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] leading-[15px] text-admin-text-3">
                        {project.tasks_done}/{project.tasks_total} tasks done
                        {project.due_date ? ` · due ${project.due_date}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-admin-text-3">
                        {Math.round(project.progress)}%
                      </span>
                      <span className="inline-flex h-[21px] items-center rounded-[6px] border border-admin-border bg-admin-surface-2 px-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-admin-text-2">
                        {project.status.replace(/_/g, " ")}
                      </span>
                      <AdminTimeCell iso={project.updated_at} className="text-[11px]" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          {/* ---------------------------------------------- tasks */}
          <AdminPanel>
            <AdminSectionTitle
              title="Tasks"
              description="Status breakdown measured across the workspace, then the ten most recently touched rows."
            />
            {usage.tasks === 0 ? (
              <AdminEmptyState
                compact
                icon="database"
                title="No tasks"
                description="This workspace has no rows in public.tasks."
              />
            ) : (
              <>
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tasks by status">
                  {statusKeys.map((status) => (
                    <li key={status}>
                      <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-admin-border bg-admin-surface-2 px-2 py-1">
                        <AdminTaskStatusBadge status={status} />
                        <span className="font-mono text-[11px] tabular-nums text-admin-text-2">
                          {formatCount(detail.tasks_by_status[status] ?? 0)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <ul className="mt-3 flex flex-col">
                  {detail.recent_tasks.map((task) => (
                    <li
                      key={task.task_id}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-admin-border/60 py-2 last:border-b-0"
                    >
                      <span className="min-w-0 truncate text-[12.5px] leading-[18px] text-admin-text">
                        {task.title}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <AdminTaskStatusBadge status={task.status} />
                        <AdminPriorityBadge priority={task.priority} />
                        <AdminTimeCell iso={task.updated_at} className="text-[11px]" />
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </AdminPanel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* --------------------------------------- plan / billing */}
          <AdminPanel>
            <AdminSectionTitle
              title="Subscription"
              description="Rows in workspace_subscriptions. No payment provider writes to this table yet."
            />
            {detail.subscription.length === 0 ? (
              <p className="mt-3 text-[12.5px] leading-[18px] text-admin-text-2">
                No subscription row. The application treats this workspace as{" "}
                <AdminPlanBadge plan="FREE" /> — the default of{" "}
                <span className="font-mono text-[11.5px] text-admin-text-3">
                  get_workspace_plan()
                </span>
                , not a measured plan.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {detail.subscription.map((row) => (
                  <li
                    key={row.subscription_id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-admin-border/60 py-2 last:border-b-0"
                  >
                    <span className="flex items-center gap-2">
                      <AdminPlanBadge plan={row.plan} />
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-admin-text-3">
                        {row.status}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-admin-text-3">
                      updated <AdminTimeCell iso={row.updated_at} className="text-[11px]" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <AdminDivider className="my-3" />
            <p className="text-[11.5px] leading-[16px] text-admin-text-3">
              No invoices, no amounts, no renewal dates: the billing columns
              exist but nothing writes provider data into them, so there is
              nothing to display honestly. Billing administration is out of
              scope for this PR.
            </p>
          </AdminPanel>

          {/* ------------------------------------------------ usage */}
          <AdminPanel>
            <AdminSectionTitle
              title="Usage"
              description="Counts of rows that exist right now — the schema keeps no history to trend."
            />
            <AdminFieldList className="mt-3">
              <AdminField label="Projects" value={formatCount(usage.projects)} />
              <AdminField label="Tasks" value={formatCount(usage.tasks)} />
              <AdminField label="Goals" value={formatCount(usage.goals)} />
              <AdminField
                label="Workspace events"
                value={formatCount(usage.events)}
                hint="public.activities"
              />
              <AdminField label="Notifications" value={formatCount(usage.notifications)} />
              <AdminField label="Intelligence signals" value={formatCount(usage.signals)} />
              <AdminField label="Intelligence missions" value={formatCount(usage.missions)} />
            </AdminFieldList>
          </AdminPanel>

          {/* -------------------------------------------- activity */}
          <AdminPanel>
            <AdminSectionTitle
              title="Activity"
              description="Newest rows this workspace's triggers recorded."
            />
            {detail.recent_activity.length === 0 ? (
              <AdminEmptyState
                compact
                icon="activity"
                title="No recorded activity"
                description="The read succeeded and returned nothing. The 015 triggers write one row per task, project or goal mutation — a workspace whose data never changed has an honest zero here."
              />
            ) : (
              <ul className="mt-2 flex flex-col">
                {detail.recent_activity.map((entry) => (
                  <li
                    key={entry.activity_id}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-admin-border/60 py-2 last:border-b-0"
                  >
                    <span className="min-w-0 text-[12.5px] leading-[18px] text-admin-text-2">
                      <span className="text-admin-text">
                        {(entry.entity_type ?? "item").replace(/_/g, " ")}
                      </span>{" "}
                      {entry.action ?? "?"}
                      {entry.actor_email ? (
                        <span className="font-mono text-[11px] text-admin-text-3">
                          {" "}
                          · {entry.actor_email}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-admin-text-3">
                          {" "}· no actor row
                        </span>
                      )}
                    </span>
                    <AdminTimeCell iso={entry.occurred_at} />
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          {/* --------------------------------------------- actions */}
          <AdminPanel>
            <AdminSectionTitle
              title="Actions"
              description="Only safe, real operations are offered. Everything else says so."
            />
            <div className="mt-3">
              <AdminCopyButton text={overview.workspace_id} label="Copy workspace id" />
            </div>
            <AdminDivider className="my-3" />
            <AdminEyebrow className="mb-2">Not available by design</AdminEyebrow>
            <ul className="flex flex-col gap-2">
              <AdminUnavailableAction
                label="Open workspace as member"
                reason="Impersonation is explicitly out of scope: this architecture has no session-minting mechanism, and one would bypass audit attribution."
              />
              <AdminUnavailableAction
                label="Suspend / archive workspace"
                reason="The workspaces table has no archive state; a write surface with confirmation and audit lands in PR 3."
              />
              <AdminUnavailableAction
                label="Change plan"
                reason="Billing mutations belong to the Billing block (later PR) — and no payment provider is connected to honor a change today."
              />
            </ul>
          </AdminPanel>
        </div>
      </div>
    </div>
  );
}
