// ============================================================
// NEXUS — SEARCH API (P6 ⌘K)
// GET /api/search?q=…  → workspace-scoped matches across
// tasks / projects / goals. Authenticated, rate-limited.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const WINDOW_MS = 60_000;
const MAX_CALLS = 60;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_CALLS) return false;
  bucket.count += 1;
  return true;
}

export type SearchHit = {
  id: string;
  kind: "task" | "project" | "goal";
  title: string;
  href: string;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!rateLimit(`${ip}|${user.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 60);

  if (query.length < 2) {
    return NextResponse.json({ hits: [] as SearchHit[] });
  }

  // Resolve workspace (ordered + limited — pitfall #2).
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const workspaceId = membership?.workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ hits: [] as SearchHit[] });
  }

  const pattern = `%${query.replace(/[%_]/g, (match) => `\\${match}`)}%`;

  const [tasksResult, projectsResult, goalsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .ilike("title", pattern)
      .limit(5),
    supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .ilike("name", pattern)
      .limit(5),
    supabase
      .from("goals")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .ilike("title", pattern)
      .limit(5),
  ]);

  const hits: SearchHit[] = [
    ...((tasksResult.data as Array<{ id: string; title: string }> | null) ?? []).map((row) => ({
      id: row.id,
      kind: "task" as const,
      title: row.title,
      href: "/tasks",
    })),
    ...((projectsResult.data as Array<{ id: string; name: string }> | null) ?? []).map((row) => ({
      id: row.id,
      kind: "project" as const,
      title: row.name,
      href: "/projects",
    })),
    ...((goalsResult.data as Array<{ id: string; title: string }> | null) ?? []).map((row) => ({
      id: row.id,
      kind: "goal" as const,
      title: row.title,
      href: "/goals",
    })),
  ];

  return NextResponse.json({ hits });
}
