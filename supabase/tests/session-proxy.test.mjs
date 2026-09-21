import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { startSupabaseStub, makeSession } from './supabase-stub.mjs';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'stub-key';
const { updateSession } = await import('../../src/lib/supabase/middleware.ts');
const { NextRequest } = await import('next/server.js');

test('proxy retains refreshed cookies when redirecting an authenticated login', async () => {
  const stub = await startSupabaseStub();
  try {
    const key = createClient(stub.url, 'stub-key').auth.storageKey;
    const cookie = `base64-${Buffer.from(JSON.stringify(makeSession(undefined, -60))).toString('base64url')}`;
    const response = await updateSession(new NextRequest('https://nexus.test/login', {
      headers: { cookie: `${key}=${cookie}` },
    }));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), 'https://nexus.test/app');
    assert.ok(response.cookies.getAll().some(c => c.name.startsWith(key) && c.value), 'refresh cookies must reach the browser');
  } finally {
    await stub.close();
  }
});

test('anonymous admin access redirects to the dedicated login', async () => {
  const response = await updateSession(new NextRequest('https://nexus.test/admin/subscriptions'));
  assert.equal(response.headers.get('location'), 'https://nexus.test/admin/login');
});

test('proxy overwrites a spoofed admin authentication pathname', async () => {
  const response = await updateSession(new NextRequest('https://nexus.test/api/health', {
    headers: { 'x-pathname': '/admin/login' },
  }));
  assert.equal(response.headers.get('x-middleware-request-x-pathname'), '/api/health');
});
