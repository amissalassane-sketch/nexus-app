/**
 * ============================================================
 * SUPABASE SERVICE STUB — TEST DOUBLE, NEVER USED AT RUNTIME
 * ============================================================
 * Implements the handful of GoTrue / PostgREST endpoints that the NEXUS
 * auth pipeline calls, so the *real* application code (browser client,
 * server client, proxy, /api/auth/session, server components) can be
 * exercised end-to-end without a live Supabase project.
 *
 * This stubs the EXTERNAL SERVICE only. No application logic, no UI data
 * and no business rule is mocked here.
 * ============================================================
 */

import { createServer } from "node:http";

const USER = {
  id: "11111111-1111-1111-1111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "owner@nexus.test",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  phone: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Owner One", username: "ownerone" },
  identities: [],
};

function base64url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function makeAccessToken(expiresInSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const payload = base64url({
    sub: USER.id,
    aud: "authenticated",
    role: "authenticated",
    email: USER.email,
    session_id: "22222222-2222-2222-2222-222222222222",
    iat: now,
    exp: now + expiresInSeconds,
    is_anonymous: false,
  });
  return `${header}.${payload}.stub-signature`;
}

export function makeSession(expiresInSeconds = 3600) {
  const accessToken = makeAccessToken(expiresInSeconds);
  return {
    access_token: accessToken,
    refresh_token: "stub-refresh-token",
    token_type: "bearer",
    expires_in: expiresInSeconds,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    user: USER,
  };
}

export function startSupabaseStub(port = 54321) {
  const calls = [];

  const server = createServer((req, res) => {
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

    // ---- GoTrue ------------------------------------------------
    if (url.pathname === "/auth/v1/token") {
      return json(200, makeSession());
    }

    if (url.pathname === "/auth/v1/signup") {
      return json(200, { ...USER, session: makeSession() });
    }

    if (url.pathname === "/auth/v1/user") {
      const auth = req.headers.authorization ?? "";
      if (!auth.startsWith("Bearer ") || auth.length < 20) {
        return json(401, { message: "invalid claim: missing sub claim" });
      }
      return json(200, USER);
    }

    if (url.pathname === "/auth/v1/logout") {
      res.writeHead(204).end();
      return;
    }

    if (url.pathname === "/auth/v1/.well-known/jwks.json") {
      return json(200, { keys: [] });
    }

    // ---- PostgREST ---------------------------------------------
    // Empty dataset: the point of this harness is the auth pipeline,
    // not the data. Pages must render their real empty states.
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      return json(200, null);
    }

    if (url.pathname.startsWith("/rest/v1/")) {
      const accept = req.headers.accept ?? "";
      if (req.method === "HEAD") {
        res.writeHead(200, { "content-range": "*/0" }).end();
        return;
      }
      if (accept.includes("vnd.pgrst.object")) {
        // PostgREST answers 406 when .single()/.maybeSingle() matches 0 rows;
        // supabase-js turns that into { data: null, error: null }.
        return json(406, {
          code: "PGRST116",
          details: "Results contain 0 rows",
          message: "JSON object requested, multiple (or no) rows returned",
        });
      }
      return json(200, [], { "content-range": "*/0" });
    }

    return json(404, { message: "stub: not found" });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () =>
      resolve({
        url: `http://127.0.0.1:${port}`,
        calls,
        close: () => new Promise((done) => server.close(done)),
      })
    );
  });
}
