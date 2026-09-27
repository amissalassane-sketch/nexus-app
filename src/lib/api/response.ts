import { NextResponse } from "next/server";

/**
 * Standardized API Response shapes following the `api-and-interface-design` skill.
 * Ensures consistent envelope, predictable error fields, and full backward compatibility.
 */

export interface ApiSuccessBody<T = unknown> {
  ok: true;
  data?: T;
  [key: string]: unknown;
}

export interface ApiErrorBody {
  ok: false;
  error: string; // Backward compatibility with legacy { error: string } consumers
  code: string;  // Machine-readable uppercase identifier (e.g., 'UNAUTHORIZED', 'VALIDATION_FAILED')
  message: string;
  details?: unknown;
  [key: string]: unknown;
}

export type ApiResponse<T = unknown> = NextResponse<ApiSuccessBody<T> | ApiErrorBody>;

/**
 * Creates a standard JSON success response.
 */
export function apiSuccess<T extends Record<string, unknown> | unknown[] | object>(
  payload: T,
  init?: { status?: number; headers?: HeadersInit }
): NextResponse {
  const status = init?.status ?? 200;
  // If payload already has top-level fields, keep them and ensure `ok: true`
  const body = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? { ok: true, ...payload }
    : { ok: true, data: payload };

  return NextResponse.json(body, {
    status,
    headers: init?.headers,
  });
}

/**
 * Creates a standard JSON error response with code, message, and details.
 */
export function apiError(
  message: string,
  options?: {
    code?: string;
    status?: number;
    details?: unknown;
    headers?: HeadersInit;
    extra?: Record<string, unknown>;
  }
): NextResponse {
  const status = options?.status ?? 400;
  const code = options?.code ?? defaultCodeForStatus(status);

  const body: ApiErrorBody = {
    ok: false,
    error: message,
    code,
    message,
    ...(options?.details !== undefined ? { details: options.details } : {}),
    ...(options?.extra ?? {}),
  };

  return NextResponse.json(body, {
    status,
    headers: options?.headers,
  });
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400: return "BAD_REQUEST";
    case 401: return "UNAUTHORIZED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 422: return "UNPROCESSABLE_ENTITY";
    case 429: return "TOO_MANY_REQUESTS";
    case 500: return "INTERNAL_SERVER_ERROR";
    case 501: return "NOT_IMPLEMENTED";
    case 502: return "BAD_GATEWAY";
    case 503: return "SERVICE_UNAVAILABLE";
    default: return status >= 500 ? "SERVER_ERROR" : "CLIENT_ERROR";
  }
}
