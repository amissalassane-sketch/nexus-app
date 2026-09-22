// ============================================================
// NEXUS ADMIN — PLATFORM HEALTH
// ============================================================
// A health panel that invents statuses is worse than no health panel:
// it teaches the operator to distrust every other number on the
// screen. Every service here resolves to one of seven states, each
// with exactly one cause:
//
//   operational     — measured (or verified by construction), fine
//   degraded        — measured, above the latency threshold
//   error           — measured, failing
//   not_configured  — the subsystem is absent on purpose (no key)
//   not_measured    — nothing can be checked from here
//   stale           — newest observation too old to trust
//   blocked         — the check needs something this app deliberately
//                     does not hold (e.g. service-role key)
//
// Nothing is simulated. There is no uptime percentage, because this
// application does not record history: computing one would require a
// time-series store that does not exist.
// ============================================================

import { headers } from "next/headers";
import { withTimeout } from "@/lib/auth-flow";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, readSupabaseConfig } from "@/lib/supabase/config";
import { detectAIProvider } from "@/lib/intelligence/ai-provider";
import type { ServiceHealth, ServiceStatus } from "./types";

/** Above this, a measured dependency is reported as degraded rather than
 *  operational. A real threshold on a real measurement — not a guess. */
const SLOW_MS = 1_500;
const PROBE_TIMEOUT_MS = 6_000;

function statusFromLatency(latencyMs: number): ServiceStatus {
  return latencyMs > SLOW_MS ? "degraded" : "operational";
}

async function probeDatabase(now: string): Promise<ServiceHealth> {
  const base: Omit<ServiceHealth, "status" | "latencyMs" | "detail"> = {
    id: "database",
    label: "Database",
    checkedAt: now,
  };

  if (!isSupabaseConfigured()) {
    return {
      ...base,
      status: "not_configured",
      detail:
        "Supabase is not configured on this deployment — set the public URL and key to bring the database online.",
      action: { label: "Open deployment settings", href: "/admin/security" },
    };
  }

  const supabase = await createClient();
  const controller = new AbortController();
  const started = performance.now();

  try {
    const { error } = await withTimeout(
      Promise.resolve(
        supabase
          .from("profiles")
          .select("id")
          .limit(1)
          .abortSignal(controller.signal)
      ),
      PROBE_TIMEOUT_MS,
      "ADMIN_PROBE_DB_TIMEOUT",
      controller
    );

    const latencyMs = Math.round(performance.now() - started);

    if (error) {
      return {
        ...base,
        status: "error",
        latencyMs,
        detail: `PostgREST rejected a minimal read (${error.code ?? "unknown code"}).`,
      };
    }

    return {
      ...base,
      status: statusFromLatency(latencyMs),
      latencyMs,
      detail:
        latencyMs > SLOW_MS
          ? `Read took ${latencyMs}ms, above the ${SLOW_MS}ms threshold.`
          : "Minimal PostgREST read completed.",
    };
  } catch {
    return {
      ...base,
      status: "error",
      latencyMs: Math.round(performance.now() - started),
      detail: `No answer within ${PROBE_TIMEOUT_MS}ms — the database probe timed out.`,
    };
  }
}

async function probeAuthentication(now: string): Promise<ServiceHealth> {
  const base = { id: "authentication", label: "Authentication", checkedAt: now };

  if (!isSupabaseConfigured()) {
    return {
      ...base,
      status: "not_configured",
      detail: "Supabase is not configured, so GoTrue is not reachable.",
    };
  }

  const supabase = await createClient();
  const started = performance.now();

  try {
    // getUser() is a real GoTrue round trip (getSession() only decodes the
    // local JWT and would prove nothing about the auth service). The auth
    // API takes no abort signal, so the bound is a plain timeout: the
    // request may finish after we stop waiting, which is acceptable for a
    // read-only probe and is stated here rather than hidden.
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.auth.getUser()),
      PROBE_TIMEOUT_MS,
      "ADMIN_PROBE_AUTH_TIMEOUT"
    );

    const latencyMs = Math.round(performance.now() - started);
    if (error) {
      return {
        ...base,
        status: "error",
        latencyMs,
        detail: "GoTrue rejected the session lookup.",
      };
    }
    return {
      ...base,
      status: statusFromLatency(latencyMs),
      latencyMs,
      detail: data.user
        ? "Session verified against GoTrue."
        : "GoTrue answered; no session on this request.",
    };
  } catch {
    return {
      ...base,
      status: "error",
      latencyMs: Math.round(performance.now() - started),
      detail: `No answer within ${PROBE_TIMEOUT_MS}ms — the auth probe timed out.`,
    };
  }
}

/**
 * Storage is a real bucket (migration 002, used by the Files domain).
 * The probe lists the bucket root through the member-scoped client: a
 * response (even an empty listing) proves the bucket exists and
 * answers; a "bucket not found" or RLS rejection is an error.
 */
async function probeStorage(now: string): Promise<ServiceHealth> {
  const base = { id: "storage", label: "Storage", checkedAt: now };

  if (!isSupabaseConfigured()) {
    return {
      ...base,
      status: "not_configured",
      detail: "Supabase is not configured, so the storage bucket is not reachable.",
    };
  }

  const supabase = await createClient();
  const started = performance.now();

  try {
    const { error } = await withTimeout(
      Promise.resolve(supabase.storage.from("nexus-files").list("", { limit: 1 })),
      PROBE_TIMEOUT_MS,
      "ADMIN_PROBE_STORAGE_TIMEOUT"
    );

    const latencyMs = Math.round(performance.now() - started);
    if (error) {
      return {
        ...base,
        status: "error",
        latencyMs,
        detail: `The nexus-files bucket rejected a listing (${error.message}).`,
      };
    }
    return {
      ...base,
      status: statusFromLatency(latencyMs),
      latencyMs,
      detail: "The nexus-files bucket answered a listing request.",
    };
  } catch {
    return {
      ...base,
      status: "error",
      latencyMs: Math.round(performance.now() - started),
      detail: `No answer within ${PROBE_TIMEOUT_MS}ms — the storage probe timed out.`,
    };
  }
}

