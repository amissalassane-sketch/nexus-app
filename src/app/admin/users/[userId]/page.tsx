import type { Metadata } from "next";
import Link from "next/link";
import { ActivityList } from "@/components/admin/activity-list";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { AdminCopyButton } from "@/components/admin/copy-button";
import {
  AdminAccountBadge,
  AdminMembershipRoleBadge,
  AdminMembershipStatusBadge,
  AdminPlatformRoleBadge,
} from "@/components/admin/badges";
import { AdminIdValue, AdminTimeCell, initialsFor } from "@/components/admin/directory";
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
import { getAdminUserDetail } from "@/lib/admin/directory";
import { formatCount, formatDateTime, NOT_AVAILABLE } from "@/lib/admin/format";
import type { AdminActivityEntry, AdminUserDetail } from "@/lib/admin/types";
import { parseDirectoryId, shortId } from "@/lib/admin/query";

// ============================================================
// NEXUS ADMIN — USER INSPECTOR (PR 2)
// ============================================================
// One account, fully contextualized: who they are (auth + profile), what
// platform authority they hold, which workspaces they belong to, what
// they have actually done, and what their footprint measures. Every value
// comes from admin_user_detail() over real rows — the payload is validated
// field-by-field before render.
//
// The actions policy for this PR, stated in the UI itself:
//   * Copy id / email — safe, local, offered.
//   * Impersonation — NOT implemented and NOT planned for this surface;
//     it would require a session-minting mechanism this codebase
//     deliberately does not have.
//   * Disable / delete — destructive. Not offered until a permission
//     model + confirmation + audit flow exists (the read path already
//     proves what such a write must record).
// ============================================================

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  // The id fragment, not the email: browser history and window titles are
  // low-security surfaces, and the record is already fully addressable by
  // id inside the authenticated shell.
  const id = parseDirectoryId((await params).userId);
  return {
    title: id ? `User ${shortId(id)}` : "User",
    robots: { index: false, follow: false },
  };
}

/** Support workflows start by pasting the full id somewhere else. */
function CopyIdPair({ userId, email }: { userId: string; email: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdminCopyButton text={userId} label="Copy user id" />
      {email ? <AdminCopyButton text={email} label="Copy email" /> : null}
    </div>
  );
}

