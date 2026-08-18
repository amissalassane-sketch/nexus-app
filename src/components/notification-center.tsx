"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    if (!workspaceId || unreadCount === 0) {
      return;
    }

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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="mt-1 text-sm text-zinc-500">Your workspace updates and reminders.</p>
        </div>

        <button
          type="button"
          onClick={markAllAsRead}
          disabled={!workspaceId || unreadCount === 0 || markingAll}
          className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {markingAll ? "Updating..." : "Mark all as read"}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-500">
          Loading notifications...
        </div>
      ) : !workspaceId ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-500">
          No active workspace is linked to this account yet.
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-500">
          No notifications yet.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const href = notification.entity_type ? entityRoutes[notification.entity_type.toLowerCase()] ?? "/dashboard" : "/dashboard";
            const isUnread = !notification.read_at;

            return (
              <div
                key={notification.id}
                className={`rounded-3xl border p-4 ${isUnread ? "border-white/20 bg-white/[0.04]" : "border-white/10 bg-black/10"}`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-zinc-400">
                        {notification.type}
                      </span>
                      {isUnread ? (
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-zinc-200">
                          Unread
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-white">{notification.title}</h3>
                    {notification.message ? <p className="mt-1 text-sm text-zinc-400">{notification.message}</p> : null}

                    <div className="mt-2 text-xs text-zinc-500">
                      {new Date(notification.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:flex-col md:items-end">
                    {notification.entity_id ? (
                      <Link
                        href={href}
                        className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                      >
                        Open
                      </Link>
                    ) : null}

                    {!notification.read_at ? (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification.id)}
                        className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                      >
                        Mark as read
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500">Read</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
