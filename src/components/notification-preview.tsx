"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
import { humanizeDataError } from "@/lib/data-errors";
import { cn } from "@/lib/cn";
import { Dropdown } from "@/components/ui/dropdown";
import { Skeleton } from "@/components/ui/feedback";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

export type NotificationPreviewItem = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  read_at: string | null;
  created_at: string;
  severity?: string | null;
};

const iconFor = (notification: NotificationPreviewItem): TablerIcon => {
  const key = `${notification.entity_type ?? ""}${notification.type}`.toLowerCase();
  if (key.includes("project")) return IconLayoutKanban;
  if (key.includes("goal")) return IconTarget;
  if (key.includes("task") || key.includes("complete")) return IconCircleCheck;
  if (key.includes("warn") || key.includes("overdue") || notification.severity === "critical") return IconAlertTriangle;
  if (key.includes("info")) return IconInfoCircle;
  return IconBell;
};

const routeFor = (entityType: string | null) => {
  if (entityType === "task") return "/tasks";
  if (entityType === "project") return "/projects";
  if (entityType === "goal") return "/goals";
  if (entityType === "workspace") return "/dashboard";
  return "/notifications";
};

const relativeTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of [["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000]] as const) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return "just now";
};

export function NotificationPreview({
  userId,
  workspaceId,
  unreadCount,
  className,
}: {
  userId: string;
  workspaceId: string | null;
  unreadCount: number;
  className?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<NotificationPreviewItem[]>([]);
  const previewUnreadCount = items.length > 0
    ? items.filter((item) => !item.read_at).length
    : unreadCount;

  useEffect(() => {
    if (!open || !workspaceId) return;
    let active = true;
    // Opening the preview starts a remote synchronization; the state update
    // intentionally reflects that external request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    void supabase
      .from("notifications")
      .select("id, type, title, message, entity_type, read_at, created_at, severity")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setError(humanizeDataError(loadError));
        } else {
          setItems((data as NotificationPreviewItem[]) ?? []);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, supabase, userId, workspaceId]);

  const markAsRead = async (id: string) => {
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId ?? "");
    if (updateError) setError(humanizeDataError(updateError));
    else setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: readAt } : item));
  };

  const markAllAsRead = async () => {
    if (!workspaceId || previewUnreadCount === 0) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .is("read_at", null);
    if (updateError) setError(humanizeDataError(updateError));
    else setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
  };

  return (
    <Dropdown
      label="Notification center"
      align="end"
      width={360}
      open={open}
      onOpenChange={setOpen}
      trigger={({ toggle, ref, ariaProps }) => (
        <button
          type="button"
          ref={ref}
          onClick={toggle}
          aria-label={previewUnreadCount > 0 ? `Notifications, ${previewUnreadCount} unread` : "Notifications"}
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-nav text-text-tertiary outline-none transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:scale-[0.9] focus-visible:ring-1 focus-visible:ring-lavender-border",
            className
          )}
          {...ariaProps}
        >
          <NexusIcon icon={IconBell} size="toolbar" />
          {previewUnreadCount > 0 ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-pill bg-lavender animate-[signal-pulse_2.6s_var(--ease-nexus)_infinite]" /> : null}
        </button>
      )}
    >
      <div className="px-2.5 pb-2 pt-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-body-medium text-text-primary">Notifications</p>
            <p className="text-caption text-text-tertiary">Recent workspace signal</p>
          </div>
          <div className="flex items-center gap-2">
            {previewUnreadCount > 0 ? <span className="rounded-pill bg-lavender-subtle px-2 py-0.5 font-mono text-mono text-lavender">{previewUnreadCount} unread</span> : null}
            {previewUnreadCount > 0 ? <button type="button" onClick={() => void markAllAsRead()} className="text-caption text-text-tertiary hover:text-text-primary">Mark all read</button> : null}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 px-2.5 pb-2" aria-label="Loading notifications">
          {[0, 1, 2].map((entry) => <Skeleton key={entry} className="h-14 w-full rounded-input" />)}
        </div>
      ) : error ? (
        <p role="alert" className="px-3 py-4 text-caption text-danger">{error}</p>
      ) : items.length === 0 ? (
        <div className="px-3 py-5 text-center">
          <NexusIcon icon={IconBell} size="state" className="mx-auto mb-2 text-text-quaternary" />
          <p className="text-small text-text-secondary">You are all caught up.</p>
          <p className="mt-1 text-caption text-text-tertiary">NEXUS will surface what needs your attention.</p>
        </div>
      ) : (
        <div className="relative px-2.5 pb-2.5 pt-1">
          <div className="relative h-[min(320px,55vh)]">
            {items.map((item, index) => {
              const Icon = iconFor(item);
              const unread = !item.read_at;
              return (
                <motion.div
                  key={item.id}
                  layout={!reducedMotion}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: index * 10, scale: 1 - index * 0.018 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : index * 0.025 }}
                  whileHover={reducedMotion ? undefined : { y: index * 10 - 3, scale: 1 }}
                  className="absolute inset-x-0 top-0 origin-top"
                  style={{ zIndex: items.length - index }}
                >
                  <div className={cn("rounded-card border bg-bg-surface p-3 shadow-dropdown transition-colors", unread ? "border-lavender-border/60" : "border-border-subtle")}>
                    <div className="flex items-start gap-2.5">
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-input border", unread ? "border-lavender-border bg-lavender-subtle text-lavender" : "border-border-subtle text-text-tertiary")}>
                        <NexusIcon icon={Icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className={cn("min-w-0 flex-1 text-small", unread ? "font-medium text-text-primary" : "text-text-secondary")}>{item.title}</p>
                          {unread ? <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-pill bg-lavender" aria-label="Unread" /> : null}
                        </div>
                        {item.message ? <p className="mt-0.5 line-clamp-2 text-caption text-text-tertiary">{item.message}</p> : null}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="font-mono text-mono text-text-quaternary">{relativeTime(item.created_at)}</span>
                          <div className="flex items-center gap-2">
                            {unread ? <button type="button" onClick={() => void markAsRead(item.id)} className="text-caption text-text-tertiary hover:text-text-primary">Mark read</button> : null}
                            <Link href={routeFor(item.entity_type)} onClick={() => { if (unread) void markAsRead(item.id); }} className="text-caption text-text-secondary hover:text-text-primary">Open</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-border-subtle px-2.5 py-2">
        <Link href="/notifications" className="flex h-8 items-center justify-center rounded-nav text-caption font-medium text-text-secondary transition-colors hover:bg-accent-ghost hover:text-text-primary">View all notifications</Link>
      </div>
    </Dropdown>
  );
}
