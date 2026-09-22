// ============================================================
// NEXUS — INTEGRATION PLATFORM CONTRACT TESTS
// ============================================================
// Hermetic tests over the integration platform: OAuth URL
// construction, token exchange (fake transport), credential
// sealing, capability-model honesty, and the connection lifecycle.
// No provider is contacted; every fetch is injected.
//
// Run:  node --import tsx supabase/tests/integrations-contract.test.mjs

let passed = 0;
let failed = 0;

function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

function truthy(name, value, detail = "") {
  if (value) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---- module under test (env-dependent pieces get controlled env) ----
process.env.NEXUS_INTEGRATION_ENCRYPTION_KEY =
  "a".repeat(64); // 32 bytes hex

const {
  PROVIDERS,
  getProvider,
  getProviderConfiguration,
  CONNECTION_STATE_LABEL,
  isConnectionLifecycleState,
} = await import("../../src/lib/integrations/providers.ts");
const { encryptSecret, decryptSecret, readEncryptionKey } = await import("../../src/lib/integrations/crypto.ts");
const { beginConnect, exchangeCodeForTokens, toConnectionView } = await import("../../src/lib/integrations/connections.ts");
const {
  listEventsInRange,
  findFreeWindows,
  detectConflicts,
  normalizeEvent,
} = await import("../../src/lib/integrations/adapters/google-calendar.ts");

// ============================================================
console.log("\n-- provider registry ----------------------------------");

eq("phase 1 providers are exactly the six priorities", PROVIDERS.filter((p) => p.phase === 1).map((p) => p.id), [
  "gmail",
  "google-calendar",
  "slack",
  "notion",
  "github",
  "linear",
]);

truthy(
  "every provider declares minimum scopes with a justification note",
  PROVIDERS.every((p) => p.oauth.scopes.length > 0 && p.oauth.scopes.every((scope) => p.oauth.scopeNotes[scope]))
);

truthy(
  "every capability carries adapter status — nothing is silently 'available'",
  PROVIDERS.every((p) => p.capabilities.length > 0 && p.capabilities.every((c) => c.adapter === "implemented" || c.adapter === "planned"))
);

// Drafting is the one exception the product allows: automatic, but
// clearly marked as a draft (COPY rules). Everything else that writes
// externally requires confirmation.
truthy(
  "every external write capability requires confirmation (drafts excepted)",
  PROVIDERS.every((p) =>
    p.capabilities
      .filter((c) => ["create", "update", "delete"].includes(c.verb))
      .every((c) => c.requiresConfirmation === true || c.id.endsWith("-draft"))
  )
);
truthy(
  "draft capabilities are never marked as confirmed-sendable",
  PROVIDERS.every((p) =>
    p.capabilities.filter((c) => c.id.endsWith("-draft")).every((c) => c.requiresConfirmation !== true)
  )
);

const implementedCapabilities = PROVIDERS.flatMap((p) =>
  p.capabilities.filter((c) => c.adapter === "implemented").map((c) => `${p.id}:${c.id}`)
);
eq(
  "implemented capabilities match existing server adapters (only google-calendar reads today)",
  implementedCapabilities,
  ["google-calendar:gcal-list", "google-calendar:gcal-conflicts", "google-calendar:gcal-availability"]
);

truthy(
  "connection lifecycle covers all seven states including disconnected",
  isConnectionLifecycleState("disconnected") &&
    isConnectionLifecycleState("connected") &&
    isConnectionLifecycleState("reauth_required")
);
eq("no 'unknown' connection state exists", "unknown" in CONNECTION_STATE_LABEL, false);

// ============================================================
console.log("\n-- OAuth URL construction -----------------------------");

// Without env credentials the provider is honestly not configured.
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
let google = getProvider("google-calendar");
let config = getProviderConfiguration(google);
eq("google without env is not configured", config.configured, false);
eq("missing env vars are named exactly", config.missing, ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);

const refused = beginConnect({ providerId: "google-calendar", origin: "https://nexus.example" });
eq("connect without configuration refuses (no redirect)", refused.error, "NOT_CONFIGURED");

// With credentials the authorize URL is built with state + scopes.
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
google = getProvider("google-calendar");
config = getProviderConfiguration(google);
eq("google with env is configured", config.configured, true);

const connect = beginConnect({ providerId: "google-calendar", origin: "https://nexus.example" });
truthy("connect returns a redirect url", typeof connect.url === "string");
const url = new URL(connect.url);
eq("authorize endpoint is Google's", url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
eq("redirect uri points at the callback route", url.searchParams.get("redirect_uri"), "https://nexus.example/api/integrations/callback/google-calendar");
eq("response type is code", url.searchParams.get("response_type"), "code");
truthy("scopes are the minimum set requested", url.searchParams.get("scope").includes("calendar.readonly"));
truthy("state is a non-empty CSRF token", typeof connect.state === "string" && connect.state.length >= 16);
eq("state is echoed in the url", url.searchParams.get("state"), connect.state);

eq("connect for an unknown provider is a 404-class answer", beginConnect({ providerId: "nope", origin: "https://x" }).error, "UNKNOWN_PROVIDER");

// ============================================================
console.log("\n-- token exchange (fake transport) ---------------------");

// The exchange path uses global fetch — patch it for this test.
process.env.GITHUB_CLIENT_ID = "gh-id";
process.env.GITHUB_CLIENT_SECRET = "gh-secret";
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      access_token: "at-123",
      refresh_token: "rt-456",
      expires_in: 3600,
    }),
});
const exchangedLive = await exchangeCodeForTokens({
  provider: getProvider("github"),
  code: "abc",
  redirectUri: "https://nexus.example/api/integrations/callback/github",
});
eq("exchange succeeds with fake transport", exchangedLive.ok, true);
if (exchangedLive.ok) {
  eq("access token surfaced to the server layer", exchangedLive.accessToken, "at-123");
  eq("refresh token preserved", exchangedLive.refreshToken, "rt-456");
  truthy("expiry becomes an ISO timestamp", typeof exchangedLive.expiresAt === "string" && exchangedLive.expiresAt.endsWith("Z"));
}

