// Hermetic only: fixture credentials and injected transport; NEVER a live connection.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const { PROVIDERS, getProvider, isConnectionLifecycleState } = await import('../../src/lib/integrations/providers.ts');
const { beginConnect, exchangeCodeForTokens, recordSyncRun, readConnections, readCredential, persistConnection, disconnectConnection, credentialBinding, toConnectionView } = await import('../../src/lib/integrations/connections.ts');
const { createOAuthAttempt, validateOAuthAttempt } = await import('../../src/lib/integrations/oauth-state.ts');
const { encryptSecret, decryptSecret } = await import('../../src/lib/integrations/crypto.ts');
const { listEventsInRange, findFreeWindows, detectConflicts } = await import('../../src/lib/integrations/adapters/google-calendar.ts');

process.env.NEXUS_INTEGRATION_ENCRYPTION_KEY = 'c'.repeat(64);
for (const p of PROVIDERS) {
  process.env[p.oauth.clientIdEnv] = 'fixture-client';
  process.env[p.oauth.clientSecretEnv] = 'fixture-secret';
}
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const hangingFetch = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('fixture timeout', 'AbortError')), { once: true }));

for (const provider of PROVIDERS) {
  test(`${provider.id}: OAuth start/callback contract, identity binding, timeout and rejection (mock)`, async () => {
    const start = beginConnect({ providerId: provider.id, origin: 'https://nexus.example' });
    assert.ok(start.url);
    const redirectUri = new URL(start.url).searchParams.get('redirect_uri');
    const expected = { state: start.state, providerId: provider.id, userId: 'fixture-user', workspaceId: 'fixture-workspace', redirectUri };
    const { cookie, codeChallenge } = createOAuthAttempt(expected, true, 1_000);
    const valid = validateOAuthAttempt(cookie, expected, 1_001);
    assert.ok(valid?.codeVerifier);
    assert.ok(codeChallenge);
    for (const key of ['state', 'providerId', 'userId', 'workspaceId', 'redirectUri']) {
      assert.equal(validateOAuthAttempt(cookie, { ...expected, [key]: 'other' }, 1_001), null, key);
    }
    assert.equal(validateOAuthAttempt(undefined, expected, 1_001), null);
    assert.equal(validateOAuthAttempt(cookie + 'tamper', expected, 1_001), null);
    assert.equal(validateOAuthAttempt(cookie, expected, 602_000), null);
    const base = { provider, code: 'fixture-code', redirectUri, codeVerifier: valid.codeVerifier };
    const success = await exchangeCodeForTokens({ ...base, fetchImpl: async (_url, init) => {
      assert.equal(init.redirect, 'error');
      if (provider.id === 'notion') {
        assert.match(init.headers.authorization, /^Basic /);
        assert.equal(JSON.parse(init.body).code, base.code);
        assert.ok(!init.body.includes('fixture-secret'));
      } else assert.equal(init.body.get('code_verifier'), valid.codeVerifier);
      return response({ ok: true, access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600, scope: 'read,metadata' });
    } });
    assert.equal(success.ok, true);
    assert.deepEqual(success.grantedScopes, ['read', 'metadata']);
    assert.equal(success.refreshToken, 'fixture-refresh'); // storage, NOT refresh execution
    assert.ok(Date.parse(success.expiresAt) > Date.now());
    const noScopes = await exchangeCodeForTokens({ ...base, fetchImpl: async () => response({ access_token: 'fixture-access' }) });
    assert.deepEqual(noScopes.grantedScopes, []);
    for (const status of [400, 401, 403, 429, 500]) {
      const result = await exchangeCodeForTokens({ ...base, fetchImpl: async () => response({ error_description: 'SENSITIVE fixture-secret' }, status) });
      assert.equal(result.ok, false);
      assert.equal(result.errorCode, `PROVIDER_HTTP_${status}`);
      assert.ok(!result.message.includes('SENSITIVE'));
    }
    assert.equal((await exchangeCodeForTokens({ ...base, fetchImpl: hangingFetch, timeoutMs: 5 })).errorCode, 'TIMEOUT');
    assert.equal((await exchangeCodeForTokens({ ...base, fetchImpl: async () => response(null) })).errorCode, 'INVALID_RESPONSE');
    assert.equal((await exchangeCodeForTokens({ ...base, fetchImpl: async () => response({}) })).errorCode, 'NO_TOKEN_RETURNED');
  });
  test(`${provider.id}: real OAuth/account/data/actions`, { skip: 'REAL-WORLD VERIFICATION BLOCKED: no application Supabase environment, provider client or human consent; fixtures are not live verification.' }, () => {});
  test(`${provider.id}: automatic refresh token execution`, { skip: 'NOT IMPLEMENTED: refresh metadata is stored, but there is no refresh executor.' }, () => {});
  if (provider.id !== 'google-calendar') test(`${provider.id}: successful/failed data sync`, { skip: 'NOT IMPLEMENTED: no data adapter; sync route deliberately returns 501.' }, () => {});
}

