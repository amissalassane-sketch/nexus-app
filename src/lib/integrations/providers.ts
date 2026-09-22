// ============================================================
// NEXUS INTEGRATIONS — PROVIDER REGISTRY & CAPABILITY MODEL
// ============================================================
// One declaration per external provider: OAuth wiring, the minimum
// scopes NEXUS asks for, and the capability model (what the connector
// can do once connected).
//
// REALITY RULES (tested in supabase/tests/integrations-contract.test.mjs):
//   * A capability is only listed as `adapter: "implemented"` when a
//     server-side adapter exists in this repository.
//   * `adapter: "planned"` is the honest state for everything the
//     platform will do but does not do yet.
//   * `connectionState` values come from the database
//     (integration_connections.state), never from this file.
//   * A provider is `available: false` until its OAuth client is
//     configured in the environment — and the UI says exactly which
//     variables are missing.
// ============================================================

export type ProviderId =
  | "gmail"
  | "google-calendar"
  | "slack"
  | "notion"
  | "github"
  | "linear"
  | "google-drive"
  | "outlook"
  | "teams"
  | "jira";

export type CapabilityVerb =
  | "read"
  | "search"
  | "create"
  | "update"
  | "delete"
  | "sync"
  | "events";

export type CapabilityAdapterStatus = "implemented" | "planned";

export type IntegrationCapability = {
  id: string;
  label: string;
  verb: CapabilityVerb;
  /** Only "implemented" when a server-side adapter exists here. */
  adapter: CapabilityAdapterStatus;
  /** Writing to the external provider always requires confirmation. */
  requiresConfirmation?: boolean;
};

export type OAuthFlow = {
  authorizationUrl: string;
  tokenUrl: string;
  /** Minimum scopes — every entry must be justified in `scopeNotes`. */
  scopes: string[];
  scopeNotes: Record<string, string>;
  /** Env vars holding the OAuth client credentials. */
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Extra query params some providers require. */
  extraAuthorizeParams?: Record<string, string>;
  /** Providers that return token errors as HTTP 200 (Slack). */
  tokenErrorInBody?: boolean;
  /** Notion returns a different content type on the token endpoint. */
  tokenAcceptHeader?: string;
  /** Where the access token lives in the token response body. */
  accessTokenPath?: "access_token";
};

export type ProviderDefinition = {
  id: ProviderId;
  name: string;
  category: "communication" | "calendar" | "documents" | "development" | "files";
  categoryLabel: string;
  description: string;
  /** Product phase (mission P1 = 1..6, P2 = 7..10). */
  phase: 1 | 2;
  oauth: OAuthFlow;
  capabilities: IntegrationCapability[];
  /**
   * What NEXUS gains when this source exists: new context, new
   * actions, new signals, new missions. If a provider cannot answer
   * these, it is not worth connecting.
   */
  value: {
    context: string;
    actions: string;
    signals: string;
  };
};

