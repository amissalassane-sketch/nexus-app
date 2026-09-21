import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('all product routes activate the opaque-black shell, without a spatial field', () => {
  const shell = read('src/components/layout/app-shell.tsx');
  assert.ok(shell.includes('data-dashboard-root="true"'));
  assert.ok(!shell.includes('NexusSpatialField'));
  assert.ok(!shell.includes('bg-bg-subtle/60'));
  assert.ok(shell.includes('solidBackground'));
});
test('admin base, sidebar and header are opaque black without decorative blur', () => {
  const css = read('src/app/globals.css');
  const shell = read('src/components/admin/admin-shell.tsx');
  assert.match(css, /--color-admin-base:\s*#000000;/);
  assert.match(css, /--color-admin-sidebar:\s*#000000;/);
  assert.ok(shell.includes('data-dashboard-root="true"'));
  assert.ok(!shell.includes('bg-admin-base/95'));
  assert.ok(!shell.includes('backdrop-blur-sm'));
});
