import { assertIntelligenceData, IntelligenceDataError } from "./data-error";
// ============================================================
// NEXUS INTELLIGENCE — SIGNAL STORE & PROACTIVE ORCHESTRATION
// ============================================================
// Persists signals in `intelligence_signals` (one row per signal per
// user×workspace, RLS-scoped) and exposes `getProactiveIntelligence`:
//
//   1. one snapshot → 2. detect → 3. score → 4. dedupe (fingerprint)
//   → 5. cooldown (vs persisted state) → 6. active signals
//   → 7. optional LLM explanation (bounded, fallback) → 8. actions
//
// The client never writes this table directly — only this server
// layer does. Stored data is structured and traceable (evidence,
// score breakdown), never raw model text.
// ============================================================

import type { WorkspaceSnapshot } from "./engine";
import type { ActivityContextItem, TaskDependencyContextItem } from "./types";
import {
  mergeSignalsWithState,
  SIGNAL_CONSTANTS,
  computeSignals,
  type DetectedSignal,
  type ProactiveResult,
  type StoredSignalRow,
} from "./signals";

export interface SignalDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

const ACTIVE_STATUSES = new Set(["new", "seen", "acted"]);

export interface GetProactiveOptions {
  activities?: ActivityContextItem[];
  dependencies?: TaskDependencyContextItem[];
  /** Enrich top signals with a human-friendly LLM narrative. The
   *  engine still decides existence + priority; the model only
   *  reformulates. */
  enrich?: boolean;
  now?: Date;
}

/** Reads the persisted signals for (workspace, user). */
export async function readSignals(
  db: SignalDbClient,
  workspaceId: string,
  userId: string
): Promise<StoredSignalRow[]> {
  const { data, error } = await db
    .from("intelligence_signals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("score", { ascending: false });

  assertIntelligenceData({ error });
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((row) => normalizeRow(row));
}

function normalizeRow(row: Record<string, unknown>): StoredSignalRow {
  return {
    id: String(row.id ?? ""),
    fingerprint: String(row.fingerprint ?? ""),
    type: (row.type ?? "TASK_OVERDUE") as StoredSignalRow["type"],
    severity: (row.severity ?? "info") as StoredSignalRow["severity"],
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    scoreBreakdown: Array.isArray(row.score_breakdown) ? row.score_breakdown : [],
    suggestedActions: Array.isArray(row.suggested_actions) ? row.suggested_actions : [],
    entityType: (row.entity_type ?? null) as StoredSignalRow["entityType"],
    entityId: (row.entity_id ?? null) as string | null,
    entityLabel: (row.entity_label ?? null) as string | null,
    score: Number(row.score ?? 0),
    confidence: Number(row.confidence ?? 0),
    affectedCount: Number(row.affected_count ?? 0),
    status: (row.status ?? "new") as StoredSignalRow["status"],
    createdAt: String(row.created_at ?? new Date().toISOString()),
    seenAt: (row.seen_at ?? null) as string | null,
    dismissedAt: (row.dismissed_at ?? null) as string | null,
    resolvedAt: (row.resolved_at ?? null) as string | null,
  };
}

async function insertSignals(
  db: SignalDbClient,
  workspaceId: string,
  userId: string,
  rows: StoredSignalRow[]
): Promise<StoredSignalRow[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({
    user_id: userId,
    workspace_id: workspaceId,
    fingerprint: row.fingerprint,
    type: row.type,
    severity: row.severity,
    title: row.title,
    summary: row.summary,
    evidence: row.evidence,
    score_breakdown: row.scoreBreakdown,
    suggested_actions: row.suggestedActions,
    entity_type: row.entityType,
    entity_id: row.entityId,
    entity_label: row.entityLabel,
    score: row.score,
    confidence: row.confidence,
    affected_count: row.affectedCount,
    status: "new",
    created_at: row.createdAt, // explicit — cooldown/lifetime rely on it
  }));
  // Batch insert, ignoring already-present fingerprints (upsert).
  const { data, error } = await db.from("intelligence_signals").insert(payload).select("id, fingerprint");
  assertIntelligenceData({ error });
  if (!Array.isArray(data) || data.length !== rows.length) throw new IntelligenceDataError();
  // Return the inserted rows with their REAL persisted ids so the
  // orchestration can surface them (never placeholder ids).
  const byFingerprint = new Map(rows.map((row) => [row.fingerprint, row]));
  return data.map((inserted: Record<string, unknown>) => {
    const template = byFingerprint.get(String(inserted.fingerprint));
    return template ? { ...template, id: String(inserted.id) } : template;
  }).filter((row): row is StoredSignalRow => Boolean(row));
}

