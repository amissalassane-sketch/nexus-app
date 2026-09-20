// ============================================================
// NEXUS — SERVER-SIDE DATA-READ LOGGING
// ============================================================
// console.* inside server components and route handlers lands in the
// Vercel Runtime Logs. This helper is the single shape used when a
// workspace data read fails on the server, so the logs stay greppable:
//
//   [nexus-data] read failed context=dashboard.projects code=PGRST204
//     message="Could not find the column 'due_date' in the schema cache"
//
// What may be logged — and only what may:
//   * the context (which read, which page/RPC)
//   * the error CODE  (SQLSTATE or PGRST code)
//   * the error MESSAGE (bounded to 300 chars)
//   * the error HINT when the database supplied one (bounded to 200)
//
// What never is: request data, row values, user identifiers, headers,
// tokens. The raw message for the errors this surface sees is schema-level
// (missing column/table/function, permission), which is precisely what an
// operator needs; the bound is the backstop for anything unexpected.
//
// The friendly copy shown to the user is produced separately by
// humanizeDataError() in data-errors.ts — the log line is for the
// operator, the user-facing message is for the human. The two never share
// a string, on purpose.
// ============================================================

export type DataReadError = {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
  details?: string | null;
} | null | undefined;

const MAX_MESSAGE = 300;
const MAX_HINT = 200;

function bound(value: string | null | undefined, max: number): string {
  return (value ?? "").slice(0, max);
}

/** Logs one failed server-side data read. Safe to call with null/undefined
 *  (a missing error is a no-op, not a crash). */
export function logDataReadFailure(context: string, error: DataReadError): void {
  if (!error) return;
  const code = String(error.code ?? "").trim() || "unknown";
  const message = bound(error.message, MAX_MESSAGE);
  const hint = bound(error.hint, MAX_HINT);
  console.error(
    `[nexus-data] read failed context=${context} code=${code} message=${JSON.stringify(message)}${hint ? ` hint=${JSON.stringify(hint)}` : ""}`
  );
}
