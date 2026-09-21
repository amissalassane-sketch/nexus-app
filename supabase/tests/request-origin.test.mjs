import assert from 'node:assert/strict';
import { test } from 'node:test';
const { safeNextPath } = await import('../../src/lib/request-origin.ts');

for (const path of ['//evil.test', '/\t/evil.test', '/\n/evil.test', '/\r/evil.test', '/\\evil.test', 'https://evil.test', '/\0/evil.test']) {
  test(`rejects unsafe redirect ${JSON.stringify(path)}`, () => {
    assert.equal(safeNextPath(path), '/dashboard');
  });
}
for (const path of ['/dashboard', '/reset-password', '/tasks?status=done', '/projects#active']) {
  test(`preserves local redirect ${path}`, () => {
    assert.equal(safeNextPath(path), path);
    assert.equal(new URL(safeNextPath(path), 'https://nexus.test').origin, 'https://nexus.test');
  });
}
