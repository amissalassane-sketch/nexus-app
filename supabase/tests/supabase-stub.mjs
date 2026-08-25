/**
 * ============================================================
 * SUPABASE SERVICE STUB — TEST DOUBLE, NEVER USED AT RUNTIME
 * ============================================================
 * Implements the GoTrue + PostgREST endpoints that NEXUS calls, so the real
 * application code (server auth routes, proxy, server components, cookie
 * plumbing) can be exercised end-to-end without a live Supabase project.
 *
 * Only the EXTERNAL SERVICE is stubbed. No NEXUS logic and no UI data is
 * mocked: pages render their genuine empty states.
 *
 * PostgREST tables are kept in an in-memory store (seeded with the rows the
 * tests expect) so signup → onboarding → dashboard can be walked end-to-end
 * in a local sandbox preview. CORS is permissive for the same reason: the
 * browser preview may reach this stub from a different origin.
 *
 * Deterministic behaviours used by the tests:
 *   password "wrong-password"        -> invalid credentials
 *   email    unknown@...             -> invalid credentials
 *   email    existing@...  (signup)  -> user already registered
 *   email    confirm-...   (signup)  -> user created WITHOUT session
 *   expired access token             -> 401, forcing a refresh_token grant
 * ============================================================
 */

import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";

export const ONBOARDED_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "owner@nexus.test",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Owner One", username: "ownerone" },
  identities: [],
};

/**
 * A brand new email/password account. Under the access-first model the
 * signup trigger created a MINIMAL profile: no display name and no
 * username (nothing was provided at signup). The user still reaches the
 * dashboard — profile completeness is UI guidance, never a gate.
 */
export const FRESH_USER = {
  ...ONBOARDED_USER,
  id: "99999999-9999-9999-9999-999999999999",
  email: "fresh@nexus.test",
  user_metadata: {},
};

/** A returning user with a PARTIAL profile: a name was provided but the
 *  username is missing. Used to verify that an OAuth sign-in for an
 *  "existing but incomplete" account routes to /app (the dashboard),
 *  not to a form and not to the login screen. */
export const INCOMPLETE_USER = {
  ...ONBOARDED_USER,
  id: "55555555-5555-5555-5555-555555555555",
  email: "incomplete@nexus.test",
  user_metadata: { name: "Halfway Hank" },
};

export const WORKSPACE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function b64url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export function makeAccessToken(user = ONBOARDED_USER, expiresInSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({
      sub: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      session_id: "22222222-2222-2222-2222-222222222222",
      iat: now - 10,
      exp: now + expiresInSeconds,
      is_anonymous: false,
    }),
    "stub-signature",
  ].join(".");
}