export const PROVIDERS: ProviderDefinition[] = [
  // ------------------------------------------------------ GMAIL
  {
    id: "gmail",
    name: "Gmail",
    category: "communication",
    categoryLabel: "Communication",
    description:
      "Read the conversations that carry commitments, and answer them without leaving NEXUS.",
    phase: 1,
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
      ],
      scopeNotes: {
        "https://www.googleapis.com/auth/gmail.readonly":
          "Search and read messages — the core recovery context.",
        "https://www.googleapis.com/auth/gmail.send":
          "Send replies, only after explicit confirmation.",
        "https://www.googleapis.com/auth/gmail.modify":
          "Archive and label after confirmation; never delete.",
      },
      clientIdEnv: "GOOGLE_CLIENT_ID",
      clientSecretEnv: "GOOGLE_CLIENT_SECRET",
      extraAuthorizeParams: {
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      },
    },
    capabilities: [
      { id: "gmail-search", label: "Search emails", verb: "search", adapter: "planned" },
      { id: "gmail-read", label: "Read email & threads", verb: "read", adapter: "planned" },
      { id: "gmail-commitments", label: "Extract commitments", verb: "read", adapter: "planned" },
      { id: "gmail-draft", label: "Draft reply", verb: "create", adapter: "planned" },
      {
        id: "gmail-send",
        label: "Send reply",
        verb: "create",
        adapter: "planned",
        requiresConfirmation: true,
      },
      {
        id: "gmail-archive",
        label: "Archive / label",
        verb: "update",
        adapter: "planned",
        requiresConfirmation: true,
      },
    ],
    value: {
      context: "Messages, threads and the commitments inside them.",
      actions: "Draft and (after confirmation) send replies, archive.",
      signals: "Unanswered important email, commitment detected, deadline in a thread.",
    },
  },
  // ---------------------------------------------- GOOGLE CALENDAR
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    categoryLabel: "Calendar",
    description:
      "Bring real meetings into NEXUS time, and let Intelligence schedule around them.",
    phase: 1,
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: [
        "https://www.googleapis.com/auth/calendar.readonly",
      ],
      scopeNotes: {
        "https://www.googleapis.com/auth/calendar.readonly":
          "List events and detect conflicts — the core time context.",
        "https://www.googleapis.com/auth/calendar.events":
          "Create, move and update events, only after confirmation.",
      },
      clientIdEnv: "GOOGLE_CLIENT_ID",
      clientSecretEnv: "GOOGLE_CLIENT_SECRET",
      extraAuthorizeParams: {
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      },
    },
    capabilities: [
      { id: "gcal-list", label: "List events", verb: "read", adapter: "implemented" },
      { id: "gcal-search", label: "Search events", verb: "search", adapter: "planned" },
      { id: "gcal-conflicts", label: "Detect conflicts", verb: "read", adapter: "implemented" },
      { id: "gcal-availability", label: "Find free time", verb: "read", adapter: "implemented" },
      {
        id: "gcal-create",
        label: "Create event",
        verb: "create",
        adapter: "planned",
        requiresConfirmation: true,
      },
      {
        id: "gcal-move",
        label: "Move / update event",
        verb: "update",
        adapter: "planned",
        requiresConfirmation: true,
      },
      {
        id: "gcal-timeblock",
        label: "Time-block NEXUS tasks",
        verb: "create",
        adapter: "planned",
        requiresConfirmation: true,
      },
    ],
    value: {
      context: "Meetings, availability and the real shape of the day.",
      actions: "Create and move events, time-block tasks (after confirmation).",
      signals: "Meeting without preparation, calendar conflict, deadline colliding with a meeting.",
    },
  },
  // ------------------------------------------------------- SLACK
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    categoryLabel: "Communication",
    description:
      "Find the decisions and requests buried in channels, and answer them from NEXUS.",
    phase: 1,
    oauth: {
      authorizationUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      scopes: [
        "channels:history",
        "groups:history",
        "im:history",
        "mpim:history",
        "users:read",
      ],
      scopeNotes: {
        "search:read": "Search across messages — recovery context.",
        "channels:history": "Read channel threads the workspace is in.",
        "groups:history": "Read private-group threads (must already be a member).",
        "im:history": "Read direct-message threads with the connected user.",
        "mpim:history": "Read group direct messages.",
        "users:read": "Resolve user ids to names so sources read like people.",
        "chat:write": "Post a reply, only after explicit confirmation.",
      },
      clientIdEnv: "SLACK_CLIENT_ID",
      clientSecretEnv: "SLACK_CLIENT_SECRET",
      tokenErrorInBody: true,
      accessTokenPath: "access_token",
    },
    capabilities: [
      { id: "slack-search", label: "Search messages", verb: "search", adapter: "planned" },
      { id: "slack-read", label: "Read threads", verb: "read", adapter: "planned" },
      { id: "slack-decisions", label: "Extract decisions", verb: "read", adapter: "planned" },
      {
        id: "slack-post",
        label: "Post reply",
        verb: "create",
        adapter: "planned",
        requiresConfirmation: true,
      },
    ],
    value: {
      context: "Discussions, decisions and mentions involving your projects.",
      actions: "Draft and (after confirmation) post replies.",
      signals: "Commitment detected in a thread, unanswered mention.",
    },
  },
  // ------------------------------------------------------ NOTION
  {
    id: "notion",
    name: "Notion",
    category: "documents",
    categoryLabel: "Documents",
    description:
      "Read the written project context, and connect documents to the work they explain.",
    phase: 1,
    oauth: {
      authorizationUrl: "https://api.notion.com/v1/oauth/authorize",
      tokenUrl: "https://api.notion.com/v1/oauth/token",
      scopes: ["read_content"],
      scopeNotes: {
        read_content: "Search and read pages shared with the integration.",
        insert_content: "Create pages, only after confirmation.",
        update_content: "Append to existing pages, only after confirmation.",
      },
      clientIdEnv: "NOTION_CLIENT_ID",
      clientSecretEnv: "NOTION_CLIENT_SECRET",
      tokenAcceptHeader: "application/json",
    },
    capabilities: [
      { id: "notion-search", label: "Search pages", verb: "search", adapter: "planned" },
      { id: "notion-read", label: "Read documents", verb: "read", adapter: "planned" },
      {
        id: "notion-create",
        label: "Create / update pages",
        verb: "create",
        adapter: "planned",
        requiresConfirmation: true,
      },
    ],
    value: {
      context: "Written project knowledge attached to real work.",
      actions: "Create or append pages (after confirmation).",
      signals: "Document changed on an active project.",
    },
  },
  // ------------------------------------------------------ GITHUB
  {
    id: "github",
    name: "GitHub",
    category: "development",
    categoryLabel: "Development",
    description:
      "Issues, pull requests and reviews — the technical work behind your projects.",
    phase: 1,
    oauth: {
      authorizationUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      scopes: ["repo", "read:user", "notifications"],
      scopeNotes: {
        repo:
          "Broad repository access, including write permissions at GitHub. No NEXUS data adapter is implemented; review this grant carefully.",
        "read:user": "Identify the connected account.",
        notifications: "Detect PRs and issues waiting on you.",
      },
      clientIdEnv: "GITHUB_CLIENT_ID",
      clientSecretEnv: "GITHUB_CLIENT_SECRET",
      tokenAcceptHeader: "application/json",
    },
    capabilities: [
      { id: "github-repos", label: "List repositories", verb: "read", adapter: "planned" },
      { id: "github-issues", label: "Read issues", verb: "read", adapter: "planned" },
      { id: "github-prs", label: "Read pull requests & reviews", verb: "read", adapter: "planned" },
      { id: "github-notifications", label: "Read notifications", verb: "read", adapter: "planned" },
      {
        id: "github-comment",
        label: "Comment",
        verb: "create",
        adapter: "planned",
        requiresConfirmation: true,
      },
    ],
    value: {
      context: "Issues, PRs, reviews and commits connected to projects.",
      actions: "Comment on issues and PRs (after confirmation).",
      signals: "PR waiting on your review, issue assigned to you.",
    },
  },
  // ------------------------------------------------------ LINEAR
  {
    id: "linear",
    name: "Linear",
    category: "development",
    categoryLabel: "Development",
    description: "Issues, cycles and assignments for teams that plan work in Linear.",
    phase: 1,
    oauth: {
      authorizationUrl: "https://linear.app/oauth/authorize",
      tokenUrl: "https://api.linear.app/oauth/token",
      scopes: ["read"],
      scopeNotes: { read: "Read issues, projects and comments accessible to the authorized account." },
      clientIdEnv: "LINEAR_CLIENT_ID",
      clientSecretEnv: "LINEAR_CLIENT_SECRET",
      tokenAcceptHeader: "application/json",
    },
    capabilities: [
      { id: "linear-issues", label: "Read issues", verb: "read", adapter: "planned" },
      { id: "linear-projects", label: "Read projects & cycles", verb: "read", adapter: "planned" },
      { id: "linear-comments", label: "Read comments", verb: "read", adapter: "planned" },
      {
        id: "linear-update",
        label: "Update status / priority",
        verb: "update",
        adapter: "planned",
        requiresConfirmation: true,
      },
      {
        id: "linear-comment",
        label: "Comment",
        verb: "create",
        adapter: "planned",
        requiresConfirmation: true,
      },
    ],
    value: {
      context: "External issues, cycles and assignments.",
      actions: "Update issues and comment (after confirmation).",
      signals: "Issue waiting on you, cycle risk.",
    },
  },
  // -------------------------------------------------- P2 PROVIDERS
  {
    id: "google-drive",
    name: "Google Drive",
    category: "files",
    categoryLabel: "Files",
    description: "Reference the files your projects actually use.",
    phase: 2,
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: [
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      scopeNotes: {
        "https://www.googleapis.com/auth/drive.metadata.readonly":
          "List and search file metadata.",
        "https://www.googleapis.com/auth/drive.readonly": "Download shared files on demand.",
      },
      clientIdEnv: "GOOGLE_CLIENT_ID",
      clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    },
    capabilities: [
      { id: "drive-list", label: "List / search files", verb: "search", adapter: "planned" },
      { id: "drive-read", label: "Read file metadata", verb: "read", adapter: "planned" },
    ],
    value: {
      context: "Files attached to projects and tasks.",
      actions: "Reference and open files.",
      signals: "File changed on an active project.",
    },
  },
  {
    id: "outlook",
    name: "Microsoft Outlook",
    category: "communication",
    categoryLabel: "Communication",
    description: "Email and calendar for teams on Microsoft 365.",
    phase: 2,
    oauth: {
      authorizationUrl:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      scopes: [
        "offline_access",
        "https://graph.microsoft.com/Mail.Read",
        "https://graph.microsoft.com/Calendars.Read",
      ],
      scopeNotes: {
        offline_access: "Keep the connection working between visits.",
        "https://graph.microsoft.com/Mail.Read": "Read messages.",
        "https://graph.microsoft.com/Calendars.Read": "Read calendar events.",
      },
      clientIdEnv: "OUTLOOK_CLIENT_ID",
      clientSecretEnv: "OUTLOOK_CLIENT_SECRET",
    },
    capabilities: [
      { id: "outlook-mail", label: "Read / search email", verb: "search", adapter: "planned" },
      { id: "outlook-calendar", label: "Read calendar", verb: "read", adapter: "planned" },
    ],
    value: {
      context: "Email and calendar context for Microsoft 365 work.",
      actions: "Planned.",
      signals: "Planned.",
    },
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    category: "communication",
    categoryLabel: "Communication",
    description: "Discussions and meetings for teams on Microsoft 365.",
    phase: 2,
    oauth: {
      authorizationUrl:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      scopes: ["offline_access", "https://graph.microsoft.com/ChannelMessage.Read.All"],
      scopeNotes: {
        offline_access: "Keep the connection working between visits.",
        "https://graph.microsoft.com/ChannelMessage.Read.All":
          "Read channel messages the account can already access.",
      },
      clientIdEnv: "TEAMS_CLIENT_ID",
      clientSecretEnv: "TEAMS_CLIENT_SECRET",
    },
    capabilities: [
      { id: "teams-read", label: "Read channel messages", verb: "read", adapter: "planned" },
    ],
    value: {
      context: "Team discussions.",
      actions: "Planned.",
      signals: "Planned.",
    },
  },
  {
    id: "jira",
    name: "Jira",
    category: "development",
    categoryLabel: "Development",
    description: "Issues and sprints for teams operating in Jira.",
    phase: 2,
    oauth: {
      authorizationUrl: "https://auth.atlassian.com/authorize",
      tokenUrl: "https://auth.atlassian.com/oauth/token",
      scopes: ["read:jira-user", "read:jira-work", "write:jira-work"],
      scopeNotes: {
        "read:jira-user": "Identify the connected account.",
        "read:jira-work": "Read issues and projects the account can access.",
        "write:jira-work": "Update issues, only after confirmation.",
      },
      clientIdEnv: "JIRA_CLIENT_ID",
      clientSecretEnv: "JIRA_CLIENT_SECRET",
      extraAuthorizeParams: {
        audience: "api.atlassian.com",
        prompt: "consent",
      },
    },
    capabilities: [
      { id: "jira-issues", label: "Read issues", verb: "read", adapter: "planned" },
      { id: "jira-search", label: "Search issues (JQL)", verb: "search", adapter: "planned" },
      {
        id: "jira-update",
        label: "Update issue",
        verb: "update",
        adapter: "planned",
        requiresConfirmation: true,
      },
    ],
    value: {
      context: "Issues and sprints.",
      actions: "Update issues (after confirmation).",
      signals: "Issue waiting on you.",
    },
  },
];

