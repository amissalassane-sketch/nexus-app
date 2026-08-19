"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Badge, Button, EmptyState, ErrorBox, SkeletonList } from "@/components/ui";
import {
  DEFAULT_PREFERENCES,
  formatDateWithPrefs,
  type Preferences,
} from "@/lib/preferences";

// ============================================================
// NEXUS — NOTIFICATION CENTER (P2: alive)
//  - Optimistic mark read / mark all read (instant dim + counter)
//  - Rollback + toast when the write fails
//  - Skeletons at real dimensions, staggered list
// ============================================================

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

async function loadNotificationsForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  workspaceId: string
): Promise<{ data: NotificationItem[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return {
    data: (data as NotificationItem[]) ?? null,
    error: error as { message: string } | null,
  };
}

export function NotificationCenter({
  userId,
  workspaceId,
  preferences = DEFAULT_PREFERENCES,
}: {
  userId: string;
  /** Resolved server-side by the (app) layout — never null in practice. */
  workspaceId: string | null;
  preferences?: Preferences;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!workspaceId) return;
      const { data, error: loadError } = await loadNotificationsForUser(
        supabase,
        userId,
        workspaceId
      );
      if (loadError) {
        setError(loadError.message);
        setNotifications([]);
        setLoading(false);
        return;
      }
      setNotifications(data ?? []);
      setError("");
      setLoading(false);
    };
    void load();
  }, [supabase, userId, workspaceId]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications]
  );

  // OPTIMISTIC mark-as-read — the row dims instantly.
  const markAsRead = async (notificationId: string) => {
    const target = notifications.find((notification) => notification.id === notificationId);
    if (!target || target.read_at) return;

    const snapshot = notifications;
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read_at: new Date().toISOString() }
          : notification
      )
    );

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (updateError) {
      setNotifications(snapshot); // rollback
      toast.error(`Not marked as read — ${updateError.message}`);
    }
  };

  // OPTIMISTIC mark-all-as-read.
  const markAllAsRead = async () => {
    if (!workspaceId || unreadCount === 0) return;

    const snapshot = notifications;
    const stamp = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        notification.read_at ? notification : { ...notification, read_at: stamp }
      )
    );
    setMarkingAll(true);

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: stamp })
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .is("read_at", null);

    setMarkingAll(false);

    if (updateError) {
      setNotifications(snapshot); // rollback
      toast.error(`Not updated — ${updateError.message}`);
      return;
    }

    toast.success("All notifications marked as read.");
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-h3 font-semibold text-text-primary">Notifications</h2>
          <p className="mt-1 text-small text-text-secondary">
            {unreadCount > 0
              ? `${unreadCount} unread — review them below.`
              : "You are all caught up."}
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => void markAllAsRead()}
          disabled={!workspaceId || unreadCount === 0 || markingAll}
        >
          <CheckCheck size={14} strokeWidth={1.75} />
          {markingAll ? "Updating…" : "Mark all as read"}
        </Button>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      {loading ? (
        <SkeletonList rows={3} />
      ) : !workspaceId ? (
        <EmptyState
          icon={<Bell size={16} strokeWidth={1.75} />}
          title="No active workspace"
          hint="Your workspace link is being verified — reload in a moment."
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell size={16} strokeWidth={1.75} />}
          title="No notifications yet"
          hint="NEXUS will alert you here when something needs arbitration — overdue tasks, blocked projects, goals at risk."
        />
      ) : (
        <div className="stagger-list space-y-2">
          {notifications.map((notification) => {
            const href = notification.entity_type
              ? (entityRoutes[notification.entity_type.toLowerCase()] ?? "/dashboard")
              : "/dashboard";
            const isUnread = !notification.read_at;

            return (
              <div
                key={notification.id}
                className={`group flex min-h-11 items-start gap-4 rounded-lg border px-4 py-3 transition-all duration-[160ms] ease-out ${
                  isUnread
                    ? "border-border-default bg-bg-surface-2"
                    : "border-border-subtle bg-bg-surface"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={isUnread ? "info" : "neutral"}>{notification.type}</Badge>
                    {isUnread ? <Badge tone="volt">Unread</Badge> : null}
                  </div>

                  <h3
                    className={`mt-2 text-body font-medium ${
                      isUnread ? "text-text-primary" : "text-text-secondary"
                    }`}
                  >
                    {notification.title}
                  </h3>
                  {notification.message ? (
                    <p className="mt-1 text-small text-text-secondary">{notification.message}</p>
                  ) : null}

                  <div className="mt-2 font-mono text-mono-small text-text-quaternary">
                    {formatDateWithPrefs(notification.created_at, preferences)} ·{" "}
                    {new Date(notification.created_at).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {notification.entity_id ? (
                    <Link
                      href={href}
                      className="rounded-md border border-border-default px-2.5 py-1.5 text-caption text-text-secondary transition-all duration-[120ms] hover:border-border-strong hover:text-text-primary active:scale-[0.98]"
                    >
                      Open
                    </Link>
                  ) : null}

                  {isUnread ? (
                    <button
                      type="button"
                      onClick={() => void markAsRead(notification.id)}
                      className="rounded-md px-2.5 py-1.5 text-caption text-text-tertiary transition-colors duration-[120ms] hover:text-text-primary"
                    >
                      Mark as read
                    </button>
                  ) : (
                    <span className="px-2.5 py-1.5 text-caption text-text-quaternary">Read</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