function db(results = {}) {
  const calls = [];
  return { calls, from(table) {
    const chain = new Proxy({}, { get: (_, key) => key === 'then'
      ? (resolve) => Promise.resolve(resolve(results[table] ?? { data: { id: 'fixture-connection' }, error: null }))
      : (...args) => { calls.push({ table, method: key, args }); return chain; } });
    return chain;
  } };
}
const connection = { id: 'fixture-connection', workspace_id: 'fixture-workspace', provider_id: 'gmail', connected_by: 'fixture-user', state: 'connected' };

test('ciphertext cannot be transplanted across users/workspaces/providers; legacy requires reconnect', () => {
  const binding = credentialBinding(connection.workspace_id, connection.provider_id, connection.connected_by);
  const sealed = encryptSecret('fixture-access', binding);
  assert.equal(decryptSecret(sealed, binding), 'fixture-access');
  for (const args of [['other', 'gmail', 'fixture-user'], ['fixture-workspace', 'github', 'fixture-user'], ['fixture-workspace', 'gmail', 'other']]) {
    assert.equal(decryptSecret(sealed, credentialBinding(...args)), null);
  }
  assert.equal(decryptSecret(encryptSecret('legacy-access'), binding), null);
});

test('expired credentials fail closed; reads carry workspace and connection filters', async () => {
  const binding = credentialBinding(connection.workspace_id, connection.provider_id, connection.connected_by);
  const d = db({ integration_credentials: { data: { encrypted_token: encryptSecret('fixture-access', binding), token_expires_at: '2000-01-01' }, error: null } });
  assert.equal(await readCredential(d, connection), null);
  assert.ok(d.calls.some(c => c.method === 'eq' && c.args[0] === 'workspace_id' && c.args[1] === connection.workspace_id));
  assert.ok(d.calls.some(c => c.method === 'eq' && c.args[0] === 'connection_id' && c.args[1] === connection.id));
});

test('state read errors are not disconnected; stale state is derived, prototype keys rejected', async () => {
  await assert.rejects(readConnections(db({ integration_connections: { data: null, error: { message: 'private' } } }), 'w'), /INTEGRATION_STATE_UNAVAILABLE/);
  assert.equal(isConnectionLifecycleState('toString'), false);
  assert.equal(toConnectionView({ ...connection, last_sync_at: '2000-01-01' }, 'gmail').lifecycle, 'stale');
});

test('failed sync never advances last complete sync; authorization failures require reauth', async () => {
  for (const errorCode of ['UNAUTHORIZED', 'CREDENTIAL_UNREADABLE', 'PROVIDER_ERROR']) {
    const d = db();
    await recordSyncRun({ supabase: d, workspaceId: 'w', connectionId: 'c', providerId: 'google-calendar', status: 'failed', itemsRead: 0, itemsCreated: 0, errorCode });
    const patch = d.calls.find(c => c.method === 'update').args[0];
    assert.ok(!('last_sync_at' in patch));
    assert.equal(patch.state, errorCode === 'PROVIDER_ERROR' ? 'error' : 'reauth_required');
  }
});

test('successful sync clears old errors; persistence failure cannot report success', async () => {
  const d = db();
  const args = { supabase: d, workspaceId: 'w', connectionId: 'c', providerId: 'google-calendar', status: 'success', itemsRead: 1, itemsCreated: 0 };
  await recordSyncRun(args);
  const patch = d.calls.find(c => c.method === 'update').args[0];
  assert.ok(patch.last_sync_at);
  assert.equal(patch.last_error, null);
  assert.equal(patch.state, 'connected');
  await assert.rejects(recordSyncRun({ ...args, supabase: db({ integration_sync_runs: { error: {} } }) }), /SYNC_AUDIT_WRITE_FAILED/);
  await assert.rejects(recordSyncRun({ ...args, supabase: db({ integration_connections: { error: {} } }) }), /SYNC_STATE_WRITE_FAILED/);
});

