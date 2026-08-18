"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
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

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export function NotificationCenter({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

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
      const { data, error: workspaceError } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (workspaceError) {
        setError(workspaceError.message);
        setLoading(false);
        return;
      }

      const nextWorkspaceId = data?.[0]?.workspace_id ?? null;
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

    if (updateError) {
      setError(updateError.message);
      setMarkingAll(false);
      return;
    }

    setMarkingAll(false);
    await loadNotifications(workspaceId);
  };

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-4">
      <PageHeader
        title="Notifications"
        count={notifications.length}
        description="Workspace alerts and updates."
        actions={
          <Button
            variant="secondary"
            onClick={markAllAsRead}
            disabled={!workspaceId || unreadCount === 0 || markingAll}
          >
            {markingAll ? "Updating..." : "Mark all as read"}
          </Button>
        }
        meta={
          unreadCount > 0 ? (
            <p className="mt-1 font-mono text-mono tabular-nums text-lavender">
              {unreadCount} unread
            </p>
          ) : null
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {loading ? (
        <div className="space-y-1.5">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : !workspaceId ? (
        <EmptyState
          title="No active workspace"
          description="This account is not linked to an active workspace yet."
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="Aucune notification."
          description="C'est calme ici."
          icon={<Bell size={18} strokeWidth={1.75} />}
        />
      ) : (
        <ul className="flex flex-col">
          {notifications.map((notification) => {
            const href = notification.entity_type
              ? (entityRoutes[notification.entity_type.toLowerCase()] ?? "/dashboard")
              : "/dashboard";
            const isUnread = !notification.read_at;

            return (
              <li
                key={notification.id}
                className="group flex min-h-14 items-center gap-3 rounded-row px-3 py-2 transition-colors duration-150 ease-nexus hover:bg-bg-surface"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-pill",
                    isUnread ? "bg-lavender" : "bg-transparent"
                  )}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "truncate text-body",
                        isUnread ? "text-text-primary" : "text-text-secondary"
                      )}
                    >
                      {notification.title}
                    </p>
                    <span className="shrink-0 font-mono text-mono uppercase tracking-[0.04em] text-text-quaternary">
                      {notification.type}
                    </span>
                  </div>
                  {notification.message ? (
                    <p className="truncate text-caption text-text-tertiary">
                      {notification.message}
                    </p>
                  ) : null}
                </div>

                <span className="hidden shrink-0 font-mono text-mono tabular-nums text-text-tertiary sm:block">
                  {formatDate(notification.created_at)}
                </span>

                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 ease-nexus focus-within:opacity-100 group-hover:opacity-100">
                  {notification.entity_id ? (
                    <Link
                      href={href}
                      className="rounded-pill px-2.5 py-1 text-caption text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
                    >
                      Open
                    </Link>
                  ) : null}
                  {isUnread ? (
                    <button
                      type="button"
                      onClick={() => void markAsRead(notification.id)}
                      className="rounded-pill px-2.5 py-1 text-caption text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
