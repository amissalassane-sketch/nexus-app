// Real SQL policies/constraints in PGlite, minimal auth/automation fixture.
// Does NOT verify a hosted Supabase deployment or its Storage service.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const migration = name => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const W1 = '33333333-3333-4333-8333-333333333333';
const W2 = '44444444-4444-4444-8444-444444444444';
const C1 = '55555555-5555-4555-8555-555555555555';
const C2 = '66666666-6666-4666-8666-666666666666';

test('integration SQL: cross-user/workspace isolation, relational tenant binding, cascading disconnect, worker ACL and unknown usage', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role authenticated nologin; create role anon nologin; create role service_role nologin;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema public, auth to authenticated, anon, service_role;
      alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
      alter default privileges in schema public grant execute on functions to authenticated, anon, service_role;
      create table public.workspaces(id uuid primary key);
      create table public.workspace_members(workspace_id uuid, user_id uuid, status text);
      create function public.is_active_workspace_member(w uuid) returns boolean language sql stable security definer set search_path=public as $$
        select exists(select 1 from workspace_members where workspace_id=w and user_id=auth.uid() and status='active') $$;
      create function public.is_workspace_member(w uuid) returns boolean language sql stable as $$ select public.is_active_workspace_member(w) $$;
      create function public.platform_admin_is_admin() returns boolean language sql stable as $$ select auth.uid()='${B}'::uuid $$;
      create function public.handle_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
      create type public.automation_action_type as enum ('webhook');
      create table public.automations(id uuid primary key, actions jsonb);
      create table public.automation_executions(id uuid primary key, workspace_id uuid, automation_id uuid, status text, execution_result jsonb, completed_at timestamptz, error_message text);
      insert into auth.users values ('${A}'), ('${B}');
      insert into workspaces values ('${W1}'), ('${W2}');
      insert into workspace_members values ('${W1}','${A}','active'), ('${W2}','${B}','active');
    `);
    await db.exec(migration('005_nexus_worker.sql'));
    await db.exec(migration('20260922130000_nexus_context_platform.sql'));
    // Demonstrate the old privilege default, then test the actual additive fix.
    assert.equal((await db.query("select has_function_privilege('authenticated','public.claim_next_worker_job()','EXECUTE') as allowed")).rows[0].allowed, true);
    await db.exec(migration('20260922210000_nexus_audit_hardening.sql'));
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query(`select has_function_privilege('${role}','public.claim_next_worker_job()','EXECUTE') as allowed`)).rows[0].allowed, false);
      assert.equal((await db.query(`select has_function_privilege('${role}','public.complete_worker_job(uuid,jsonb)','EXECUTE') as allowed`)).rows[0].allowed, false);
    }
    await db.exec(`insert into integration_connections(id,workspace_id,provider_id,connected_by) values ('${C1}','${W1}','gmail','${A}'), ('${C2}','${W2}','gmail','${B}');
      insert into integration_credentials(connection_id, workspace_id, encrypted_token) values ('${C1}','${W1}','fixture-ciphertext'), ('${C2}','${W2}','fixture-ciphertext');`);
    const asUser = async (id) => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
    await asUser(A);
    assert.deepEqual((await db.query('select id from integration_connections')).rows.map(r => r.id), [C1]);
    assert.equal((await db.query('select * from integration_credentials')).rows.length, 1);
    assert.equal((await db.query(`update integration_connections set state='connected' where id='${C2}' returning id`)).rows.length, 0);
    assert.equal((await db.query(`delete from integration_connections where id='${C2}' returning id`)).rows.length, 0);
    await assert.rejects(db.exec(`insert into integration_connections(workspace_id,provider_id) values ('${W2}','slack')`), /row-level security/);
    await assert.rejects(db.exec(`insert into integration_sync_runs(connection_id,workspace_id,provider_id,status) values ('${C2}','${W1}','gmail','success')`), /integration_sync_runs_connection_workspace_fk/);
    await assert.rejects(db.exec(`update integration_credentials set connection_id='${C2}' where connection_id='${C1}'`), /unique constraint|foreign key constraint/);
    // Delete the second credential as owner to prove the FK, not just unique(connection_id), blocks transplantation.
    await db.exec(`reset role; delete from integration_credentials where connection_id='${C2}';`);
    await asUser(A);
    await assert.rejects(db.exec(`update integration_credentials set connection_id='${C2}' where connection_id='${C1}'`), /integration_credentials_connection_workspace_fk/);
    await assert.rejects(db.exec(`insert into intelligence_request_log(user_id,workspace_id,provider,status) values ('${B}','${W1}','nexus-engine','ok')`), /row-level security/);
    await db.exec(`insert into intelligence_request_log(user_id,workspace_id,provider,status) values ('${A}','${W1}','nexus-engine','ok')`);
    await assert.rejects(db.query('select admin_intelligence_health()'), /ADMIN_ACCESS_DENIED/);
    await db.exec(`delete from integration_connections where id='${C1}';`);
    assert.equal((await db.query('select * from integration_credentials')).rows.length, 0);
    await asUser(B);
    assert.equal((await db.query('select * from intelligence_request_log')).rows.length, 0);
    const health = (await db.query('select admin_intelligence_health() as health')).rows[0].health;
    assert.equal(health.input_tokens_30d, null);
    assert.equal(health.output_tokens_30d, null);
    await db.exec(`reset role; update workspace_members set status='suspended' where user_id='${B}';`);
    await asUser(B);
    assert.equal((await db.query('select * from integration_connections')).rows.length, 0);
    await db.exec('reset role; set role anon;');
    assert.equal((await db.query('select * from integration_connections')).rows.length, 0);
  } finally { await db.close(); }
});
