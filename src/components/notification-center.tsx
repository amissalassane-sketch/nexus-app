"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconBell,
  IconCircleCheck,
  IconInfoCircle,
  IconLayoutKanban,
  IconTarget,
  type TablerIcon,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { cn } from "@/lib/cn";
import { humanizeDataError } from "@/lib/data-errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { PillTabs } from "@/components/ui/tabs";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

type NotificationItem = {
  id: string;
  workspace_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
  severity?: string | null;
  action?: string | null;
};

const entityRoutes: Record<string, string> = {
  task: "/tasks",
  project: "/projects",
  goal: "/goals",
  workspace: "/dashboard",
};

function iconFor(notification: NotificationItem): TablerIcon {
  const key = `${notification.entity_type ?? ""}${notification.type ?? ""}`.toLowerCase();
  if (key.includes("project")) return IconLayoutKanban;
  if (key.includes("goal")) return IconTarget;
  if (key.includes("task") || key.includes("done") || key.includes("complete"))
    return IconCircleCheck;
  if (key.includes("warn") || key.includes("limit") || key.includes("overdue"))
    return IconAlertTriangle;
  if (key.includes("info")) return IconInfoCircle;
  return IconBell;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function relativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

function absoluteTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function NotificationCenter({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const loadNotifications = async (activeWorkspaceId: string | null) => {
    if (!activeWorkspaceId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("workspace_id", activeWorkspaceId)
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(humanizeDataError(loadError));
      setNotifications([]);
      setLoading(false);
      return;
    }

    setNotifications((data as NotificationItem[]) ?? []);
    setError("");
    setLoading(false);
  };

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const { membership, error: membershipError } = await getActiveMembership(
          supabase,
          userId
        );

        if (membershipError) {
          setError(membershipError);
          setLoading(false);
          return;
        }

        const nextWorkspaceId = membership?.workspaceId ?? null;
        setWorkspaceId(nextWorkspaceId);
        await loadNotifications(nextWorkspaceId);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `Could not load notifications: ${cause.message}`
            : "Could not load notifications."
        );
        setLoading(false);
      }
    };

    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications]
  );

  const visible = useMemo(
    () => (tab === "unread" ? notifications.filter((n) => !n.read_at) : notifications),
    [notifications, tab]
  );

  const markAsRead = async (notificationId: string) => {
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (updateError) {
      setError(humanizeDataError(updateError));
      return;
    }

    await loadNotifications(workspaceId);
    router.refresh();
  };

  const markAllAsRead = async () => {
    if (!workspaceId || unreadCount === 0) return;

    setMarkingAll(true);
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .is("read_at", null);

    setMarkingAll(false);

    if (updateError) {
      setError(humanizeDataError(updateError));
      return;
    }

    await loadNotifications(workspaceId);
    router.refresh();
  };

  return (
    <div className="page-enter mx-auto w-full max-w-[760px] space-y-5">
      <PageHeader
        title="Notifications"
        count={notifications.length}
        description="What changed in this workspace, and what NEXUS wants you to see."
        actions={
          <Button
            variant="secondary"
            onClick={markAllAsRead}
            loading={markingAll}
            disabled={!workspaceId || unreadCount === 0}
          >
            Mark all as read
          </Button>
        }
      />

      <PillTabs
        label="Filter notifications"
        value={tab}
        onChange={setTab}
        items={[
          {
            id: "all",
            label: `All${notifications.length ? ` · ${notifications.length}` : ""}`,
          },
          {
            id: "unread",
            label: `Unread${unreadCount ? ` · ${unreadCount}` : ""}`,
          },
        ]}
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Panel bodyClassName="p-0">
        {loading ? (
          <div className="flex flex-col" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="flex items-start gap-3 border-b border-border-subtle px-4 py-3.5 last:border-b-0"
              >
                <Skeleton className="h-8 w-8 rounded-input" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-2.5 w-1/2 rounded-pill" />
                  <Skeleton className="h-2.5 w-3/4 rounded-pill" />
                </div>
              </div>
            ))}
          </div>
        ) : !workspaceId ? (
          <div className="p-4">
            <EmptyState
              title="Workspace connecting"
              description="Your personal workspace is being prepared. Notifications will appear here once connected."
              icon={<NexusIcon icon={IconBell} size="state" />}
              action={
                <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                  Retry connection
                </Button>
              }
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={tab === "unread" ? "No unread notifications" : "No notifications yet"}
              description={
                tab === "unread"
                  ? "You are all caught up on updates and signals in this workspace."
                  : "When work changes or NEXUS detects risks and recommendations, you will be notified here."
              }
              icon={<NexusIcon icon={IconBell} size="state" />}
              action={
                tab === "unread" ? (
                  <button
                    type="button"
                    onClick={() => setTab("all")}
                    className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                  >
                    Show all
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <ul>
            {visible.map((notification) => {
              const href = notification.entity_type
                ? (entityRoutes[notification.entity_type.toLowerCase()] ?? "/dashboard")
                : "/dashboard";
              const isUnread = !notification.read_at;
              const Icon = iconFor(notification);

              return (
                <li
                  key={notification.id}
                  className={cn(
                    "group relative flex min-h-14 items-start gap-3 border-b border-border-subtle px-4 py-3.5 transition-colors duration-150 ease-nexus last:border-b-0 hover:bg-white/[0.02]",
                    isUnread && "bg-white/[0.015]"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-input border",
                      isUnread
                        ? "border-lavender-border bg-lavender-subtle text-lavender"
                        : "border-border-subtle bg-bg-surface text-text-tertiary"
                    )}
                  >
                    <NexusIcon icon={Icon} />
                  </span>

                  {isUnread ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-pill bg-lavender"
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 truncate text-body",
                          isUnread ? "text-text-primary" : "text-text-secondary"
                        )}
                      >
                        {notification.title}
                      </p>
                      <time
                        dateTime={notification.created_at}
                        title={absoluteTime(notification.created_at)}
                        className="shrink-0 font-mono text-mono tabular-nums text-text-quaternary"
                      >
                        {relativeTime(notification.created_at)}
                      </time>
                    </div>

                    {notification.message ? (
                      <p className="mt-0.5 text-caption text-text-tertiary">
                        {notification.message}
                      </p>
                    ) : null}

                    <div className="mt-1.5 flex items-center gap-2">
                      {notification.severity ? (
                        <Badge
                          tone={
                            notification.severity === "critical"
                              ? "danger"
                              : notification.severity === "warning"
                                ? "warning"
                                : "info"
                          }
                        >
                          {notification.severity}
                        </Badge>
                      ) : (
                        <span className="eyebrow text-text-quaternary">
                          {notification.type}
                        </span>
                      )}
                      <Link
                        href={href}
                        onClick={() => {
                          if (isUnread) void markAsRead(notification.id);
                        }}
                        className="text-caption text-text-secondary underline decoration-border-strong underline-offset-4 transition-colors hover:text-text-primary"
                      >
                        {notification.action ?? "Open"}
                      </Link>
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={() => void markAsRead(notification.id)}
                          className="-ml-1 inline-flex min-h-[40px] items-center rounded-input px-1 text-caption text-text-secondary opacity-100 transition-opacity duration-150 hover:text-text-primary active:bg-accent-ghost focus-visible:opacity-100 sm:min-h-0 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          Mark as read
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
