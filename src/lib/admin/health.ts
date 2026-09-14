// ============================================================
// NEXUS ADMIN — PLATFORM HEALTH
// ============================================================
// A health panel that invents statuses is worse than no health panel: it
// teaches the operator to distrust every other number on the screen. So
// every service here is either
//
//   * MEASURED   — a real call was made and timed, or
//   * DECLARED   — the environment says whether the subsystem is wired up
//                  at all (AI provider, payment provider), or
//   * UNKNOWN    — nothing can be checked from here, and the panel says
//                  exactly that instead of showing a green dot.
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
      status: "down",
      detail: "Supabase is not configured on this deployment.",
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
        status: "down",
        latencyMs,
        detail: "PostgREST rejected a minimal read.",
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
      status: "down",
      latencyMs: Math.round(performance.now() - started),
      detail: `No answer within ${PROBE_TIMEOUT_MS}ms.`,
    };
  }
}

async function probeAuthentication(now: string): Promise<ServiceHealth> {
  const base = { id: "authentication", label: "Authentication", checkedAt: now };

  if (!isSupabaseConfigured()) {
    return { ...base, status: "down", detail: "Supabase is not configured." };
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
        status: "down",
        latencyMs,
        detail: "GoTrue rejected the session lookup.",
      };
    }
    return {
      ...base,
      status: statusFromLatency(latencyMs),
      latencyMs,
      detail: data.user ? "Session verified against GoTrue." : "GoTrue answered; no session.",
    };
  } catch {
    return {
      ...base,
      status: "down",
      latencyMs: Math.round(performance.now() - started),
      detail: `No answer within ${PROBE_TIMEOUT_MS}ms.`,
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

  return {
    id: "ai",
    label: "Intelligence / AI",
    status: external ? "operational" : "unknown",
    checkedAt: now,
    detail: external
      ? `${provider.provider}${provider.model ? ` · ${provider.model}` : ""}. Reachability is not probed from here.`
      : "No model provider configured — NEXUS falls back to the deterministic engine.",
  };
}

function probePayments(now: string): ServiceHealth {
  // There is no payment provider in this codebase: /api/billing/upgrade
  // answers PAYMENT_PROVIDER_NOT_CONFIGURED. Reporting "operational"
  // would be a lie, and reporting "down" would imply a failure.
  return {
    id: "payments",
    label: "Payments",
    status: "unknown",
    checkedAt: now,
    detail: "No payment provider is connected, so there is nothing to check and no revenue to report.",
  };
}

function probeStorage(now: string): ServiceHealth {
  return {
    id: "storage",
    label: "Storage",
    status: "unknown",
    checkedAt: now,
    detail: "No storage bucket is used by the application yet.",
  };
}

function probeBackgroundJobs(now: string): ServiceHealth {
  return {
    id: "jobs",
    label: "Background jobs",
    status: "unknown",
    checkedAt: now,
    detail: "No queue or scheduler is deployed. Database triggers do the automated work.",
  };
}

/** The full panel. Measured services are probed in parallel and each one
 *  fails on its own, so a dead dependency cannot blank the whole page. */
export async function getPlatformHealth(): Promise<ServiceHealth[]> {
  const now = new Date().toISOString();

  const [database, authentication, api] = await Promise.all([
    probeDatabase(now).catch(() => ({
      id: "database",
      label: "Database",
      status: "unknown" as ServiceStatus,
      detail: "The probe failed before reporting a result.",
      checkedAt: now,
    })),
    probeAuthentication(now).catch(() => ({
      id: "authentication",
      label: "Authentication",
      status: "unknown" as ServiceStatus,
      detail: "The probe failed before reporting a result.",
      checkedAt: now,
    })),
    probeApi(now).catch(() => ({
      id: "api",
      label: "Application API",
      status: "unknown" as ServiceStatus,
      detail: "The probe failed before reporting a result.",
      checkedAt: now,
    })),
  ]);

  return [
    api,
    authentication,
    database,
    probeStorage(now),
    probeIntelligence(now),
    probePayments(now),
    probeBackgroundJobs(now),
  ];
}

/** One line for the header: the worst status currently on the panel. */
export function summariseHealth(services: ServiceHealth[]): {
  status: ServiceStatus;
  label: string;
} {
  if (services.some((s) => s.status === "down")) {
    return { status: "down", label: "A service is down" };
  }
  if (services.some((s) => s.status === "degraded")) {
    return { status: "degraded", label: "Degraded" };
  }
  if (services.every((s) => s.status === "unknown")) {
    return { status: "unknown", label: "Not measured" };
  }
  return { status: "operational", label: "Operational" };
}
