import assert from 'node:assert/strict';
import { test } from 'node:test';
const { readJsonObject } = await import('../../src/lib/request-json.ts');

for (const body of ['null', '[]', '"text"', '1', 'true', '', '{']) {
  test(`rejects non-object or malformed payload: ${JSON.stringify(body)}`, async () => {
    const request = new Request('https://nexus.test/api', { method: 'POST', body });
    await assert.rejects(() => readJsonObject(request), SyntaxError);
  });
}
for (const body of [{}, { email: 'test@example.test', password: 'example' }, { type: 1 }]) {
  test(`accepts an object; leaves field validation to the endpoint: ${JSON.stringify(body)}`, async () => {
    const request = new Request('https://nexus.test/api', { method: 'POST', body: JSON.stringify(body) });
    assert.deepEqual(await readJsonObject(request), body);
  });
}
