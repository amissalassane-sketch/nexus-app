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

/** A brand new account: no profile row yet, so onboarding must kick in. */
export const FRESH_USER = {
  ...ONBOARDED_USER,
  id: "99999999-9999-9999-9999-999999999999",
  email: "fresh@nexus.test",
  user_metadata: { full_name: "Fresh User", username: "freshuser" },
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
          onboarding_completed: true,
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
    projects: new Map(),
    tasks: new Map(),
    goals: new Map(),
    notifications: new Map(),
    workspace_subscriptions: new Map(),
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
        const user = authCode.includes("recover") ? ONBOARDED_USER : FRESH_USER;
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

      const user = email.startsWith("fresh") ? FRESH_USER : ONBOARDED_USER;
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

      return json(200, claims.sub === FRESH_USER.id ? FRESH_USER : ONBOARDED_USER);
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
      const user = String(body.type ?? "") === "recovery" ? ONBOARDED_USER : FRESH_USER;
      return json(200, makeSession(user));
    }

    if (url.pathname === "/auth/v1/.well-known/jwks.json") {
      return json(200, { keys: [] });
    }

    // ---------- PostgREST ----------
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
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
