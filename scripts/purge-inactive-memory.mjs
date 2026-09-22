// Operator job. NEVER prints credentials or memory contents. Not scheduled automatically.
if (!process.argv.includes('--execute')) {
  console.log('No deletion performed. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the job secret store, then pass --execute. Deletes at most 1000 inactive (>90 days) memory rows.');
  process.exit(0);
}
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('RETENTION_JOB_NOT_CONFIGURED'); process.exit(1); }
try {
  const endpoint = new URL('/rest/v1/rpc/purge_inactive_intelligence_memory', url);
  if (endpoint.protocol !== 'https:') throw new Error('HTTPS_REQUIRED');
  const result = await fetch(endpoint, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000) });
  if (!result.ok) throw new Error('PURGE_FAILED');
  const count = await result.json();
  if (!Number.isInteger(count) || count < 0 || count > 1000) throw new Error('INVALID_PURGE_RESULT');
  console.log(JSON.stringify({ operation: 'purge_inactive_memory', deletedCount: count, possiblyMore: count === 1000 }));
} catch { console.error('RETENTION_JOB_FAILED_CHECK_OPERATOR_LOGS'); process.exit(1); }
