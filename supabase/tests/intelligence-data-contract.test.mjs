import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const { readMemory, saveMemory, emptyMemoryState } = await import('../../src/lib/intelligence/memory.ts');
const { readMission, readActiveMissions } = await import('../../src/lib/intelligence/mission.ts');
const { readSignals, updateSignalStatus } = await import('../../src/lib/intelligence/signal-store.ts');
const { IntelligenceDataError, assertIntelligenceData } = await import('../../src/lib/intelligence/data-error.ts');

function db(result) {
  const calls = [];
  const chain = new Proxy({}, { get: (_, key) => key === 'then'
    ? resolve => Promise.resolve(resolve(result))
    : (...args) => { calls.push([key, ...args]); return chain; } });
  return { from: (...args) => { calls.push(['from', ...args]); return chain; }, calls };
}
for (const [name, read, empty] of [
  ['memory', d => readMemory(d, 'ws', 'user'), null],
  ['mission', d => readMission(d, 'ws', 'user', 'mission'), null],
  ['missions', d => readActiveMissions(d, 'ws', 'user'), []],
  ['signals', d => readSignals(d, 'ws', 'user'), []],
]) {
  test(`${name}: SQL error is unavailable, not empty, and contains no raw details`, async () => {
    const d = db({ data: null, error: { code: 'XX000', message: 'sensitive SQL detail' } });
    await assert.rejects(read(d), e => e instanceof IntelligenceDataError && e.status === 503 && !e.message.includes('sensitive'));
    assert.ok(d.calls.some(c => c[0] === 'eq' && c[1] === 'workspace_id' && c[2] === 'ws'));
    assert.ok(d.calls.some(c => c[0] === 'eq' && c[1] === 'user_id' && c[2] === 'user'));
  });
  test(`${name}: successful absence remains empty`, async () => {
    assert.deepEqual(await read(db({ data: Array.isArray(empty) ? [] : null, error: null })), empty);
  });
}
test('SQL authorization failure is distinct from unavailability', () => {
  assert.throws(() => assertIntelligenceData({ error: { code: '42501' } }), e => e.status === 403 && e.code === 'NOT_AUTHORIZED');
});
test('failed memory update must not attempt an insert or claim persistence', async () => {
  const d = db({ data: null, error: { code: 'XX000' } });
  await assert.rejects(saveMemory(d, 'ws', 'user', emptyMemoryState(), []), IntelligenceDataError);
  assert.ok(!d.calls.some(c => c[0] === 'insert'));
});
test('failed signal update is not reported as a missing signal', async () => {
  await assert.rejects(updateSignalStatus(db({ data: null, error: { code: 'XX000' } }), 'ws', 'user', 'id', 'seen'), IntelligenceDataError);
});
test('workspace-wide recompute is dispatched before requiring a mission id', () => {
  const source = readFileSync(new URL('../../src/app/api/intelligence/missions/route.ts', import.meta.url), 'utf8');
  assert.ok(source.indexOf('if (action === "recompute")') < source.indexOf('if (!missionId)'));
});

test('initial Intelligence screen treats even one failed table read as unavailable', () => {
  const source = readFileSync(new URL('../../src/app/(app)/app/intelligence/page.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('tasks.error || projects.error || goals.error'));
  assert.ok(!source.includes('tasks.error?.message'));
});

test('signal generation never reports provisional ids as persisted when insert returns no rows', async () => {
  const { getProactiveIntelligence } = await import('../../src/lib/intelligence/signal-store.ts');
  const d = db({ data: [], error: null });
  const snapshot = { tasks: [{ id: 'task', title: 'Overdue task', status: 'todo', priority: 'urgent', due_at: '2026-01-01T00:00:00Z', created_at: '2025-12-01T00:00:00Z', updated_at: '2025-12-01T00:00:00Z', project_id: null }], projects: [], goals: [] };
  await assert.rejects(getProactiveIntelligence(d, 'ws', 'user', snapshot, { now: new Date('2026-09-21T12:00:00Z'), enrich: false }), IntelligenceDataError);
  assert.ok(d.calls.some(c => c[0] === 'insert'));
});