async function updateSignals(
  db: SignalDbClient,
  workspaceId: string,
  userId: string,
  updates: { id: string; patch: Partial<StoredSignalRow> }[]
): Promise<void> {
  for (const { id, patch } of updates) {
    const dbPatch: Record<string, unknown> = {};
    if (patch.severity !== undefined) dbPatch.severity = patch.severity;
    if (patch.score !== undefined) dbPatch.score = patch.score;
    if (patch.scoreBreakdown !== undefined) dbPatch.score_breakdown = patch.scoreBreakdown;
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.summary !== undefined) dbPatch.summary = patch.summary;
    if (patch.evidence !== undefined) dbPatch.evidence = patch.evidence;
    if (patch.suggestedActions !== undefined) dbPatch.suggested_actions = patch.suggestedActions;
    if (patch.confidence !== undefined) dbPatch.confidence = patch.confidence;
    if (patch.affectedCount !== undefined) dbPatch.affected_count = patch.affectedCount;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.seenAt !== undefined) dbPatch.seen_at = patch.seenAt;
    if (patch.dismissedAt !== undefined) dbPatch.dismissed_at = patch.dismissedAt;
    if (patch.resolvedAt !== undefined) dbPatch.resolved_at = patch.resolvedAt;
    const result = await db
      .from("intelligence_signals")
      .update(dbPatch)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);
    assertIntelligenceData(result);
  }
}

async function resolveSignals(
  db: SignalDbClient,
  workspaceId: string,
  userId: string,
  ids: { id: string }[],
  now: Date
): Promise<void> {
  if (ids.length === 0) return;
  for (const { id } of ids) {
    const result = await db
      .from("intelligence_signals")
      .update({ status: "resolved", resolved_at: now.toISOString() })
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);
    assertIntelligenceData(result);
  }
}

/** Marks a signal seen (displayed) or dismissed/resolved by the user. */
export async function updateSignalStatus(
  db: SignalDbClient,
  workspaceId: string,
  userId: string,
  id: string,
  status: "seen" | "dismissed" | "resolved",
  now: Date = new Date()
): Promise<boolean> {
  const patch: Record<string, unknown> = { status };
  if (status === "seen") patch.seen_at = now.toISOString();
  if (status === "dismissed") patch.dismissed_at = now.toISOString();
  if (status === "resolved") patch.resolved_at = now.toISOString();
  const { data, error } = await db
    .from("intelligence_signals")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  assertIntelligenceData({ error });
  return Boolean(data);
}

/** Marks a signal "acted" after a verified mutation (server-side only). */
export async function markSignalActed(
  db: SignalDbClient,
  workspaceId: string,
  userId: string,
  id: string
): Promise<void> {
  const result = await db
    .from("intelligence_signals")
    .update({ status: "acted" })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  assertIntelligenceData(result);
}

// ============================================================
// LLM ENRICHMENT — optional, bounded, fallback-safe
// ============================================================