export function getProvider(id: string): ProviderDefinition | null {
  return PROVIDERS.find((provider) => provider.id === id) ?? null;
}

// ------------------------------------------------------------
// Environment configuration (server-side truth)
// ------------------------------------------------------------

export type ProviderConfiguration =
  | {
      configured: true;
      clientId: string;
      clientSecret: string;
    }
  | {
      configured: false;
      missing: string[];
    };

export function getProviderConfiguration(
  provider: ProviderDefinition
): ProviderConfiguration {
  const clientId = process.env[provider.oauth.clientIdEnv]?.trim();
  const clientSecret = process.env[provider.oauth.clientSecretEnv]?.trim();

  const missing: string[] = [];
  if (!clientId) missing.push(provider.oauth.clientIdEnv);
  if (!clientSecret) missing.push(provider.oauth.clientSecretEnv);

  if (missing.length > 0 || !clientId || !clientSecret) {
    return { configured: false, missing };
  }

  return { configured: true, clientId, clientSecret };
}

/** True when at least one provider's OAuth client is configured. */
export function anyProviderConfigured(): boolean {
  return PROVIDERS.some((provider) => getProviderConfiguration(provider).configured);
}

/** Env variables an operator must set to turn on each provider. */
export function missingConfigurationFor(provider: ProviderDefinition): string[] {
  const configuration = getProviderConfiguration(provider);
  return configuration.configured ? [] : configuration.missing;
}

