/** Distinguishes unavailable/denied storage from successful empty results.
 * Never carries SQL details, credentials or customer content to the caller. */
export class IntelligenceDataError extends Error {
  readonly code: "NOT_AUTHORIZED" | "INTELLIGENCE_UNAVAILABLE";
  readonly status: 403 | 503;
  constructor(denied = false) {
    super(denied ? "Not authorized to access this workspace" : "Intelligence data is temporarily unavailable");
    this.name = "IntelligenceDataError";
    this.code = denied ? "NOT_AUTHORIZED" : "INTELLIGENCE_UNAVAILABLE";
    this.status = denied ? 403 : 503;
  }
}

export function assertIntelligenceData(...results: { error?: unknown }[]): void {
  for (const result of results) {
    if (!result.error) continue;
    const error = result.error as { code?: string };
    throw new IntelligenceDataError(error.code === "42501");
  }
}
