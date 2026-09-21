import assert from 'node:assert/strict';
import { test } from 'node:test';
const { getBillingProviderStatus } = await import('../../src/lib/billing/provider.ts');
test('uninstalled payment provider never implies a real checkout or a specific vendor', () => {
  const result = getBillingProviderStatus();
  assert.equal(result.available, false);
  assert.equal(result.provider, null);
  assert.equal(result.code, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  assert.equal('checkoutUrl' in result, false);
});

test('all plan headlines use the canonical resolver, and historical rows are not labeled absent', async () => {
  const { readFileSync } = await import('node:fs');
  const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  for (const path of ['src/app/(app)/settings/billing/page.tsx', 'src/app/(app)/upgrade/page.tsx', 'src/app/admin/workspaces/[workspaceId]/page.tsx']) {
    assert.ok(read(path).includes('effectivePlanOf('), path);
  }
  assert.ok(read('src/app/admin/subscriptions/page.tsx').includes('row.subscription_status ? "FREE effective" : "implicit"'));
  assert.ok(!read('src/app/admin/workspaces/page.tsx').includes('No workspace_subscriptions row:'));
});