/** The application server is the process rendering this very page. That
 *  is a real observation, and it avoids a self-referential HTTP call that
 *  could deadlock a single-threaded dev server. */
async function probeApi(now: string): Promise<ServiceHealth> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "unknown";
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const environment = process.env.VERCEL_ENV ?? null;

  const { config, error } = readSupabaseConfig();

  return {
    id: "api",
    label: "Application API",
    status: config ? "operational" : "degraded",
    checkedAt: now,
    detail: [
      `Serving this request on ${host}.`,
      environment ? `Environment: ${environment}.` : null,
      commit ? `Commit: ${commit.slice(0, 7)}.` : null,
      error ? "Public Supabase configuration is incomplete." : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function probeIntelligence(now: string): ServiceHealth {
  const provider = detectAIProvider();
  const external = provider.provider === "openai" || provider.provider === "anthropic";

  // The provider state is DECLARED by the environment, and that is the
  // correct semantics: no key means "not configured" (a deployment
  // decision), never "error" and never a fake green.
  return {
    id: "ai",
    label: "Intelligence / AI",
    status: external ? "not_measured" : "not_configured",
    checkedAt: now,
    detail: external
      ? `${provider.provider}${provider.model ? ` · ${provider.model}` : ""}. Configured, not verified. Reachability is not probed from here; request metrics live in the Intelligence panel.`
      : "No model provider is configured — NEXUS runs on the deterministic engine. Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable model reasoning.",
    action: external
      ? { label: "Open Intelligence metrics", href: "/admin/intelligence" }
      : { label: "Read the setup guide", href: "/admin/security" },
  };
}

function probePayments(now: string): ServiceHealth {
  // There is no payment provider in this codebase: /api/billing/upgrade
  // answers PAYMENT_PROVIDER_NOT_CONFIGURED. That is a declared
  // absence, not a failure — the state says which one it is.
  return {
    id: "payments",
    label: "Payments",
    status: "not_configured",
    checkedAt: now,
    detail:
      "No payment provider is connected, so there is nothing to check and no revenue to report. Billing answers honestly (PAYMENT_PROVIDER_NOT_CONFIGURED) instead of pretending.",
  };
}

function probeBackgroundJobs(now: string): ServiceHealth {
  // No queue or scheduler is deployed: automated work happens in
  // database triggers. Execution metrics for automations live in the
  // Background jobs panel; this row is about the *infrastructure*,
  // which does not exist yet — a declared absence.
  return {
    id: "jobs",
    label: "Background jobs",
    status: "not_configured",
    checkedAt: now,
    detail:
      "No queue or scheduler is deployed. Database triggers do the automated work; automation executions are measured in the Background jobs panel below.",
  };
}

/** The full panel. Measured services are probed in parallel and each one
 *  fails on its own, so a dead dependency cannot blank the whole page. */
export async function getPlatformHealth(): Promise<ServiceHealth[]> {
  const now = new Date().toISOString();

  const [database, authentication, api, storage] = await Promise.all([
    probeDatabase(now).catch(() => ({
      id: "database",
      label: "Database",
      status: "not_measured" as ServiceStatus,
      detail: "The probe failed before reporting a result.",
      checkedAt: now,
    })),
    probeAuthentication(now).catch(() => ({
      id: "authentication",
      label: "Authentication",
      status: "not_measured" as ServiceStatus,
      detail: "The probe failed before reporting a result.",
      checkedAt: now,
    })),
    probeApi(now).catch(() => ({
      id: "api",
      label: "Application API",
      status: "not_measured" as ServiceStatus,
      detail: "The probe failed before reporting a result.",
      checkedAt: now,
    })),
    probeStorage(now).catch(() => ({
      id: "storage",
      label: "Storage",
      status: "not_measured" as ServiceStatus,
      detail: "The probe failed before reporting a result.",
      checkedAt: now,
    })),
  ]);

  return [
    api,
    authentication,
    database,
    storage,
    probeIntelligence(now),
    probePayments(now),
    probeBackgroundJobs(now),
  ];
}

const STATUS_RANK: Record<ServiceStatus, number> = {
  "error": 0,
  "degraded": 1,
  "blocked": 2,
  "stale": 3,
  "not_configured": 4,
  "not_measured": 5,
  "operational": 6,
};

/** One line for the header: the worst status currently on the panel. */
export function summariseHealth(services: ServiceHealth[]): {
  status: ServiceStatus;
  label: string;
} {
  const worst = services.reduce<ServiceStatus>((current, service) => {
    return STATUS_RANK[service.status] < STATUS_RANK[current]
      ? service.status
      : current;
  }, "operational");

  const label: Record<ServiceStatus, string> = {
    "error": "A service is failing",
    "degraded": "Degraded",
    "blocked": "A check is blocked",
    "stale": "Data is stale",
    "not_configured": "Not fully configured",
    "not_measured": "Not measured",
    "operational": "Operational",
  };

  return { status: worst, label: label[worst] };
}