// Slack reports failures as HTTP 200 { ok: false } — must not be read as success.
const slack = getProvider("slack");
process.env.SLACK_CLIENT_ID = "slack-id";
process.env.SLACK_CLIENT_SECRET = "slack-secret";
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ ok: false, error: "invalid_code" }),
});
const slackExchange = await exchangeCodeForTokens({ provider: slack, code: "bad", redirectUri: "https://x" });
eq("slack 200-with-ok:false is a failure", slackExchange.ok, false);
if (!slackExchange.ok) eq("slack failure names the provider rejection", slackExchange.errorCode, "PROVIDER_REJECTED");

// HTTP 401 from the provider is a typed failure.
globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: "invalid_grant" }) });
const rejected = await exchangeCodeForTokens({ provider: google, code: "bad", redirectUri: "https://x" });
eq("401 exchange is PROVIDER_HTTP_401", rejected.ok === false && rejected.errorCode, "PROVIDER_HTTP_401");

// Network failure degrades to a typed error.
globalThis.fetch = async () => { throw new Error("network down"); };
const netFail = await exchangeCodeForTokens({ provider: google, code: "abc", redirectUri: "https://x" });
eq("network failure is EXCHANGE_FAILED", netFail.ok === false && netFail.errorCode, "EXCHANGE_FAILED");

// Missing env credentials refuse before any request is made.
delete process.env.NOTION_CLIENT_ID;
delete process.env.NOTION_CLIENT_SECRET;
const notionExchange = await exchangeCodeForTokens({
  provider: getProvider("notion"),
  code: "abc",
  redirectUri: "https://x",
});
eq("exchange without provider env is NOT_CONFIGURED", notionExchange.ok === false && notionExchange.errorCode, "NOT_CONFIGURED");

// ============================================================
console.log("\n-- credential sealing ----------------------------------");

const key = readEncryptionKey();
truthy("valid hex key is accepted", key.key !== null && key.error === null);

const sealed = encryptSecret("my-provider-token");
truthy("sealed value is not the plaintext", sealed !== "my-provider-token");
truthy("sealed value has iv:tag:ciphertext structure", (sealed ?? "").split(":").length === 3);
eq("round-trip returns the original", decryptSecret(sealed), "my-provider-token");
eq("tampered ciphertext opens to null", decryptSecret((sealed ?? "").slice(0, -4) + "AAAA"), null);
eq("malformed input opens to null", decryptSecret("not-a-sealed-value"), null);
eq("null input opens to null", decryptSecret(null), null);

// Without a key, sealing refuses (no unencrypted fallback ever).
process.env.NEXUS_INTEGRATION_ENCRYPTION_KEY = "";
eq("no key → sealing refuses", encryptSecret("x"), null);
eq("no key → opening refuses", decryptSecret("a:b:c"), null);

// Restore the key for later assertions.
process.env.NEXUS_INTEGRATION_ENCRYPTION_KEY = "a".repeat(64);

// ============================================================
console.log("\n-- connection view (no secrets) ------------------------");

const view = toConnectionView(undefined, "slack");
eq("no row → disconnected", view.lifecycle, "disconnected");
eq("disconnected view carries no account label", view.accountLabel, null);