function activityEntries(detail: AdminUserDetail): AdminActivityEntry[] {
  return detail.recent_activity.map((entry) => ({
    id: entry.activity_id,
    source: "activities",
    kind: entry.action ?? "activity",
    title: entry.entity_type ? capitalize(entry.entity_type) : "Workspace event",
    subject: entry.workspace_name,
    occurred_at: entry.occurred_at,
  }));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const raw = (await params).userId;
  const userId = parseDirectoryId(raw);

  // A malformed id never reaches the database: the id is either a valid
  // uuid or the account cannot exist. Same screen as a real miss, one
  // sentence of difference in the detail line.
  if (userId === null) {
    return (
      <AdminNotFoundState
        title="User not found"
        backHref="/admin/users"
        backLabel="Back to Users"
        detail={
          <>
            <span className="font-mono text-[12px] text-admin-text-2">
              {raw.slice(0, 64)}
            </span>{" "}
            is not a valid user id, so no lookup was attempted.
          </>
        }
      />
    );
  }

  const result = await getAdminUserDetail(userId);

  if (result.state === "unavailable") {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
        <AdminErrorState error={result.error} />
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/admin/users"
            className="text-[12.5px] text-admin-text-2 no-underline hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
          >
            ← Back to Users
          </Link>
          <AdminRefreshButton />
        </div>
      </div>
    );
  }

  if (result.state === "not_found") {
    return (
      <AdminNotFoundState
        title="User not found"
        backHref="/admin/users"
        backLabel="Back to Users"
        detail={
          <>
            This id does not exist in{" "}
            <span className="font-mono text-[12px] text-admin-text-2">auth.users</span>.
            The database answered normally — “no such account” is a measured
            fact here, not a read failure. The account may have been deleted;
            admin actions against it would still be visible in the audit log
            (PR 3).
            <span className="mt-2 block truncate font-mono text-[11.5px] text-admin-text-3">
              {userId}
            </span>
          </>
        }
      />
    );
  }

  const detail = result.detail;
  const { identity, account, platform_admin: platform, usage } = detail;
  const name = identity.display_name?.trim() || null;

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5">
      <AdminDetailHeader
        eyebrow="Business · User"
        backHref="/admin/users"
        backLabel="Back to Users"
        updatedNote={`Read ${formatDateTime(detail.generated_at)}`}
        title={
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-admin-border bg-admin-surface-2 font-mono text-[12px] font-semibold uppercase text-admin-text-2"
            >
              {initialsFor(name, identity.username)}
            </span>
            <span className="min-w-0 truncate">
              {name ??
                identity.email ??
                (identity.username ? `@${identity.username}` : null) ??
                shortId(identity.user_id)}
            </span>
          </span>
        }
        badges={
          <>
            <AdminAccountBadge status={account.account_status} />
            {platform.is_admin && platform.role ? (
              <AdminPlatformRoleBadge role={platform.role} />
            ) : null}
          </>
        }
        identity={
          <>
            {identity.email ? (
              <AdminIdValue value={identity.email} label="Email" />
            ) : null}
            <AdminIdValue value={identity.user_id} label="auth.users id" />
          </>
        }
        actions={<AdminRefreshButton />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* -------------------------------------------- identity */}
          <AdminPanel>
            <AdminSectionTitle
              title="Identity"
              description="auth.users plus the profiles row, if one exists."
            />
            <div className="mt-3 grid gap-x-8 md:grid-cols-2">
              <AdminFieldList>
                <AdminField label="Display name" mono={false} value={name ?? <Missing />} />
                <AdminField label="Username" value={identity.username ?? <Missing />} />
                <AdminField label="Email" value={identity.email ?? <Missing />} />
                <AdminField
                  label="Job title"
                  mono={false}
                  value={identity.job_title ?? <Missing />}
                />
              </AdminFieldList>
              <AdminFieldList>
                <AdminField label="User id" value={shortId(identity.user_id, 12)} />
                <AdminField
                  label="Created"
                  value={formatDateTime(identity.created_at)}
                />
                <AdminField
                  label="Profile row"
                  value={
                    account.has_profile ? (
                      formatDateTime(identity.profile_updated_at ?? null)
                    ) : (
                      <span className="text-admin-warning">missing</span>
                    )
                  }
                />
                <AdminField
                  label="Avatar"
                  value={
                    identity.avatar_url
                      ? // Deliberately not rendered: an admin screen must
                        // not fetch an operator-invisible remote URL chosen
                        // by the account holder.
                        <span title="Stored as a URL; the admin surface does not render external images.">
                          custom URL{" "}
                          <span className="text-admin-text-3">(not shown)</span>
                        </span>
                      : <Missing />
                  }
                />
              </AdminFieldList>
            </div>
            {identity.bio ? (
              <>
                <AdminDivider className="mt-3" />
                <div className="mt-3">
                  <AdminEyebrow>Bio (as written by the account)</AdminEyebrow>
                  <span className="mt-1 block max-w-[70ch] whitespace-pre-line text-[12.5px] leading-[18px] text-admin-text-2">
                    {identity.bio.slice(0, 500)}
                    {identity.bio.length > 500 ? "…" : ""}
                  </span>
                </div>
              </>
            ) : null}
          </AdminPanel>

          {/* --------------------------------------------- account */}
          <AdminPanel>
            <AdminSectionTitle
              title="Account"
              description="Only what GoTrue actually maintains for this user."
            />
            <div className="mt-3 grid gap-x-8 md:grid-cols-2">
              <AdminFieldList>
                <AdminField
                  label="Status"
                  value={<AdminAccountBadge status={account.account_status} />}
                  mono={false}
                />
                <AdminField
                  label="Email verified"
                  value={
                    account.email_confirmed
                      ? formatDateTime(account.email_confirmed_at)
                      : <span className="text-admin-warning">not verified</span>
                  }
                />
                <AdminField
                  label="Banned until"
                  value={account.banned_until ?? NOT_AVAILABLE}
                  hint={
                    account.banned_until
                      ? "set out-of-band via the auth admin API"
                      : undefined
                  }
                />
              </AdminFieldList>
              <AdminFieldList>
                <AdminField
                  label="Last sign-in"
                  value={
                    <AdminTimeCell iso={account.last_sign_in_at} relative={false} />
                  }
                />
                <AdminField
                  label="Last activity"
                  value={<AdminTimeCell iso={account.last_activity_at} relative={false} />}
                  hint="max(sign-in, activities)"
                />
                <AdminField
                  label="Onboarding"
                  value={account.onboarding_completed ? "completed" : "not completed"}
                  mono={false}
                />
              </AdminFieldList>
            </div>
          </AdminPanel>

          {/* ------------------------------------------ workspaces */}
          <AdminPanel>
            <AdminSectionTitle
              title="Workspaces"
              description="Memberships join this account to tenants; each row opens the workspace inspector."
            />
            {detail.workspaces.length === 0 ? (
              <AdminEmptyState
                compact
                icon="building"
                title="No workspace memberships"
                description="This account is not attached to any workspace — membership rows were read and none exist."
              />
            ) : (
              <ul className="mt-3 flex flex-col">
                {detail.workspaces.map((ws) => (
                  <li
                    key={ws.workspace_id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-admin-border/60 py-2.5 last:border-b-0"
                  >
                    <Link
                      href={`/admin/workspaces/${ws.workspace_id}`}
                      className="min-w-0 inline-flex items-center gap-2 text-[13px] font-medium text-admin-text no-underline hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
                    >
                      <span className="truncate">{ws.name}</span>
                      <span className="truncate font-mono text-[11px] text-admin-text-3">
                        {ws.slug}
                      </span>
                    </Link>
                    <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {ws.is_creator ? (
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.08em] text-admin-text-3"
                          title="Row exists in workspaces with owner_id set to this account"
                        >
                          created
                        </span>
                      ) : null}
                      <AdminMembershipRoleBadge role={ws.role} />
                      <AdminMembershipStatusBadge status={ws.membership_status} />
                      <AdminTimeCell iso={ws.joined_at} className="text-[11px]" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          {/* -------------------------------------------- activity */}
          <AdminPanel>
            <AdminSectionTitle
              title="Recent activity"
              description="Rows this account caused in the workspace activity stream (public.activities)."
              action={
                <span className="font-mono text-[11px] text-admin-text-3">
                  {formatCount(usage.activity_events)} recorded
                </span>
              }
            />
            <div className="mt-3">
              {detail.recent_activity.length === 0 ? (
                <AdminEmptyState
                  compact
                  icon="activity"
                  title="No recorded activity"
                  description="The read succeeded and returned nothing: this account has not triggered any task, project or goal mutation. The activity stream is written by database triggers, so it stays quiet for accounts that have changed nothing."
                />
              ) : (
                <ActivityList activity={{ state: "ok", entries: activityEntries(detail) }} />
              )}
            </div>
          </AdminPanel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* -------------------------------------- platform access */}
          <AdminPanel>
            <AdminSectionTitle title="Platform access" />
            {platform.is_admin ? (
              <AdminFieldList className="mt-3">
                <AdminField
                  label="Platform role"
                  value={
                    platform.role ? (
                      <AdminPlatformRoleBadge role={platform.role} />
                    ) : (
                      platform.role
                    )
                  }
                  mono={false}
                />
                <AdminField label="Admin row status" value={platform.status ?? NOT_AVAILABLE} />
                <AdminField
                  label="Admin since"
                  value={formatDateTime(platform.since)}
                />
                <AdminField label="Note" mono={false} value={platform.note ?? NOT_AVAILABLE} />
              </AdminFieldList>
            ) : (
              <p className="mt-3 text-[12.5px] leading-[18px] text-admin-text-2">
                Not a platform admin. Grants live in{" "}
                <span className="font-mono text-[11.5px] text-admin-text-3">
                  public.platform_admins
                </span>{" "}
                and are managed by SQL until PR 5 adds the settings surface.
              </p>
            )}
          </AdminPanel>

          {/* ------------------------------------------------ usage */}
          <AdminPanel>
            <AdminSectionTitle
              title="Usage"
              description="Counts of real rows attributed to this account."
            />
            <AdminFieldList className="mt-3">
              <AdminField
                label="Workspace memberships"
                value={`${formatCount(usage.memberships_active)} active`}
                hint={`${formatCount(usage.memberships_total)} total`}
              />
              <AdminField label="Workspaces owned" value={formatCount(usage.workspaces_owned)} />
              <AdminField label="Tasks created" value={formatCount(usage.tasks_created)} />
              <AdminField
                label="Tasks assigned"
                value={formatCount(usage.tasks_assigned)}
                hint={`${formatCount(usage.tasks_open)} open · ${formatCount(
                  usage.tasks_done
                )} done`}
              />
              <AdminField label="Projects owned" value={formatCount(usage.projects_owned)} />
              <AdminField label="Goals created" value={formatCount(usage.goals_created)} />
              <AdminField
                label="Unread notifications"
                value={formatCount(usage.notifications_unread)}
              />
            </AdminFieldList>
            <AdminDivider className="my-3" />
            <p className="text-[11.5px] leading-[16px] text-admin-text-3">
              No time-series usage history is stored, so there is no trend
              to chart. These are counts of what exists now.
            </p>
          </AdminPanel>

          {/* --------------------------------------------- actions */}
          <AdminPanel>
            <AdminSectionTitle
              title="Actions"
              description="Only safe, real operations are offered. Everything else says so."
            />
            <div className="mt-3">
              <CopyIdPair userId={identity.user_id} email={identity.email} />
            </div>
            <AdminDivider className="my-3" />
            <AdminEyebrow className="mb-2">Not available by design</AdminEyebrow>
            <ul className="flex flex-col gap-2">
              <AdminUnavailableAction
                label="Impersonate user"
                reason="Out of scope by policy: no session-minting mechanism exists in this architecture, and one would bypass every audit attribution."
              />
              <AdminUnavailableAction
                label="Delete / disable account"
                reason="Destructive. Will only ship with a permission model, an explicit confirmation step and an audit entry — the writes surface (PR 3)."
              />
              <AdminUnavailableAction
                label="Grant / revoke platform role"
                reason="Admin management belongs to /admin/settings (PR 5); until then membership in platform_admins changes only by direct SQL."
              />
            </ul>
          </AdminPanel>
        </div>
      </div>
    </div>
  );
}

function Missing() {
  return <span className="text-admin-text-3">not set</span>;
}
