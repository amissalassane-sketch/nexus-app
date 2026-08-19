"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  FolderKanban,
  Info,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
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
};

const entityRoutes: Record<string, string> = {
  task: "/tasks",
  project: "/projects",
  goal: "/goals",
  workspace: "/dashboard",
};

function iconFor(notification: NotificationItem) {
  const key = `${notification.entity_type ?? ""}${notification.type ?? ""}`.toLowerCase();
  if (key.includes("project")) return FolderKanban;
  if (key.includes("goal")) return Target;
  if (key.includes("task") || key.includes("done") || key.includes("complete"))
    return CheckCircle2;
  if (key.includes("warn") || key.includes("limit") || key.includes("overdue"))
    return AlertTriangle;
  if (key.includes("info")) return Info;
  return Bell;
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
      setError(loadError.message);
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
      setError(updateError.message);
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
      setError(updateError.message);
      return;
    }

    await loadNotifications(workspaceId);
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-5">
      <PageHeader
        title="Inbox"
        count={notifications.length}
        description="Everything that happened in your workspace."
        actions={
          <Button
            variant="secondary"
            onClick={markAllAsRead}
            disabled={!workspaceId || unreadCount === 0 || markingAll}
          >
            {markingAll ? "Updating..." : "Mark all as read"}
          </Button>
        }
      />

      <PillTabs
        label="Notification filter"
        value={tab}
        onChange={setTab}
        items={[
          { id: "all", label: `All${notifications.length ? ` · ${notifications.length}` : ""}` },
          { id: "unread", label: `Unread${unreadCount ? ` · ${unreadCount}` : ""}` },
        ]}
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Panel bodyClassName="p-0">
        {loading ? (
          <div className="space-y-1.5 p-4">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : !workspaceId ? (
          <div className="p-4">
            <EmptyState
              title="No active workspace"
              description="This account is not linked to an active workspace yet."
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={tab === "unread" ? "No unread notifications" : "Aucune notification."}
              description={
                tab === "unread" ? "You are all caught up." : "C'est calme ici."
              }
              icon={<Bell size={18} strokeWidth={1.75} />}
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
                    "group flex min-h-14 items-start gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 transition-colors duration-150 ease-nexus hover:bg-bg-surface/60",
                    isUnread && "bg-bg-surface/30"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-nav border",
                      isUnread
                        ? "border-lavender-border bg-lavender-subtle text-lavender"
                        : "border-border-subtle bg-bg-surface text-text-tertiary"
                    )}
                  >
                    <Icon size={15} strokeWidth={1.75} />
                  </span>

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
                      <span className="font-mono text-mono uppercase tracking-[0.06em] text-text-quaternary">
                        {notification.type}
                      </span>
                      {notification.entity_id ? (
                        <Link
                          href={href}
                          onClick={() => {
                            if (isUnread) void markAsRead(notification.id);
                          }}
                          className="text-caption text-text-secondary underline decoration-border-strong underline-offset-4 transition-colors hover:text-text-primary"
                        >
                          Open
                        </Link>
                      ) : null}
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={() => void markAsRead(notification.id)}
                          className="text-caption text-text-secondary opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100 hover:text-text-primary"
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
