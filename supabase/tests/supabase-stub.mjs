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
 * Deterministic behaviours used by the tests:
 *   password "wrong-password"        -> invalid credentials
 *   email    unknown@...             -> invalid credentials
 *   email    existing@...  (signup)  -> user already registered
 *   email    confirm-...   (signup)  -> user created WITHOUT session
 *   expired access token             -> 401, forcing a refresh_token grant
 * ============================================================
 */

import { createServer } from "node:http";

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

export function startSupabaseStub(port = 54321) {
  const calls = [];

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    calls.push(`${req.method} ${url.pathname}`);

    const json = (status, body, headers = {}) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
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

    if (url.pathname === "/auth/v1/.well-known/jwks.json") {
      return json(200, { keys: [] });
    }

    // ---------- PostgREST ----------
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      return json(200, null);
    }

    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.replace("/rest/v1/", "");
      const accept = req.headers.accept ?? "";
      const wantsObject = accept.includes("vnd.pgrst.object");
      const idFilter = (url.searchParams.get("id") ?? "").replace("eq.", "");

      if (req.method === "HEAD") {
        res.writeHead(200, { "content-range": "*/0" }).end();
        return;
      }

      const notFound = () =>
        json(406, {
          code: "PGRST116",
          details: "Results contain 0 rows",
          message: "JSON object requested, multiple (or no) rows returned",
        });

      if (req.method === "GET") {
        const rows = [];

        if (table === "profiles") {
          // The brand new account has no profile row yet.
          if (idFilter !== FRESH_USER.id) {
            rows.push({
              id: ONBOARDED_USER.id,
              display_name: "Owner One",
              username: "ownerone",
              bio: null,
              onboarding_completed: true,
            });
          }
        } else if (table === "workspace_members") {
          rows.push({ workspace_id: WORKSPACE_ID, role: "owner", status: "active" });
        } else if (table === "workspaces") {
          rows.push({ id: WORKSPACE_ID, name: "Test Workspace", slug: "test-workspace" });
        }

        if (wantsObject) {
          return rows.length === 1 ? json(200, rows[0]) : notFound();
        }
        return json(200, rows, { "content-range": `*/${rows.length}` });
      }

      // Writes (profile upsert during onboarding, workspace creation...)
      const body = await readBody(req);
      return json(200, Array.isArray(body) ? body : [body]);
    }

    return json(404, { message: "stub: not found" });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () =>
      resolve({
        url: `http://127.0.0.1:${port}`,
        calls,
        close: () => new Promise((done) => server.close(done)),
      })
    );
  });
}