test('reconnect clears old sync, encrypts tokens before persistence, unknown grants stay unknown', async () => {
  const d = db();
  const result = await persistConnection({ supabase: d, provider: getProvider('gmail'), workspaceId: 'w', userId: 'u', accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresAt: null, accountLabel: null });
  assert.equal(result.ok, true);
  const upserts = d.calls.filter(c => c.method === 'upsert');
  assert.equal(upserts[0].args[0].state, 'connecting');
  assert.equal(upserts[0].args[0].last_sync_at, null);
  assert.deepEqual(upserts[0].args[0].scopes, []);
  assert.ok(!JSON.stringify(upserts).includes('fixture-access'));
  assert.equal(d.calls.find(c => c.method === 'update').args[0].state, 'connected');
});

test('disconnect scopes the delete by provider AND workspace; failure is explicit', async () => {
  const d = db();
  assert.equal((await disconnectConnection({ supabase: d, workspaceId: 'w', providerId: 'gmail' })).ok, true);
  assert.ok(d.calls.some(c => c.method === 'eq' && c.args[0] === 'workspace_id' && c.args[1] === 'w'));
  assert.ok(d.calls.some(c => c.method === 'eq' && c.args[0] === 'provider_id' && c.args[1] === 'gmail'));
  assert.equal((await disconnectConnection({ supabase: db({ integration_connections: { error: { message: 'denied' } } }), workspaceId: 'w', providerId: 'gmail' })).ok, false);
});

const range = { fromIso: '2026-09-22T00:00:00Z', toIso: '2026-09-23T00:00:00Z' };
const item = (id) => ({ id, start: { dateTime: '2026-09-22T08:00:00Z' }, end: { dateTime: '2026-09-22T10:00:00Z' } });
test('Calendar follows pagination, deduplicates IDs, refuses repeated cursors and bounds timeout', async () => {
  let page = 0;
  const result = await listEventsInRange({ accessToken: 'fixture-access', range, fetchImpl: async (url) => {
    page++;
    if (page === 1) return response({ items: [item('1')], nextPageToken: 'page2' });
    assert.equal(new URL(url).searchParams.get('pageToken'), 'page2');
    return response({ items: [item('1'), item('2')] });
  } });
  assert.equal(result.ok, true);
  assert.equal(result.events.length, 2);
  assert.equal((await listEventsInRange({ accessToken: 'x', range, fetchImpl: async () => response({ items: [], nextPageToken: 'repeat' }) })).errorCode, 'INCOMPLETE');
  assert.equal((await listEventsInRange({ accessToken: 'x', range, fetchImpl: hangingFetch, timeoutMs: 5 })).errorCode, 'TIMEOUT');
  for (const [status, errorCode] of [[401, 'UNAUTHORIZED'], [403, 'UNAUTHORIZED'], [429, 'RATE_LIMITED'], [500, 'PROVIDER_ERROR']]) {
    assert.equal((await listEventsInRange({ accessToken: 'x', range, fetchImpl: async () => response({}, status) })).errorCode, errorCode);
  }
});

test('Calendar availability respects overnight/all-day busy intervals (UTC heuristic, not freebusy API)', () => {
  const args = { events: [{ startAt: '2026-09-21T22:00:00Z', endAt: '2026-09-22T10:00:00Z' }], fromIso: range.fromIso, toIso: range.fromIso, dayStartHour: 8, dayEndHour: 18, minWindowMinutes: 30 };
  assert.deepEqual(findFreeWindows(args).map(w => w.minutes), [480]);
  assert.deepEqual(findFreeWindows({ ...args, events: [{ startAt: '2026-09-22', endAt: '2026-09-23', isAllDay: true }] }), []);
  assert.equal(detectConflicts([{ startAt: '2026-09-22T10:00:00+02:00', endAt: '2026-09-22T12:00:00+02:00' }, { startAt: '2026-09-22T09:00:00Z', endAt: '2026-09-22T11:00:00Z' }]).length, 1);
});

test('UI/source/health regression contracts (static assertions, not a browser audit)', () => {
  const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const health = read('src/lib/admin/health.ts');
  assert.ok(health.includes('status: external ? "not_measured" : "not_configured"'));
  assert.ok(read('src/app/admin/intelligence/page.tsx').includes('await requirePlatformAdminContext()'));
  assert.ok(read('src/app/(app)/integrations/page.tsx').includes('p.id === connectedNotice && p.connection.lifecycle === "connected"'));
  assert.ok(read('src/components/ui/modal.tsx').includes('event.key === "Tab"'));
  assert.ok(read('src/app/api/intelligence/query/route.ts').includes('if (!recovery) {'));
});
