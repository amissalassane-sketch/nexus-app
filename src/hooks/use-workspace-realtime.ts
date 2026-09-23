"use client";

import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RealtimeChange<T = Record<string, unknown>> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: Partial<T>;
};

export type UseWorkspaceRealtimeOptions<T = Record<string, unknown>> = {
  supabase: SupabaseClient;
  workspaceId: string | null;
  table: string;
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (oldRecord: Partial<T>) => void;
  onChange?: (change: RealtimeChange<T>) => void;
  enabled?: boolean;
};

/**
 * Subscribes to Postgres row changes for a given table, scoped strictly to the active workspace.
 * Uses refs to prevent channel churn across re-renders.
 */
export function useWorkspaceRealtime<T = Record<string, unknown>>({
  supabase,
  workspaceId,
  table,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
}: UseWorkspaceRealtimeOptions<T>) {
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!enabled || !workspaceId || typeof supabase?.channel !== "function") {
      return;
    }

    const uniqueId = Math.random().toString(36).slice(2, 8);
    const channelName = `realtime:${table}:${workspaceId}:${uniqueId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as unknown as Parameters<ReturnType<typeof supabase.channel>["on"]>[0],
        {
          event: "*",
          schema: "public",
          table,
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: T; old: Partial<T> }) => {
          const change: RealtimeChange<T> = {
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
          };

          onChangeRef.current?.(change);

          if (payload.eventType === "INSERT") {
            onInsertRef.current?.(payload.new);
          } else if (payload.eventType === "UPDATE") {
            onUpdateRef.current?.(payload.new);
          } else if (payload.eventType === "DELETE") {
            onDeleteRef.current?.(payload.old);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, workspaceId, table, enabled]);
}
