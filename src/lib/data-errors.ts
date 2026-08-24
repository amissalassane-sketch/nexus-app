import { isPlanLimitError } from "@/lib/plan-errors";

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
  if (message.includes("column") || message.includes("schema cache") || code.startsWith("PGRST")) {
    return "This workspace is temporarily unavailable while its data structure is updated. Try again shortly.";
  }

  return fallback;
}
