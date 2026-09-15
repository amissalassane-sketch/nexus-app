import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { callAdminRpc } from "./directory";
import { classify } from "./data";
import type { AdminDataError } from "./types";

export type AdminListQuery = { search: string | null; filter: string; page: number; pageSize: number };
export type AdminActivityPayload = {
  generated_at: string; page: number; page_size: number; search: string | null;
  action: string | null; total: number; items: Array<Record<string, unknown>>;
};
export type AdminAuditPayload = {
  generated_at: string; page: number; page_size: number; search: string | null;
  outcome: string | null; total: number; items: Array<Record<string, unknown>>;
};
export type AdminSecurityPayload = {
  generated_at: string; platform_admin: Record<string, unknown>;
  audit: { events_total: number; denied_total: number };
  sessions: { state: "unavailable"; reason: string };
};
export type AdminRead<T> = { state: "ok" | "empty"; payload: T } | { state: "unavailable"; error: AdminDataError };

export function parseAdminListQuery(
  sp: Record<string, string | string[] | undefined>,
  filterName: "action" | "outcome"
): AdminListQuery {
  const one = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
  const raw = one(sp.q)?.trim().slice(0, 200) || null;
  const filter = one(sp[filterName])?.trim().slice(0, 80) || "all";
  const page = Math.max(1, Math.min(1000, Number.parseInt(one(sp.page) || "1", 10) || 1));
  const sizeRaw = Number.parseInt(one(sp.size) || "25", 10);
  const pageSize = [10, 25, 50, 100].includes(sizeRaw) ? sizeRaw : 25;
  return { search: raw, filter, page, pageSize };
}

function validList(value: unknown): value is { generated_at: string; total: number; items: Array<Record<string, unknown>> } {
  return !!value && typeof value === "object" && typeof (value as { generated_at?: unknown }).generated_at === "string"
    && typeof (value as { total?: unknown }).total === "number" && Array.isArray((value as { items?: unknown }).items);
}

async function client(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>> } | { error: AdminDataError }> {
  if (!(await getAuthenticatedUser())) return { error: { code: "FORBIDDEN", message: "Not signed in." } };
  if (!isSupabaseConfigured()) return { error: { code: "NOT_INSTALLED", message: "Supabase is not configured, so there is no admin data to show." } };
  return { supabase: await createClient() };
}

export async function getAdminActivity(q: AdminListQuery): Promise<AdminRead<AdminActivityPayload>> {
  const resolved = await client(); if ("error" in resolved) return { state: "unavailable", error: resolved.error };
  const r = await callAdminRpc(resolved.supabase, "admin_activity_list",
    { p_search: q.search, p_action: q.filter === "all" ? null : q.filter, p_page: q.page, p_page_size: q.pageSize }, 10000, "ADMIN_ACTIVITY_LIST_TIMEOUT");
  if (r.error) return { state: "unavailable", error: classify(r.error) };
  if (!validList(r.data)) return { state: "unavailable", error: { code: "INVALID_PAYLOAD", message: "admin_activity_list() returned an unexpected shape." } };
  return { state: r.data.items.length ? "ok" : "empty", payload: r.data as AdminActivityPayload };
}

export async function getAdminAuditLog(q: AdminListQuery): Promise<AdminRead<AdminAuditPayload>> {
  const resolved = await client(); if ("error" in resolved) return { state: "unavailable", error: resolved.error };
  const r = await callAdminRpc(resolved.supabase, "admin_audit_log_list",
    { p_search: q.search, p_outcome: q.filter === "all" ? null : q.filter, p_page: q.page, p_page_size: q.pageSize }, 10000, "ADMIN_AUDIT_LIST_TIMEOUT");
  if (r.error) return { state: "unavailable", error: classify(r.error) };
  if (!validList(r.data)) return { state: "unavailable", error: { code: "INVALID_PAYLOAD", message: "admin_audit_log_list() returned an unexpected shape." } };
  return { state: r.data.items.length ? "ok" : "empty", payload: r.data as AdminAuditPayload };
}

export async function getAdminSecurity(): Promise<AdminRead<AdminSecurityPayload>> {
  const resolved = await client(); if ("error" in resolved) return { state: "unavailable", error: resolved.error };
  const r = await callAdminRpc(resolved.supabase, "admin_security_overview", {}, 10000, "ADMIN_SECURITY_TIMEOUT");
  if (r.error) return { state: "unavailable", error: classify(r.error) };
  if (!r.data || typeof r.data !== "object" || typeof (r.data as { generated_at?: unknown }).generated_at !== "string") {
    return { state: "unavailable", error: { code: "INVALID_PAYLOAD", message: "admin_security_overview() returned an unexpected shape." } };
  }
  return { state: "ok", payload: r.data as AdminSecurityPayload };
}
