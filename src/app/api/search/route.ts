// ============================================================
// NEXUS — UNIFIED SEARCH API
// GET /api/search?q=…
// ============================================================
// One query across every NEXUS domain: tasks, projects, goals,
// notes, files, events, activity. Each result carries its source so
// the UI (command palette, search surfaces) can show where it came
// from. Every read is RLS-scoped to the active workspace: the route
// never searches what the user cannot see.
//
// Sources run in parallel with per-source timeouts; a failing source
// is reported as unavailable, never silently dropped.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const SEARCH_SOURCES = [
  "tasks",
  "projects",
  "goals",
  "notes",
  "files",
  "events",
  "activity",
] as const;

export type SearchSource = (typeof SEARCH_SOURCES)[number];

export type SearchResult = {
  id: string;
  source: SearchSource;
  title: string;
  subtitle: string | null;
  href: string;
  /** Timestamp used for ordering (created/updated). */
  at: string | null;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  unavailable: SearchSource[];
  counts: Record<SearchSource, number>;
};

const PER_SOURCE_LIMIT = 5;
const SOURCE_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("SEARCH_SOURCE_TIMEOUT")),
      SOURCE_TIMEOUT_MS
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function toResult(
  source: SearchSource,
  row: Record<string, unknown>,
  options: { href: (row: Record<string, unknown>) => string; title?: string; subtitle?: (row: Record<string, unknown>) => string | null; at?: string }
): SearchResult {
  return {
    id: String(row.id ?? ""),
    source,
    title: options.title ?? String(row.title ?? row.name ?? "Untitled"),
    subtitle: options.subtitle ? options.subtitle(row) : null,
    href: options.href(row),
    at: (options.at ? row[options.at] : null) ? String(row[options.at!]) : null,
  };
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured in this environment" },
      { status: 503 }
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    const empty: SearchResponse = {
      query,
      results: [],
      unavailable: [],
      counts: { tasks: 0, projects: 0, goals: 0, notes: 0, files: 0, events: 0, activity: 0 },
    };
    return NextResponse.json(empty);
  }

  const supabase = await createClient();
  const { membership } = await getActiveMembership(supabase, user.id);
  const workspaceId = membership?.workspaceId;
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No active workspace associated with user" },
      { status: 400 }
    );
  }

  const like = `%${query.replace(/[%_]/g, (char) => `\\${char}`)}%`;

  const searches: { source: SearchSource; run: Promise<SearchResult[]> }[] = [
    {
      source: "tasks",
      run: (async () => {
        const { data } = await supabase
          .from("tasks")
          .select("id, title, status, due_at, updated_at")
          .eq("workspace_id", workspaceId)
          .ilike("title", like)
          .order("updated_at", { ascending: false })
          .limit(PER_SOURCE_LIMIT);
        return (data ?? []).map((row) =>
          toResult("tasks", row as Record<string, unknown>, {
            href: () => `/tasks`,
            subtitle: (r) =>
              `${r.status ?? ""}${r.due_at ? ` · due ${String(r.due_at).slice(0, 10)}` : ""}`,
            at: "updated_at",
          })
        );
      })(),
    },
    {
      source: "projects",
      run: (async () => {
        const { data } = await supabase
          .from("projects")
          .select("id, name, status, updated_at")
          .eq("workspace_id", workspaceId)
          .ilike("name", like)
          .order("updated_at", { ascending: false })
          .limit(PER_SOURCE_LIMIT);
        return (data ?? []).map((row) =>
          toResult("projects", row as Record<string, unknown>, {
            title: String((row as { name: string }).name),
            href: () => `/projects`,
            subtitle: (r) => String(r.status ?? ""),
            at: "updated_at",
          })
        );
      })(),
    },
    {
      source: "goals",
      run: (async () => {
        const { data } = await supabase
          .from("goals")
          .select("id, title, status, progress, updated_at")
          .eq("workspace_id", workspaceId)
          .ilike("title", like)
          .order("updated_at", { ascending: false })
          .limit(PER_SOURCE_LIMIT);
        return (data ?? []).map((row) =>
          toResult("goals", row as Record<string, unknown>, {
            href: () => `/goals`,
            subtitle: (r) => `${r.status ?? ""} · ${Number(r.progress ?? 0)}%`,
            at: "updated_at",
          })
        );
      })(),
    },
    {
      source: "notes",
      run: (async () => {
        const { data } = await supabase
          .from("notes")
          .select("id, title, note_type, updated_at")
          .eq("workspace_id", workspaceId)
          .is("archived_at", null)
          .ilike("title", like)
          .order("updated_at", { ascending: false })
          .limit(PER_SOURCE_LIMIT);
        return (data ?? []).map((row) =>
          toResult("notes", row as Record<string, unknown>, {
            href: () => `/notes`,
            subtitle: (r) => String(r.note_type ?? "standard"),
            at: "updated_at",
          })
        );
      })(),
    },
    {
      source: "files",
      run: (async () => {
        const { data } = await supabase
          .from("files")
          .select("id, name, mime_type, created_at")
          .eq("workspace_id", workspaceId)
          .ilike("name", like)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE_LIMIT);
        return (data ?? []).map((row) =>
          toResult("files", row as Record<string, unknown>, {
            title: String((row as { name: string }).name),
            href: () => `/files`,
            subtitle: (r) => String(r.mime_type ?? "file"),
            at: "created_at",
          })
        );
      })(),
    },
    {
      source: "events",
      run: (async () => {
        const { data } = await supabase
          .from("events")
          .select("id, title, start_at")
          .eq("workspace_id", workspaceId)
          .ilike("title", like)
          .order("start_at", { ascending: false })
          .limit(PER_SOURCE_LIMIT);
        return (data ?? []).map((row) =>
          toResult("events", row as Record<string, unknown>, {
            href: () => `/calendar`,
            subtitle: (r) => (r.start_at ? String(r.start_at).slice(0, 16).replace("T", " ") : null),
            at: "start_at",
          })
        );
      })(),
    },
    {
      source: "activity",
      run: (async () => {
        const { data } = await supabase
          .from("activities")
          .select("id, action, entity_type, entity_name, created_at")
          .eq("workspace_id", workspaceId)
          .ilike("entity_name", like)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE_LIMIT);
        return (data ?? []).map((row) =>
          toResult("activity", row as Record<string, unknown>, {
            title: String(row.entity_name ?? row.action ?? "Activity"),
            href: () => `/activity`,
            subtitle: (r) => `${r.action ?? ""} · ${r.entity_type ?? ""}`,
            at: "created_at",
          })
        );
      })(),
    },
  ];

  const settled = await Promise.allSettled(
    searches.map(async (entry) => ({ source: entry.source, results: await withTimeout(entry.run) }))
  );

  const results: SearchResult[] = [];
  const unavailable: SearchSource[] = [];
  const counts = {} as Record<SearchSource, number>;

  settled.forEach((outcome, index) => {
    const source = searches[index].source;
    if (outcome.status === "fulfilled") {
      counts[source] = outcome.value.results.length;
      results.push(...outcome.value.results);
    } else {
      unavailable.push(source);
      counts[source] = 0;
    }
  });

  results.sort((a, b) => {
    const timeA = a.at ? new Date(a.at).getTime() : 0;
    const timeB = b.at ? new Date(b.at).getTime() : 0;
    return timeB - timeA;
  });

  const response: SearchResponse = { query, results: results.slice(0, 30), unavailable, counts };
  return NextResponse.json(response);
}