export interface EnrichSignalsOptions {
  config?: { provider: "openai" | "anthropic" | "nexus-engine"; apiKey?: string; model?: string };
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function detectSignalAIProvider() {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) return { provider: "openai" as const, apiKey: openaiKey, model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini" };
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) return { provider: "anthropic" as const, apiKey: anthropicKey, model: process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-20241022" };
  return { provider: "nexus-engine" as const };
}

const ENRICH_SYSTEM_PROMPT = `You are the explanation layer of NEXUS Intelligence. You receive VERIFIED workspace signals with their evidence and must produce a single human-friendly, factual explanation per signal.

STRICT RULES:
1. NEVER invent facts. Only reformulate the provided evidence.
2. Keep each explanation to 1–2 sentences, in the user's language (French or English).
3. Do not add projects, tasks, dates, priorities or statistics that are not in the evidence.
4. Output strict JSON: {"narratives":[{"fingerprint":"...","text":"..."}]}`;

/** Reformulates up to N signal summaries with the LLM. Any failure
 *  (no key, timeout, invalid JSON, network) returns null and the
 *  deterministic summaries are kept — the engine never depends on
 *  the model. */
export async function enrichSignalsWithLLM(
  signals: DetectedSignal[],
  options?: EnrichSignalsOptions
): Promise<Record<string, string> | null> {
  const config = options?.config ?? detectSignalAIProvider();
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 8000;

  if (config.provider === "nexus-engine" || !config.apiKey || signals.length === 0) return null;

  const payload = signals.slice(0, 3).map((signal) => ({
    fingerprint: signal.fingerprint,
    type: signal.type,
    severity: signal.severity,
    title: signal.title,
    summary: signal.summary,
    evidence: signal.evidence,
  }));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    let rawText: string | null = null;

    if (config.provider === "openai") {
      res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: ENRICH_SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(payload) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 600,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      rawText = data.choices?.[0]?.message?.content ?? null;
    } else if (config.provider === "anthropic") {
      res = await fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: config.model,
          system: ENRICH_SYSTEM_PROMPT,
          messages: [{ role: "user", content: JSON.stringify(payload) }],
          max_tokens: 600,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      rawText = data.content?.[0]?.text ?? null;
    } else {
      return null;
    }

    if (!rawText) return null;
    const parsed = JSON.parse(rawText) as { narratives?: { fingerprint?: string; text?: string }[] };
    if (!Array.isArray(parsed.narratives)) return null;

    const out: Record<string, string> = {};
    for (const narrative of parsed.narratives) {
      if (narrative.fingerprint && typeof narrative.text === "string" && narrative.text.trim()) {
        out[narrative.fingerprint] = narrative.text.trim().slice(0, 400);
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch (error) {
    console.warn("Signal LLM enrichment failed, keeping deterministic summaries:", error);
    return null;
  }
}

// ============================================================
// ORCHESTRATION — getProactiveIntelligence
// ============================================================

/**
 * One snapshot → signals → score → dedupe → cooldown → active.
 * Persists new/changed/resolved rows and returns what deserves the
 * user's attention. The LLM (optional) only reformulates.
 */
export async function getProactiveIntelligence(
  db: SignalDbClient,
  workspaceId: string,
  userId: string,
  snapshot: WorkspaceSnapshot,
  options: GetProactiveOptions = {}
): Promise<ProactiveResult> {
  const now = options.now ?? new Date();

  // 1. Detect (deterministic, one snapshot).
  const detected = computeSignals(snapshot, {
    workspaceId,
    activities: options.activities,
    dependencies: options.dependencies,
    now,
  });

  // 2. Load persisted state for this (user, workspace).
  const stored = await readSignals(db, workspaceId, userId);

  // 3. Dedupe + cooldown.
  const merge = mergeSignalsWithState(detected, stored, now);

  // 4. Persist (new rows come back with their real persisted ids).
  const inserted = await insertSignals(db, workspaceId, userId, merge.toInsert);
  await updateSignals(db, workspaceId, userId, merge.toUpdate);
  await resolveSignals(db, workspaceId, userId, merge.toResolve, now);

  // Surface real ids in the active set (placeholder ids never leak).
  const idByFingerprint = new Map(inserted.map((row) => [row.fingerprint, row.id]));
  merge.active = merge.active.map((row) =>
    idByFingerprint.has(row.fingerprint) ? { ...row, id: idByFingerprint.get(row.fingerprint)! } : row
  );

  // 5. Optional LLM explanation (bounded; deterministic fallback).
  let llmEnriched = false;
  if (options.enrich && merge.active.length > 0) {
    const narratives = await enrichSignalsWithLLM(detected);
    if (narratives) {
      llmEnriched = true;
      for (const signal of merge.active) {
        const narrative = narratives[signal.fingerprint];
        if (narrative) signal.summary = narrative;
      }
    }
  }

  // 6. Active signals, sorted, with the silence rules applied:
  //    below the display threshold → not surfaced.
  const displayable = merge.active
    .filter((signal) => signal.score >= SIGNAL_CONSTANTS.DISPLAY_MIN_SCORE)
    .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));

  const attentionCount = displayable.length;
  const criticalCount = displayable.filter((signal) => signal.severity === "critical").length;

  return {
    signals: displayable,
    attentionCount,
    criticalCount,
    refreshedAt: now.toISOString(),
    llmEnriched,
  };
}

/** True when a status belongs to the active display set. */
export function isActiveSignalStatus(status: StoredSignalRow["status"]): boolean {
  return ACTIVE_STATUSES.has(status);
}
