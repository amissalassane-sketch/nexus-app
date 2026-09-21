import { isPlanLimitError } from "@/lib/plan-errors";

/**
 * The shape every failed Supabase-js / PostgREST call exposes
 * (`PostgrestError` and the transport errors share it).
 */
export type DataErrorLike =
  | {
      code?: string | null;
      message?: string | null;
      hint?: string | null;
      details?: string | null;
    }
  | null
  | undefined;

/**
 * The diagnostic triple kept from a failed read/write: the SQLSTATE or
 * PGRST code (`22P02`, `42703`, `PGRST204`…), the bounded raw message and
 * the Postgres hint when the database supplied one.
 *
 * What is deliberately NOT here: `details`. For constraint violations
 * Postgres puts the offending row values in it ("Key (workspace_id,
 * slug)=(…) already exists"), and this triple is rendered on screen and
 * written to the browser console. Code, message and hint are schema-level
 * strings (column/table/function/type names, error codes), which is what
 * an operator needs; the length bounds are the backstop for anything
 * unexpected.
 */
export type DataErrorDetail = {
  code: string;
  message: string;
  hint?: string;
};

const MAX_MESSAGE = 300;
const MAX_HINT = 200;

/** Reduces a failed call to its bounded diagnostic triple, or `null` when
 *  there is nothing to diagnose (no error, or an error with neither code
 *  nor message — e.g. a plain validation string). */
export function describeDataError(error: DataErrorLike): DataErrorDetail | null {
  if (!error) return null;
  const code = String(error.code ?? "").trim();
  const message = String(error.message ?? "").trim();
  const hint = String(error.hint ?? "").trim();
  if (!code && !message) return null;
  return {
    code: code || "unknown",
    message: message.slice(0, MAX_MESSAGE),
    ...(hint ? { hint: hint.slice(0, MAX_HINT) } : {}),
  };
}

/** The one-line, greppable form of a diagnostic — the same shape the server
 *  writes to the runtime logs (`src/lib/server-logs.ts`), so a browser
 *  console line and a Vercel log line read identically:
 *
 *    [nexus-data] projects.create failed code=22P02 message="…" hint="…"
 */
export function formatDataErrorLine(context: string, detail: DataErrorDetail): string {
  return `[nexus-data] ${context} failed code=${detail.code} message=${JSON.stringify(detail.message)}${
    detail.hint ? ` hint=${JSON.stringify(detail.hint)}` : ""
  }`;
}

/**
 * Browser-side logging of a failed read/write. Writes exactly the bounded
 * triple through `console.error` (never the raw error object, whose
 * `details` may carry row values) and returns the triple so the caller
 * can render it under the friendly message. No-op on a missing error.
 */
export function logDataError(context: string, error: DataErrorLike): DataErrorDetail | null {
  const detail = describeDataError(error);
  if (!detail) return null;
  console.error(formatDataErrorLine(context, detail));
  return detail;
}

/** Converts PostgREST/Postgres failures into safe, actionable product copy. */
export function humanizeDataError(
  error: { message?: string | null; code?: string | null } | null | undefined,
  fallback = "This change could not be completed. Please try again."
): string {
  const message = error?.message?.toLowerCase() ?? "";
  const code = error?.code ?? "";

  if (isPlanLimitError(error?.message)) {
    return "This workspace has reached its current plan limit. Review your plan to add more.";
  }
  if (
    code === "42501" ||
    message.includes("row-level security") ||
    message.includes("access denied") ||
    message.includes("permission denied") ||
    message.includes("workspace_access_denied")
  ) {
    return "You do not have permission to make this change in the current workspace.";
  }
  if (code === "23505" || message.includes("duplicate key") || message.includes("already exists")) {
    return "An item with these details already exists. Choose a different name and try again.";
  }
  if (message.includes("jwt") || message.includes("session") || message.includes("not authenticated")) {
    return "Your session has expired. Sign in again, then retry this change.";
  }
  if (message.includes("fetch") || message.includes("network") || message.includes("timeout")) {
    return "NEXUS could not reach the workspace. Check your connection and try again.";
  }
  // The "temporarily unavailable" bucket. It is reached by ANY PGRST*
  // code (PGRST204 unknown column, PGRST202 unknown function, PGRST116
  // row count, PGRST301 JWT…) and by ANY message containing the word
  // "column" — which is 42703 "column … does not exist" and PGRST204
  // "…column… in the schema cache", but also 23502 "null value in column
  // "x" of relation "y" violates not-null constraint" and 42804 "column
  // "x" is of type … but expression is of type …". The copy is therefore
  // a friendly bucket, not a diagnosis: the real code travels separately
  // (describeDataError) and is rendered under this sentence.
  if (message.includes("column") || message.includes("schema cache") || code.startsWith("PGRST")) {
    return "This workspace is temporarily unavailable while its data structure is updated. Try again shortly.";
  }

  return fallback;
}