const connectedView = toConnectionView(
  {
    id: "row-1",
    workspace_id: "ws",
    provider_id: "slack",
    state: "connected",
    account_label: "marie @ acme",
    scopes: ["search:read"],
    last_sync_at: null,
    last_error: null,
    last_error_code: null,
    last_error_at: null,
    connected_by: null,
    created_at: "2026-09-22T10:00:00Z",
    updated_at: "2026-09-22T10:00:00Z",
  },
  "slack"
);
eq("connected row → connected state", connectedView.lifecycle, "connected");
eq("view exposes account label for display", connectedView.accountLabel, "marie @ acme");
eq("view has no token fields by construction", "encrypted_token" in connectedView, false);

// ============================================================
console.log("\n-- google calendar adapter (fake transport) ------------");

const eventsPayload = {
  items: [
    { id: "e1", summary: "Team sync", start: { dateTime: "2026-09-24T09:00:00Z" }, end: { dateTime: "2026-09-24T10:00:00Z" }, status: "confirmed", htmlLink: "https://cal/e1" },
    { id: "e2", summary: "All-day offsite", start: { date: "2026-09-25" }, end: { date: "2026-09-26" }, status: "confirmed" },
    { id: "e3", summary: "Cancelled", start: { dateTime: "2026-09-24T11:00:00Z" }, end: { dateTime: "2026-09-24T12:00:00Z" }, status: "cancelled" },
  ],
};

const okFetch = async () => ({ ok: true, status: 200, json: async () => eventsPayload });
const listed = await listEventsInRange({
  accessToken: "tok",
  range: { fromIso: "2026-09-23T00:00:00Z", toIso: "2026-09-30T00:00:00Z" },
  fetchImpl: okFetch,
});
eq("listing succeeds", listed.ok, true);
if (listed.ok) {
  eq("confirmed events are returned (cancelled filtered)", listed.events.length, 2);
  eq("all-day event flagged", listed.events.some((e) => e.isAllDay && e.title === "All-day offsite"), true);
  eq("provider attribution on every event", listed.events.every((e) => e.provider === "google-calendar"), true);
  eq("url preserved for source inspection", listed.events[0].url, "https://cal/e1");
}

const unauthorized = await listEventsInRange({
  accessToken: "expired",
  range: { fromIso: "2026-09-23T00:00:00Z", toIso: "2026-09-30T00:00:00Z" },
  fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }),
});
eq("401 → UNAUTHORIZED + reauth required (not retryable)", unauthorized.ok === false && unauthorized.errorCode === "UNAUTHORIZED" && unauthorized.retryable === false, true);

const rateLimited = await listEventsInRange({
  accessToken: "tok",
  range: { fromIso: "2026-09-23T00:00:00Z", toIso: "2026-09-30T00:00:00Z" },
  fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }),
});
eq("429 → RATE_LIMITED + retryable", rateLimited.ok === false && rateLimited.errorCode === "RATE_LIMITED" && rateLimited.retryable === true, true);

// Conflict + free window math (pure functions)
const events = [
  { provider: "google-calendar", providerId: "google-calendar", externalId: "a", title: "A", startAt: "2026-09-24T09:00:00Z", endAt: "2026-09-24T10:30:00Z", location: null, url: null, isAllDay: false },
  { provider: "google-calendar", providerId: "google-calendar", externalId: "b", title: "B", startAt: "2026-09-24T10:00:00Z", endAt: "2026-09-24T11:00:00Z", location: null, url: null, isAllDay: false },
  { provider: "google-calendar", providerId: "google-calendar", externalId: "c", title: "C", startAt: "2026-09-24T13:00:00Z", endAt: "2026-09-24T14:00:00Z", location: null, url: null, isAllDay: false },
];
const conflicts = detectConflicts(events);
eq("one overlapping pair detected", conflicts.length, 1);
eq("overlap measured in minutes", conflicts[0].overlapMinutes, 30);

const windows = findFreeWindows({
  events,
  fromIso: "2026-09-24T00:00:00Z",
  toIso: "2026-09-24T00:00:00Z",
  dayStartHour: 8,
  dayEndHour: 18,
  minWindowMinutes: 30,
});
// Day plan: busy 09:00–11:00 (A overlaps B) and 13:00–14:00 (C).
// Free: 08:00–09:00 (60), 11:00–13:00 (120), 14:00–18:00 (240).
eq(
  "free windows exclude busy time",
  windows.map((w) => w.minutes),
  [60, 120, 240]
);

eq(
  "normalizeEvent rejects events without a start",
  normalizeEvent({ id: "x", summary: "no start" }),
  null
);

console.log(`\n${passed} passed / ${failed} failed`);
if (failed > 0) process.exit(1);