// ------------------------------------------------------------
// Connection states (mirrors the DB enum, plus the pre-DB states)
// ------------------------------------------------------------

export type ConnectionLifecycleState =
  | "disconnected" // no row in integration_connections
  | "connecting" // OAuth handshake in flight
  | "connected"
  | "syncing"
  | "stale"
  | "error"
  | "reauth_required";

export const CONNECTION_STATE_LABEL: Record<ConnectionLifecycleState, string> = {
  disconnected: "Not connected",
  connecting: "Connecting",
  connected: "Connected",
  syncing: "Syncing",
  stale: "Connection stale",
  error: "Connection error",
  reauth_required: "Reconnection required",
};

/** Human explanation for each state — used by UI and tests alike. */
export const CONNECTION_STATE_DESCRIPTION: Record<ConnectionLifecycleState, string> = {
  disconnected: "No account is connected. Connect to bring this source into NEXUS.",
  connecting: "The provider handshake is in progress.",
  connected: "OAuth credentials saved. Data access and Intelligence support must be verified separately.",
  syncing: "Fetching the latest data from the provider.",
  stale: "The last complete sync is old or incomplete. Run a sync to verify access.",
  error: "The last sync failed. Check the error and retry.",
  reauth_required:
    "The provider rejected the stored token. Reconnect to restore access.",
};