export function makeSession(user = ONBOARDED_USER, expiresInSeconds = 3600) {
  return {
    access_token: makeAccessToken(user, expiresInSeconds),
    refresh_token: `stub-refresh-${user.id}`,
    token_type: "bearer",
    expires_in: expiresInSeconds,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    user,
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export function startSupabaseStub(port = 54321, host = "127.0.0.1", shared = null, serverOptions = {}) {
  const calls = [];
  const redirectTos = [];

  // In-memory PostgREST tables. Seeded with exactly the rows the tests
  // expect; writes during a preview mutate this store for the process
  // lifetime only (nothing is persisted anywhere).
  // `shared` lets several listeners (e.g. an HTTP + an HTTPS instance of
  // this stub in a sandbox preview) serve the same store.
  const tables = shared?.tables ?? {
    profiles: new Map([
      [
        ONBOARDED_USER.id,
        {
          id: ONBOARDED_USER.id,
          display_name: "Owner One",
          username: "ownerone",
          bio: null,
          job_title: null,
          avatar_url: null,
          onboarding_completed: true,
        },
      ],
      [
        // INCOMPLETE_USER: name present, username missing — a partial
        // profile under the access-first model.
        INCOMPLETE_USER.id,
        {
          id: INCOMPLETE_USER.id,
          display_name: "Halfway Hank",
          username: null,
          bio: null,
          job_title: null,
          avatar_url: null,
          onboarding_completed: false,
        },
      ],
      // FRESH_USER: just signed up — the DB trigger (migration 020) created
      // a MINIMAL profile row: no identity was provided, so nothing is
      // invented. No workspace yet (the RPC will bootstrap it).
      [
        FRESH_USER.id,
        {
          id: FRESH_USER.id,
          display_name: null,
          username: null,
          bio: null,
          job_title: null,
          avatar_url: null,
          onboarding_completed: false,
        },
      ],
    ]),
    workspace_members: new Map([
      [
        "seed-membership",
        {
          workspace_id: WORKSPACE_ID,
          user_id: ONBOARDED_USER.id,
          role: "owner",
          status: "active",
        },
      ],
    ]),
    workspaces: new Map([
      [WORKSPACE_ID, { id: WORKSPACE_ID, name: "Test Workspace", slug: "test-workspace" }],
    ]),
    // The ONBOARDED user's workspace has real content, so the e2e suite can
    // verify BOTH dashboard states: the full dashboard (data present) and
    // the first-visit welcome state (brand-new empty workspace).
    projects: new Map([
      [
        "proj-1",
        {
          id: "proj-1",
          workspace_id: WORKSPACE_ID,
          name: "Launch site",
          status: "active",
          due_date: null,
          progress: 40,
          updated_at: "2026-08-20T10:00:00.000Z",
          created_at: "2026-08-01T10:00:00.000Z",
        },
      ],
      [
        "proj-2",
        {
          id: "proj-2",
          workspace_id: WORKSPACE_ID,
          name: "Mobile app",
          status: "active",
          due_date: null,
          progress: 10,
          updated_at: "2026-08-21T10:00:00.000Z",
          created_at: "2026-08-05T10:00:00.000Z",
        },
      ],
    ]),
    tasks: new Map([
      [
        "task-1",
        {
          id: "task-1",
          workspace_id: WORKSPACE_ID,
          title: "Fix checkout bug",
          status: "in_progress",
          priority: "high",
          due_at: null,
          completed_at: null,
          project_id: "proj-1",
          updated_at: "2026-08-22T10:00:00.000Z",
          created_at: "2026-08-10T10:00:00.000Z",
        },
      ],
      [
        "task-2",
        {
          id: "task-2",
          workspace_id: WORKSPACE_ID,
          title: "Write release notes",
          status: "todo",
          priority: "medium",
          due_at: null,
          completed_at: null,
          project_id: "proj-1",
          updated_at: "2026-08-21T10:00:00.000Z",
          created_at: "2026-08-12T10:00:00.000Z",
        },
      ],
      [
        "task-3",
        {
          id: "task-3",
          workspace_id: WORKSPACE_ID,
          title: "Ship v1",
          status: "done",
          priority: "low",
          due_at: null,
          completed_at: "2026-08-18T10:00:00.000Z",
          project_id: "proj-2",
          updated_at: "2026-08-18T10:00:00.000Z",
          created_at: "2026-08-02T10:00:00.000Z",
        },
      ],
    ]),
    goals: new Map([
      [
        "goal-1",
        {
          id: "goal-1",
          workspace_id: WORKSPACE_ID,
          title: "Reach 100 customers",
          status: "active",
          progress: 25,
          target_date: null,
          updated_at: "2026-08-19T10:00:00.000Z",
          created_at: "2026-08-03T10:00:00.000Z",
        },
      ],
    ]),
    notifications: new Map(),
    workspace_subscriptions: new Map([
      [
        `sub-${WORKSPACE_ID}`,
        { workspace_id: WORKSPACE_ID, plan: "FREE", status: "active" },
      ],
    ]),
  };

  if (shared) shared.tables = tables;

  // TLS options turn this instance into an HTTPS listener (sandbox preview).
  const tlsConfigured = Boolean(serverOptions?.key && serverOptions?.cert);
  const create = tlsConfigured ? createHttpsServer : createHttpServer;

  const server = create(serverOptions, async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    calls.push(`${req.method} ${url.pathname}`);
    const redirectTo = url.searchParams.get("redirect_to");
    if (redirectTo) redirectTos.push(redirectTo);

    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
      "access-control-expose-headers": "*",
    };

    // Browser previews reach this stub cross-origin: answer preflights.
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    const json = (status, body, headers = {}) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
        ...corsHeaders,
        ...headers,
      });
      res.end(payload);
    };

    // ---------- GoTrue ----------
    // Provider simulator for sandbox previews: a real deployment would send
    // the browser to the provider (Google) here. The stub instead serves a
    // tiny "account picker" that completes the PKCE round trip against the
    // app's own /auth/callback using the deterministic test codes.
    if (url.pathname === "/auth/v1/oauth" || url.pathname === "/auth/v1/authorize") {
      const provider = url.searchParams.get("provider") ?? "google";
      const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Stub ${provider} account picker</title>
<style>body{background:#000;color:#fff;font:15px/1.5 system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center}
.box{width:340px;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:22px}
h1{font-size:16px;margin:0 0 4px}p{color:#9a9a9a;font-size:13px;margin:0 0 16px}
a{display:block;padding:11px 14px;margin-top:10px;border:1px solid rgba(255,255,255,.14);border-radius:10px;color:#fff;text-decoration:none;font-size:14px}
a:hover{background:rgba(255,255,255,.06)}</style></head>
<body><div class="box"><h1>Stub ${provider} — choose an account</h1>
<p>Test double for the preview. The production app would be talking to the real ${provider} provider here.</p>
<a data-code="oauth-new">fresh@nexus.test (brand-new account)</a>
<a data-code="oauth-incomplete">incomplete@nexus.test (name only)</a>
<a data-code="oauth-onboarded">owner@nexus.test (complete account)</a>
<script>
const base = new URLSearchParams(location.search).get("redirect_to");
document.querySelectorAll("a[data-code]").forEach((el) => {
  el.addEventListener("click", (event) => {
    event.preventDefault();
    location.href =
      (base ?? new URL("/auth/callback", location.origin).href) +
      (String(base ?? "").includes("?") ? "&" : "?") +
      "source=oauth&code=" + el.dataset.code;
  });
});
</script></div></body></html>`;
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": Buffer.byteLength(html),
        ...corsHeaders,
      });
      res.end(html);
      return;
    }

    if (url.pathname === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      const body = await readBody(req);

      if (grant === "refresh_token") {
        const user = String(body.refresh_token ?? "").includes(FRESH_USER.id)
          ? FRESH_USER
          : ONBOARDED_USER;
        return json(200, makeSession(user));
      }

      if (grant === "pkce" || grant === "authorization_code") {
        const authCode = String(body.auth_code ?? body.code ?? "");
        if (authCode === "invalid" || authCode === "") {
          return json(400, {
            error: "invalid_grant",
            error_description: "Invalid PKCE code verifier",
            message: "Invalid PKCE code verifier",
          });
        }
        // Deterministic OAuth codes map to the account state they should
        // authenticate, so the /auth/callback?source=oauth branch can be
        // exercised for every outcome (new / onboarded / incomplete).
        const user = authCode.includes("recover") || authCode.includes("oauth-onboarded")
          ? ONBOARDED_USER
          : authCode.includes("oauth-incomplete")
            ? INCOMPLETE_USER
            : FRESH_USER;
        return json(200, makeSession(user));
      }

      const email = String(body.email ?? "").toLowerCase();
      const password = String(body.password ?? "");

      if (password === "wrong-password" || email.startsWith("unknown")) {
        return json(400, {
          code: 400,
          error_code: "invalid_credentials",
          msg: "Invalid login credentials",
          message: "Invalid login credentials",
        });
      }

      if (email.startsWith("unconfirmed")) {
        return json(400, {
          code: 400,
          error_code: "email_not_confirmed",
          msg: "Email not confirmed",
          message: "Email not confirmed",
        });
      }

      const user = email.startsWith("fresh")
        ? FRESH_USER
        : email.startsWith("incomplete")
          ? INCOMPLETE_USER
          : ONBOARDED_USER;
      return json(200, makeSession(user));
    }

    if (url.pathname === "/auth/v1/signup") {
      const body = await readBody(req);
      const email = String(body.email ?? "").toLowerCase();

      if (email.startsWith("existing")) {
        return json(400, {
          code: 400,
          error_code: "user_already_exists",
          msg: "User already registered",
          message: "User already registered",
        });
      }

      // Email confirmation enabled: GoTrue returns a bare user, no session.
      if (email.startsWith("confirm-")) {
        return json(200, { ...FRESH_USER, email });
      }

      // Confirmation disabled: GoTrue returns the session at the top level.
      return json(200, { ...makeSession(FRESH_USER), user: { ...FRESH_USER, email } });
    }

    if (url.pathname === "/auth/v1/user") {
      if (req.method === "PUT" || req.method === "PATCH") {
        await readBody(req);
        return json(200, FRESH_USER);
      }

      const auth = req.headers.authorization ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      const claims = decodeJwt(token);

      if (!claims) {
        return json(401, { message: "invalid claim: missing sub claim" });
      }
      if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
        return json(401, { code: 401, error_code: "bad_jwt", msg: "token is expired" });
      }

      return json(
        200,
        claims.sub === FRESH_USER.id
          ? FRESH_USER
          : claims.sub === INCOMPLETE_USER.id
            ? INCOMPLETE_USER
            : ONBOARDED_USER
      );
    }

    if (url.pathname === "/auth/v1/logout") {
      res.writeHead(204).end();
      return;
    }

    if (url.pathname === "/auth/v1/recover") {
      await readBody(req);
      return json(200, {});
    }

    // Resend confirmation / verification email. Mirrors the real GoTrue
    // behaviour: always returns 200 with an empty body, revealing nothing
    // about whether the address is registered.
    if (url.pathname === "/auth/v1/resend") {
      await readBody(req);
      return json(200, {});
    }

    if (url.pathname === "/auth/v1/verify") {
      const body = await readBody(req);
      const type = String(body.type ?? "");
      const tokenHash = String(body.token_hash ?? "");

      // Deterministic confirmation-link outcomes so the NEXUS /auth/confirm
      // route can be exercised end-to-end for every state.
      if (tokenHash === "expired") {
        return json(400, {
          code: 400,
          error_code: "otp_expired",
          msg: "OTP has expired",
          message: "OTP has expired",
        });
      }
      if (tokenHash === "invalid") {
        return json(400, {
          code: 400,
          error_code: "otp_invalid",
          msg: "OTP token is invalid",
          message: "OTP token is invalid",
        });
      }

      const user =
        type === "recovery" || tokenHash.includes("onboarded")
          ? ONBOARDED_USER
          : tokenHash.includes("incomplete")
            ? INCOMPLETE_USER
            : FRESH_USER;
      return json(200, makeSession(user));
    }

    if (url.pathname === "/auth/v1/.well-known/jwks.json") {
      return json(200, { keys: [] });
    }

    // ---------- PostgREST ----------
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const rpcName = url.pathname.replace("/rest/v1/rpc/", "");
      const auth = req.headers.authorization ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      const claims = decodeJwt(token);
      const userId = claims?.sub ?? null;

      // get_or_create_personal_workspace: idempotent bootstrap RPC
      // added in migration 016. Mimics the security-definer DB function:
      // returns the user's workspace_id, role, status — creating the
      // workspace + owner membership if they don't already exist.
      if (rpcName === "get_or_create_personal_workspace") {
        await readBody(req);
        if (!userId) {
          return json(401, { message: "AUTH_REQUIRED" });
        }
        // Find an existing active membership for this user.
        let membership = [...tables.workspace_members.values()].find(
          (m) => m.user_id === userId && m.status === "active"
        );
        // Orphan-repair: if the user owns a workspace with no membership,
        // claim it as owner.
        if (!membership) {
          const owned = [...tables.workspaces.values()].find(
            (w) => w.owner_id === userId
          );
          if (owned) {
            membership = {
              workspace_id: owned.id,
              user_id: userId,
              role: "owner",
              status: "active",
            };
            tables.workspace_members.set(`${owned.id}:${userId}`, membership);
          }
        }
        // Nothing yet: create the personal workspace.
        if (!membership) {
          const newId = crypto.randomUUID();
          tables.workspaces.set(newId, {
            id: newId,
            owner_id: userId,
            name: "My Workspace",
            slug: `workspace-${newId.slice(0, 8)}`,
          });
          membership = {
            workspace_id: newId,
            user_id: userId,
            role: "owner",
            status: "active",
          };
          tables.workspace_members.set(`${newId}:${userId}`, membership);
          tables.workspace_subscriptions.set(`sub-${newId}`, {
            workspace_id: newId,
            plan: "FREE",
            status: "active",
          });
        }
        return json(200, {
          workspace_id: membership.workspace_id,
          role: membership.role,
          status: membership.status,
        });
      }

      return json(200, null);
    }

    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.replace("/rest/v1/", "");
      const store = tables[table] ?? new Map();
      const accept = req.headers.accept ?? "";
      const wantsObject = accept.includes("vnd.pgrst.object");

      // Minimal PostgREST filter support: eq., is.null and in.(...) on the
      // query columns NEXUS actually filters by. select/order/limit/offset
      // are ignored — rows come back whole.
      const filters = [];
      for (const [key, raw] of url.searchParams) {
        if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) continue;
        if (raw === "is.null") {
          filters.push((row) => row[key] == null);
        } else if (raw.startsWith("eq.")) {
          const expected = raw.slice(3);
          filters.push((row) => String(row[key]) === expected);
        } else if (raw.startsWith("in.(")) {
          const allowed = raw.slice(4, -1).split(",");
          filters.push((row) => allowed.includes(String(row[key])));
        }
      }
      const rows = [...store.values()].filter((row) => filters.every((f) => f(row)));

      if (req.method === "HEAD") {
        res.writeHead(200, { "content-range": `*/${rows.length}`, ...corsHeaders }).end();
        return;
      }

      const notFound = () =>
        json(406, {
          code: "PGRST116",
          details: "Results contain 0 rows",
          message: "JSON object requested, multiple (or no) rows returned",
        });

      if (req.method === "GET") {
        if (wantsObject) {
          return rows.length === 1 ? json(200, rows[0]) : notFound();
        }
        return json(200, rows, { "content-range": `*/${rows.length}` });
      }

      // Writes (profile upsert during onboarding, workspace creation...).
      // Upsert semantics keep the onboarding flow idempotent — a retried
      // insert with the same client-generated id never duplicates a row.
      const body = await readBody(req);
      const incoming = Array.isArray(body) ? body : [body];
      const written = incoming.map((row) => {
        const next = { ...row };
        let key = typeof next.id === "string" ? next.id : null;
        if (table === "workspace_members" && !key && next.workspace_id && next.user_id) {
          key = `${next.workspace_id}:${next.user_id}`;
        }
        if (!key) {
          key = crypto.randomUUID();
          if (table !== "workspace_members") next.id = key;
        }
        store.set(key, next);
        return next;
      });

      if (wantsObject) return json(200, written[0]);
      return json(200, written);
    }

    return json(404, { message: "stub: not found" });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () =>
      resolve({
        url: `http://${host}:${port}`,
        calls,
        redirectTos,
        close: () => new Promise((done) => server.close(done)),
      })
    );
  });
}
