import assert from 'node:assert/strict';
import { test } from 'node:test';

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const { getPlatformAdminState } = await import('../../src/lib/admin/guard.ts');

test('unconfigured admin access fails closed without constructing a request-bound client', async () => {
  assert.deepEqual(await getPlatformAdminState(), {
    status: 'unavailable', reason: 'SUPABASE_NOT_CONFIGURED',
  });
});