export function isConnectionLifecycleState(
  value: unknown
): value is ConnectionLifecycleState {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CONNECTION_STATE_LABEL, value)
  );
}

// ------------------------------------------------------------
// OAuth URL construction
// ------------------------------------------------------------

export type AuthorizeUrlResult =
  | { url: string; state: string }
  | { error: "NOT_CONFIGURED"; missing: string[] };

/**
 * Build the provider authorization URL. `state` is the CSRF token the
 * callback route must echo back before any token is exchanged.
 */
export function buildAuthorizeUrl(options: {
  provider: ProviderDefinition;
  redirectUri: string;
  state: string;
}): AuthorizeUrlResult {
  const configuration = getProviderConfiguration(options.provider);
  if (!configuration.configured) {
    return { error: "NOT_CONFIGURED", missing: configuration.missing };
  }

  const url = new URL(options.provider.oauth.authorizationUrl);
  url.searchParams.set("client_id", configuration.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  // Notion capabilities are configured in its developer console, not URL scopes.
  if (options.provider.id === "notion") url.searchParams.set("owner", "user");
  else url.searchParams.set("scope", options.provider.oauth.scopes.join(
    ["linear", "slack"].includes(options.provider.id) ? "," : " "
  ));
  url.searchParams.set("state", options.state);

  for (const [key, value] of Object.entries(
    options.provider.oauth.extraAuthorizeParams ?? {}
  )) {
    url.searchParams.set(key, value);
  }

  return { url: url.toString(), state: options.state };
}

export function callbackPathFor(providerId: ProviderId): string {
  return `/api/integrations/callback/${providerId}`;
}
